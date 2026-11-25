const CELL=8,EPSILON=1e-5,TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/** Horizontal envelope of every non-umbrella voxel throughout the production
 * gait. Arm bounds include shoulder lean, elbow offset and maximum joint swing;
 * planted/swinging boots include the bounded ankle reach plus their sole corner.
 * A canopy is deliberately not treated as a human-sized ground obstruction.
 */
export function civilianBodyRadius(pieces,scale=1){
  let radius=.135+.25+Math.hypot(.1,.195);
  const lean=Math.sin(.11),upper=Math.sin(.57),lower=Math.sin(1.28);
  for(const p of pieces){
    if(p.umbrella)continue;
    const x=Math.abs(p.x)+p.sx/2;let z=Math.abs(p.z)+p.sz/2;
    if(p.motion===3||p.motion===4)z+=.42*lean+.245*upper+(Math.abs(p.y-1.145)+p.sy/2)*lower;
    else if(Math.abs(p.x)>=.255&&p.y>=1.2&&p.y<1.5)z+=.42*lean+(Math.abs(p.y-1.39)+p.sy/2)*upper;
    else if(p.y>=.98)z+=(Math.abs(p.y-.97)+p.sy/2)*lean;
    else if(p.motion===1||p.motion===2)continue;
    radius=Math.max(radius,Math.hypot(x,z));
  }
  return(radius+.025)*scale;
}

function entry(box){
  if(!box||!['x','y','z','sx','sy','sz'].every(k=>Number.isFinite(box[k]))||Math.min(box.sx,box.sy,box.sz)<=0)return null;
  const yaw=box.ry||0;if(!Number.isFinite(yaw))return null;
  const c=Math.cos(yaw),s=Math.sin(yaw),hx=box.sx/2,hz=box.sz/2;
  return{box,c,s,hx,hz,minY:box.y-box.sy/2,maxY:box.y+box.sy/2,
    ex:Math.abs(c)*hx+Math.abs(s)*hz,ez:Math.abs(s)*hx+Math.abs(c)*hz,seen:0};
}
function index(items){
  const grid=new Map();
  for(const item of items)for(let x=Math.floor((item.box.x-item.ex)/CELL);x<=Math.floor((item.box.x+item.ex)/CELL);x++)
    for(let z=Math.floor((item.box.z-item.ez)/CELL);z<=Math.floor((item.box.z+item.ez)/CELL);z++){
      const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(item);
    }
  return grid;
}
function circleContact(item,x,z,radius){
  const dx=x-item.box.x,dz=z-item.box.z,lx=dx*item.c-dz*item.s,lz=dx*item.s+dz*item.c;
  const qx=clamp(lx,-item.hx,item.hx),qz=clamp(lz,-item.hz,item.hz),vx=lx-qx,vz=lz-qz;
  return vx*vx+vz*vz<radius*radius-EPSILON*EPSILON;
}

/** Grounded living-civilian navigation. All obstacle specs use centered OBBs.
 * Dynamic providers are sampled once per beginFrame, never inside a substep.
 * Physics corpses and vehicle impacts remain owned by their existing systems.
 */
export function createCivilianNavigation({colliders=[],groundHeightAt=()=>.057,bounds,stepHeight=.30}={}){
  const staticItems=colliders.map(entry).filter(Boolean),staticGrid=index(staticItems);
  let provider=null,dynamicItems=[],dynamicGrid=new Map(),queryId=0;
  const crowdGrid=new Map(),crowdCell=3;let crowdMaxRadius=0,crowdCount=0;
  const crowdKey=(x,z)=>Math.floor(x/crowdCell)+','+Math.floor(z/crowdCell);
  function reserve(person){
    const key=crowdKey(person.x,person.z);if(person.crowdCell===key)return;
    if(person.crowdCell){const old=crowdGrid.get(person.crowdCell),i=old?.indexOf(person);if(i>=0)old.splice(i,1);}
    if(!crowdGrid.has(key))crowdGrid.set(key,[]);crowdGrid.get(key).push(person);person.crowdCell=key;
  }
  function beginCrowd(people){
    crowdGrid.clear();crowdMaxRadius=0;crowdCount=0;
    for(const person of people){person.crowdCell=null;if(!person.alive)continue;crowdCount++;crowdMaxRadius=Math.max(crowdMaxRadius,person.crowdRadius||.44*person.scale);reserve(person);}
  }
  function neighbors(person,x,z,radius,callback){
    for(let ix=Math.floor((x-radius)/crowdCell);ix<=Math.floor((x+radius)/crowdCell);ix++)for(let iz=Math.floor((z-radius)/crowdCell);iz<=Math.floor((z+radius)/crowdCell);iz++)
      for(const other of crowdGrid.get(ix+','+iz)||[])if(other!==person&&other.alive&&callback(other))return true;
    return false;
  }
  function crowdBlocked(person,x,z,padding=0){
    const radius=person.crowdRadius||.44*person.scale;
    return neighbors(person,x,z,radius+crowdMaxRadius+padding,other=>{
      const separation=radius+(other.crowdRadius||.44*other.scale)+padding;
      return Math.hypot(x-other.x,z-other.z)<separation-EPSILON;
    });
  }
  function clearFor(person,x,z,padding=0){return !blocked(x,z,.44*person.scale,1.85*person.scale)&&!crowdBlocked(person,x,z,padding);}
  function steerCrowd(person,vx,vz){
    const speed=Math.hypot(vx,vz);if(speed<.001)return{vx,vz,mode:'idle'};
    const ux=vx/speed,uz=vz/speed,radius=person.crowdRadius||.44*person.scale;let threat=null,nearest=Infinity;
    neighbors(person,person.x,person.z,radius+crowdMaxRadius+speed*1.5+.7,other=>{
      const dx=other.x-person.x,dz=other.z-person.z,ahead=dx*ux+dz*uz;if(ahead<-.05)return false;
      const ovx=other.intentVX||0,ovz=other.intentVZ||0,rvx=vx-ovx,rvz=vz-ovz,relative=rvx*rvx+rvz*rvz;
      const t=relative?clamp((dx*rvx+dz*rvz)/relative,0,1.6):0,min=radius+(other.crowdRadius||.44*other.scale)+.13;
      if(Math.hypot(dx-rvx*t,dz-rvz*t)<min&&ahead<nearest){threat=other;nearest=ahead;}return false;
    });
    if(!threat)return{vx,vz,mode:'walk'};
    const dx=threat.x-person.x,dz=threat.z-person.z,separation=radius+(threat.crowdRadius||.44*threat.scale),gap=Math.hypot(dx,dz)-separation;
    const otherSpeed=Math.hypot(threat.intentVX||0,threat.intentVZ||0),aligned=otherSpeed?((threat.intentVX||0)*ux+(threat.intentVZ||0)*uz)/otherSpeed:0;
    if(aligned>.65){const pace=Math.min(speed,Math.max(0,(threat.acceptedVX||0)*ux+(threat.acceptedVZ||0)*uz)+(gap-.12)/.8);return{vx:ux*Math.max(0,pace),vz:uz*Math.max(0,pace),mode:'follow',neighbor:threat.id};}
    // Opposing walkers keep right. The lateral proposal must fit both walls and
    // already reserved people; a blocked narrow lane gives the later ID a turn.
    const rightX=uz,rightZ=-ux,lateral=Math.min(.7,speed*.9+.12),look=.6;
    for(const side of [1,-1]){
      const sx=rightX*side,sz=rightZ*side;
      if(clearFor(person,person.x+sx*look,person.z+sz*look,.035)&&clearFor(person,person.x+sx*.25,person.z+sz*.25,.015)){
        const pace=speed*clamp((gap+.1)/.9,.08,.7);return{vx:ux*pace+sx*lateral,vz:uz*pace+sz*lateral,mode:'pass',neighbor:threat.id};
      }
    }
    if(person.id>threat.id&&aligned<.3&&clearFor(person,person.x-ux*.3,person.z-uz*.3,.02))return{vx:-vx*.65,vz:-vz*.65,mode:'reverse',neighbor:threat.id};
    return{vx:0,vz:0,mode:'yield',neighbor:threat.id};
  }
  function beginFrame(){dynamicItems=(provider?.()||[]).map(entry).filter(Boolean);dynamicGrid=index(dynamicItems);}
  function setObstacleProvider(callback){provider=typeof callback==='function'?callback:null;beginFrame();}
  function visit(x,z,radius,callback){
    const stamp=++queryId;
    for(const grid of [staticGrid,dynamicGrid])for(let ix=Math.floor((x-radius)/CELL);ix<=Math.floor((x+radius)/CELL);ix++)
      for(let iz=Math.floor((z-radius)/CELL);iz<=Math.floor((z+radius)/CELL);iz++)for(const item of grid.get(ix+','+iz)||[]){
        if(item.seen===stamp)continue;item.seen=stamp;if(callback(item))return true;
      }
    return false;
  }
  function relevant(item,floor,height){return item.maxY>floor+stepHeight+EPSILON&&item.minY<floor+height-EPSILON;}
  function blocked(x,z,radius=.44,height=1.85){
    if(bounds&&(x<bounds.minX+radius||x>bounds.maxX-radius||z<bounds.minZ+radius||z>bounds.maxZ-radius))return true;
    const floor=groundHeightAt(x,z);
    return visit(x,z,radius,item=>relevant(item,floor,height)&&circleContact(item,x,z,radius));
  }
  function move(person,dx,dz){
    const x=person.x,z=person.z,radius=.44*person.scale,height=1.85*person.scale;
    const count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/Math.min(.15,radius*.4)));
    for(let i=0;i<count;i++){
      const nx=person.x+dx/count,nz=person.z+dz/count;
      if(!blocked(nx,nz,radius,height)&&!crowdBlocked(person,nx,nz)){person.x=nx;person.z=nz;}
      else if(Math.abs(dz)>EPSILON&&!blocked(person.x,nz,radius,height)&&!crowdBlocked(person,person.x,nz))person.z=nz;
      else if(Math.abs(dx)>EPSILON&&!blocked(nx,person.z,radius,height)&&!crowdBlocked(person,nx,person.z))person.x=nx;
      reserve(person);
    }
    return{dx:person.x-x,dz:person.z-z,distance:Math.hypot(person.x-x,person.z-z)};
  }
  function boxBlocked(box){
    const x=(box.min.x+box.max.x)/2,z=(box.min.z+box.max.z)/2,hx=(box.max.x-box.min.x)/2,hz=(box.max.z-box.min.z)/2;
    return visit(x,z,Math.hypot(hx,hz),o=>{
      if(box.max.y<=o.minY+EPSILON||box.min.y>=o.maxY-EPSILON)return false;
      const dx=x-o.box.x,dz=z-o.box.z;
      return Math.abs(dx)<hx+o.ex&&Math.abs(dz)<hz+o.ez&&
        Math.abs(dx*o.c-dz*o.s)<o.hx+Math.abs(o.c)*hx+Math.abs(o.s)*hz&&
        Math.abs(dx*o.s+dz*o.c)<o.hz+Math.abs(o.s)*hx+Math.abs(o.c)*hz;
    });
  }
  function resolveSpawn(person,occupied=[]){
    const radius=.44*person.scale,crowdRadius=person.crowdRadius||radius,height=1.85*person.scale,anchor={x:person.x,z:person.z};
    const valid=(x,z)=>!blocked(x,z,radius,height)&&!occupied.some(p=>Math.hypot(x-p.x,z-p.z)<crowdRadius+p.radius+.02);
    if(valid(anchor.x,anchor.z))return{...anchor,resolved:true,distance:0};
    const candidates=[],floor=groundHeightAt(anchor.x,anchor.z);
    visit(anchor.x,anchor.z,radius,item=>{
      if(!relevant(item,floor,height)||!circleContact(item,anchor.x,anchor.z,radius))return false;
      const dx=anchor.x-item.box.x,dz=anchor.z-item.box.z,lx=dx*item.c-dz*item.s,lz=dx*item.s+dz*item.c;
      for(const [x,z] of [[-item.hx-radius-.005,lz],[item.hx+radius+.005,lz],[lx,-item.hz-radius-.005],[lx,item.hz+radius+.005]])
        candidates.push({x:item.box.x+x*item.c+z*item.s,z:item.box.z-x*item.s+z*item.c});
      return false;
    });
    for(const p of occupied){const dx=anchor.x-p.x,dz=anchor.z-p.z,d=Math.hypot(dx,dz),r=crowdRadius+p.radius+.025;if(d<r)candidates.push({x:p.x+(d?dx/d:1)*r,z:p.z+(d?dz/d:0)*r});}
    candidates.sort((a,b)=>Math.hypot(a.x-anchor.x,a.z-anchor.z)-Math.hypot(b.x-anchor.x,b.z-anchor.z)||a.x-b.x||a.z-b.z);
    const projected=candidates.find(p=>valid(p.x,p.z)),limit=projected?Math.hypot(projected.x-anchor.x,projected.z-anchor.z):12;
    // Search nearby rings first, so a thin pole does not move a citizen to the
    // far side of a whole shelf. This runs only at explicit spawn boundaries.
    for(let radius=.1;radius<Math.min(12,limit);radius+=.1){
      const count=Math.min(160,Math.max(16,Math.ceil(TAU*radius/.15)));
      for(let i=0;i<count;i++){const a=i/count*TAU,x=anchor.x+Math.cos(a)*radius,z=anchor.z+Math.sin(a)*radius;if(valid(x,z))return{x,z,resolved:true,distance:radius};}
    }
    if(projected)return{...projected,resolved:true,distance:limit};
    return{...anchor,resolved:false,distance:0};
  }
  return{beginFrame,beginCrowd,steerCrowd,setObstacleProvider,blocked,move,boxBlocked,resolveSpawn,getState:()=>({staticObstacles:staticItems.length,dynamicObstacles:dynamicItems.length,crowdActors:crowdCount})};
}
