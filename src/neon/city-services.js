// Services use existing authored interfaces. This module creates no scene
// objects and emits outcomes for the owner of health / energy / car state.
const EPS=.00001,CELL=24,RANGE=3.15,CAR={halfWidth:1.45,halfLength:2.64};
const finitePoint=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const point=p=>({x:p.x,y:p.y,z:p.z});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const horizontal=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const normal=ry=>({x:Math.sin(ry),y:0,z:Math.cos(ry)});
const add=(p,n,k)=>({x:p.x+n.x*k,y:p.y+(n.y||0)*k,z:p.z+n.z*k});
const validBox=b=>b&&['x','y','z','sx','sy','sz'].every(k=>Number.isFinite(b[k]))&&Math.min(b.sx,b.sy,b.sz)>0&&Number.isFinite(b.ry??0);
const DEFINITIONS={
  'Lantern Market':{type:'food',label:'Street kitchen',actionLabel:'ORDER RECOVERY MEAL',description:'Restore 25 health and boost neural regeneration for 45 seconds.',duration:2.4,cooldown:90},
  'Meridian East':{type:'clinic',label:'Public clinic',actionLabel:'START MEDICAL SCAN',description:'Use the exterior diagnostic terminal to restore health.',duration:4.5,cooldown:120},
  'Iron Docks':{type:'garage',label:'Dockside garage',actionLabel:'START INTERCEPTOR REPAIR',description:'Park in the service apron, exit, and use the diagnostic panel.',duration:5.5,cooldown:90},
  'Stacktown':{type:'recharge',label:'Neural utility',actionLabel:'RECHARGE NEURAL ENERGY',description:'Recharge 60 neural energy at the public utility interface.',duration:3,cooldown:45},
  'Crown Plaza':{type:'wayfinding',label:'City directory',actionLabel:'LOCATE ANOTHER SERVICE',description:'Set a navigation waypoint to a food, clinic, recharge, or repair stop.',duration:1.1,cooldown:8}
};

function aabb(b){const c=Math.abs(Math.cos(b.ry||0)),s=Math.abs(Math.sin(b.ry||0));return{x:(c*b.sx+s*b.sz)/2,z:(s*b.sx+c*b.sz)/2};}
function makeIndex(boxes){
  const cells=new Map();
  for(const b of boxes){const h=aabb(b);for(let x=Math.floor((b.x-h.x)/CELL);x<=Math.floor((b.x+h.x)/CELL);x++)for(let z=Math.floor((b.z-h.z)/CELL);z<=Math.floor((b.z+h.z)/CELL);z++){
    const key=x+','+z,list=cells.get(key)||[];list.push(b);cells.set(key,list);
  }}
  return(x,z,r)=>{const found=new Set();for(let ix=Math.floor((x-r)/CELL);ix<=Math.floor((x+r)/CELL);ix++)for(let iz=Math.floor((z-r)/CELL);iz<=Math.floor((z+r)/CELL);iz++)for(const b of cells.get(ix+','+iz)||[])found.add(b);return[...found];};
}
function segmentHit(from,to,b,padding=0){
  const c=Math.cos(b.ry||0),s=Math.sin(b.ry||0),dx=from.x-b.x,dz=from.z-b.z,ex=to.x-b.x,ez=to.z-b.z;
  const a=[c*dx-s*dz,from.y-b.y,s*dx+c*dz],end=[c*ex-s*ez,to.y-b.y,s*ex+c*ez],h=[b.sx/2+padding,b.sy/2+padding,b.sz/2+padding];
  let lo=0,hi=1;
  for(let i=0;i<3;i++){const d=end[i]-a[i];if(Math.abs(d)<EPS){if(Math.abs(a[i])>h[i])return null;continue;}let n=(-h[i]-a[i])/d,f=(h[i]-a[i])/d;if(n>f)[n,f]=[f,n];lo=Math.max(lo,n);hi=Math.min(hi,f);if(lo>hi)return null;}
  return lo;
}
function localOverlap(a,b){
  if(a.y+a.sy/2<=b.y-b.sy/2+EPS||a.y-a.sy/2>=b.y+b.sy/2-EPS)return false;
  const aa=a.ry||0,ba=b.ry||0,axes=[[Math.cos(aa),-Math.sin(aa)],[Math.sin(aa),Math.cos(aa)],[Math.cos(ba),-Math.sin(ba)],[Math.sin(ba),Math.cos(ba)]];
  const radius=(box,axis)=>{const c=Math.cos(box.ry||0),s=Math.sin(box.ry||0);return Math.abs(axis[0]*c-axis[1]*s)*box.sx/2+Math.abs(axis[0]*s+axis[1]*c)*box.sz/2;};
  return axes.every(axis=>Math.abs((a.x-b.x)*axis[0]+(a.z-b.z)*axis[1])<radius(a,axis)+radius(b,axis)-EPS);
}

/**
 * Source is the existing city serviceSource (boxes, streetDetails, roads,
 * districts, colliders, buildings). No new layout or native geometry is made.
 * getColliders(x,z,range) supplies live blockers and can include static boxes.
 * Optional lineOfSight(from,to,{site,ignoreBoxIds,endpointTolerance}) is an
 * additional veto; only explicit true permits interaction when it is supplied.
 */
export function createCityServices({layout={},getColliders,lineOfSight,groundHeightAt,sitesPerDistrict=3}={}){
  // Keep the immutable authored boxes by reference. Cloning the full skyline
  // would retain tens of megabytes for only fifteen street-level terminals.
  const sourceBoxes=layout.boxes||[],byId=new Map(),terminalIndices=new Map();
  for(let index=0;index<sourceBoxes.length;index++){
    const box=sourceBoxes[index];if(!box.id)continue;byId.set(box.id,box);
    if(box.role==='access display'||box.role==='access panel')terminalIndices.set(box.id,index);
  }
  const groundBoxes=sourceBoxes.filter(b=>validBox(b)&&b.kind==='pavement'&&b.sx>=1&&b.sz>=1&&b.y+b.sy/2>=.08&&b.y+b.sy/2<=.4);
  const ground=(x,z)=>{if(groundHeightAt){const y=groundHeightAt(x,z);if(Number.isFinite(y))return y;}return groundBoxes.reduce((y,b)=>{const c=Math.cos(b.ry||0),s=Math.sin(b.ry||0),dx=x-b.x,dz=z-b.z;return Math.abs(dx*c-dz*s)<=b.sx/2&&Math.abs(dx*s+dz*c)<=b.sz/2?Math.max(y,b.y+b.sy/2):y;},.057);};
  const solids=sourceBoxes.filter(b=>validBox(b)&&b.lod!=='far'&&b.y-b.sy/2<5&&['solid','metal','window','glow','glass','pavement'].includes(b.kind));
  const query=makeIndex(solids),siteMap=new Map(),rejected=[];
  let clock=0,active=null,result=null,waypoint=null,serial=0,epoch=0,completed=0,cancelled=0;
  const cooldowns=new Map();
  function liveBoxes(x,z,r){const values=typeof getColliders==='function'?getColliders(x,z,r):[];return values&&typeof values[Symbol.iterator]==='function'?[...values].filter(validBox):[];}
  function ignored(b,site,fromCollider=false){return site.ignoreBoxIds.includes(b.id)||(fromCollider&&Number.isInteger(b.sourceIndex)&&site.ignoreBoxIds.includes(sourceBoxes[b.sourceIndex]?.id));}
  function clearRay(from,to,site,live=false){
    const x=(from.x+to.x)/2,z=(from.z+to.z)/2,r=horizontal(from,to)/2+.1,length=distance(from,to);
    if(!Number.isFinite(length)||length<EPS)return false;
    for(const b of query(x,z,r)){if(ignored(b,site))continue;const hit=segmentHit(from,to,b);if(hit!==null&&hit<1-.026/length)return false;}
    if(live)for(const b of liveBoxes(x,z,r)){if(ignored(b,site,true))continue;const hit=segmentHit(from,to,b);if(hit!==null&&hit<1-.026/length)return false;}
    if(live&&typeof lineOfSight==='function'&&lineOfSight(point(from),point(to),{site:copy(site),ignoreBoxIds:[...site.ignoreBoxIds],endpointTolerance:.026})!==true)return false;
    return true;
  }
  function clearFoot(position){
    const feet=ground(position.x,position.z),body={...position,y:feet+1.0,sx:.84,sy:1.8,sz:.84};
    return!query(position.x,position.z,1).some(b=>b.y+b.sy/2>feet+.30&&localOverlap(body,b));
  }
  function carBox(position,yaw){return{x:position.x,y:ground(position.x,position.z)+.69,z:position.z,sx:CAR.halfWidth*2+.08,sy:1.30,sz:CAR.halfLength*2+.08,ry:yaw};}
  function clearCar(position,yaw,live=false){
    const body=carBox(position,yaw),feet=ground(position.x,position.z),boxes=live?[...query(position.x,position.z,4),...liveBoxes(position.x,position.z,4)]:query(position.x,position.z,4);
    return !boxes.some(b=>b.id!=='VEHICLE-PLAYER'&&b.y+b.sy/2>feet+.30&&localOverlap(body,b));
  }
  function parkingFor(site,assembly){
    const road=(layout.roads||[]).find(r=>(r.name||r.id)===assembly.road);if(!road)return null;
    const n=site.normal,t={x:n.z,z:-n.x},wall=assembly.anchor;
    const roadDistance=(road.x-wall.x)*n.x+(road.z-wall.z)*n.z;
    if(roadDistance<10||roadDistance>25)return null;
    const wallTarget={x:site.target.x-n.x*((site.target.x-wall.x)*n.x+(site.target.z-wall.z)*n.z),y:0,z:site.target.z-n.z*((site.target.x-wall.x)*n.x+(site.target.z-wall.z)*n.z)};
    for(const depth of [4.2,5.2,6.2])for(const sign of [1,-1]){
      const center=add(wallTarget,n,depth),yaw=Math.atan2(-t.x*sign,-t.z*sign),path=[];
      for(let step=0;step<=64;step++){
        const s=step/64,e=s*s*(3-2*s),along=(-24+24*s)*sign,normalDistance=(roadDistance-6)+(depth-(roadDistance-6))*e;
        const p=add(add(wallTarget,n,normalDistance),{x:t.x,y:0,z:t.z},along);
        const dn=(depth-(roadDistance-6))*6*s*(1-s),dx=t.x*24*sign+n.x*dn,dz=t.z*24*sign+n.z*dn;
        const angle=Math.atan2(-dx,-dz);if(!clearCar(p,angle))break;
        path.push({...p,y:ground(p.x,p.z)+.008,yaw:angle});
      }
      if(path.length!==65||horizontal(center,site.target)>7)continue;
      return{...center,y:ground(center.x,center.z)+.008,yaw,halfWidth:CAR.halfWidth,halfLength:CAR.halfLength,
        positionTolerance:1.05,yawTolerance:.30,road:road.name||road.id,route:path,clearance:'65 oriented car footprints from the adjacent road lane'};
    }
    return null;
  }
  const candidates=[];
  for(const assembly of layout.streetDetails?.assemblies||[]){
    const definition=DEFINITIONS[assembly.district];if(!definition||assembly.courtyard)continue;
    const terminal=assembly.boxIds.map(id=>byId.get(id)).find(b=>b?.role==='access display');
    const panel=assembly.boxIds.map(id=>byId.get(id)).find(b=>b?.role==='access panel');if(!terminal||!panel)continue;
    const n=normal(terminal.ry||0),target=add(terminal,n,terminal.sz/2+.025),approach=add(target,n,1.6);approach.y=ground(approach.x,approach.z)+1.75;
    const site={id:'SERVICE-'+assembly.hostBuilding,type:definition.type,label:definition.label+' / '+assembly.hostBuilding.slice(1),district:assembly.district,
      description:definition.description,actionLabel:definition.actionLabel,duration:definition.duration,cooldown:definition.cooldown,
      assemblyId:assembly.id,hostBuilding:assembly.hostBuilding,sourceBoxId:terminal.id,sourceIndex:terminalIndices.get(terminal.id),
      target,normal:n,approach,inspectionVantage:assembly.inspectionVantage,terminalBounds:{x:terminal.x,y:terminal.y,z:terminal.z,sx:terminal.sx,sy:terminal.sy,sz:terminal.sz,ry:terminal.ry||0},
      ignoreBoxIds:[terminal.id,panel.id],range:RANGE};
    if(!clearFoot(approach)||!clearRay(approach,target,site)||!clearRay(assembly.inspectionVantage||approach,target,site)){rejected.push({assemblyId:assembly.id,reason:'Authored terminal or standing approach is obstructed'});continue;}
    if(site.type==='garage'){site.parking=parkingFor(site,assembly);if(!site.parking){rejected.push({assemblyId:assembly.id,reason:'No verified road-to-apron vehicle route'});continue;}}
    candidates.push(site);
  }
  const count=clamp(Math.floor(Number(sitesPerDistrict)||3),1,4);
  for(const [district] of Object.entries(DEFINITIONS)){
    const remaining=candidates.filter(s=>s.district===district).sort((a,b)=>a.id.localeCompare(b.id)),selected=[],center=(layout.districts||[]).find(d=>d.name===district)||{x:0,z:0};
    while(remaining.length&&selected.length<count){remaining.sort((a,b)=>selected.length?
      Math.min(...selected.map(s=>horizontal(s.target,b.target)))-Math.min(...selected.map(s=>horizontal(s.target,a.target)))||a.id.localeCompare(b.id):horizontal(a.target,center)-horizontal(b.target,center)||a.id.localeCompare(b.id));
      selected.push(remaining.shift());}
    for(const site of selected)siteMap.set(site.id,site);
  }
  const sites=[...siteMap.values()],destinations=sites.filter(s=>s.type!=='wayfinding');
  for(const [index,site] of sites.filter(s=>s.type==='wayfinding').entries())site.destinationCursor=index*count%Math.max(1,destinations.length);

  function reasonFor(site,context={},ongoing=false){
    const p=context.position,f=context.forward;
    if(!finitePoint(p)||!finitePoint(f)||Math.hypot(f.x,f.y,f.z)<EPS)return'Approach and face the terminal';
    if(context.alive===false||Number.isFinite(context.health)&&context.health<=0)return'Service unavailable while incapacitated';
    if(context.inVehicle)return'Exit the interceptor to use the terminal';
    if(context.paused||context.restarting)return'Service interrupted';
    if(context.moving||context.driving)return'Stop moving to use the terminal';
    const d=distance(p,site.target);if(d>RANGE)return'Move closer to the terminal';
    const outward=(p.x-site.target.x)*site.normal.x+(p.z-site.target.z)*site.normal.z;if(outward<.25)return'Use the street side of the terminal';
    const facing=((site.target.x-p.x)*f.x+(site.target.y-p.y)*f.y+(site.target.z-p.z)*f.z)/(d*Math.hypot(f.x,f.y,f.z));
    // A dock technician works behind the operator. Once started, let the
    // stationary player turn to inspect the car while all other checks remain.
    if(!Number.isFinite(facing)||facing<.70&&!(ongoing&&site.type==='garage'))return'Face the terminal';
    if(!clearRay(p,site.target,site,true))return'Terminal access is obstructed';
    if(!ongoing&&(cooldowns.get(site.id)||0)>clock)return'Service cooling down';
    if(site.type==='garage'){
      const car=context.vehiclePosition,park=site.parking;
      if(!finitePoint(car)||!Number.isFinite(context.vehicleYaw)||!Number.isFinite(context.vehicleSpeed))return'Park the interceptor in the service apron';
      if(horizontal(car,park)>park.positionTolerance)return'Park the interceptor in the service apron';
      if(Math.abs(Math.sin(context.vehicleYaw-park.yaw))>Math.sin(park.yawTolerance))return'Align the interceptor with the service apron';
      if(Math.abs(context.vehicleSpeed)>.15)return'Bring the interceptor to a complete stop';
      if(!clearCar(car,context.vehicleYaw,true))return'The service apron is obstructed';
      if(!ongoing&&Number.isFinite(context.carIntegrity)&&context.carIntegrity>=100)return'Interceptor already repaired';
    }
    if(!ongoing&&site.type==='clinic'&&Number.isFinite(context.health)&&context.health>=100)return'Health already full';
    if(!ongoing&&site.type==='recharge'&&Number.isFinite(context.energy)&&context.energy>=100)return'Neural energy already full';
    if(!ongoing&&site.type==='food'&&context.neuralBoostRemaining>0&&context.health>=100)return'Recovery boost is already active';
    return null;
  }
  function candidate(site,context){const reason=reasonFor(site,context);return{...copy(site),distance:finitePoint(context?.position)?distance(context.position,site.target):Infinity,
    available:!reason,cooldownRemaining:Math.max(0,(cooldowns.get(site.id)||0)-clock),reason};}
  function list(){return sites.map(site=>({...copy(site),cooldownRemaining:Math.max(0,(cooldowns.get(site.id)||0)-clock)}));}
  function findInteractable(context={}){
    if(!finitePoint(context.position)||!finitePoint(context.forward))return null;
    const p=context.position,f=context.forward,length=Math.hypot(f.x,f.y,f.z);if(length<EPS)return null;
    const near=sites.filter(site=>{
      const d=distance(p,site.target),facing=((site.target.x-p.x)*f.x+(site.target.y-p.y)*f.y+(site.target.z-p.z)*f.z)/(d*length);
      return d<=RANGE&&facing>=.70&&(p.x-site.target.x)*site.normal.x+(p.z-site.target.z)*site.normal.z>=.25;
    });
    near.sort((a,b)=>distance(context.position,a.target)-distance(context.position,b.target));
    return near.length?candidate(near[0],context):null;
  }
  function getState(){return{elapsed:clock,active:active?{id:active.site.id,type:active.site.type,label:active.site.label,duration:active.site.duration,remaining:Math.max(0,active.site.duration-active.elapsed),progress:clamp(active.elapsed/active.site.duration,0,1)}:null,
    result:copy(result),waypoint:copy(waypoint),completed,cancelledCount:cancelled,sites:sites.length,cooldowns:Object.fromEntries([...cooldowns].map(([id,time])=>[id,Math.max(0,time-clock)])),rejected:copy(rejected)};}
  function cancel(reason='Service cancelled'){
    if(!active)return{...getState(),cancelled:false,events:[]};
    const id=active.site.id;result={id,type:active.site.type,title:'Service interrupted',message:reason,success:false};active=null;cancelled++;
    return{...getState(),cancelled:true,events:[{type:'cancelled',id,reason,eventId:epoch+':'+(++serial)}]};
  }
  function begin(id,context={}){
    if(active)return{started:false,reason:'Another service is in progress',...getState()};
    const site=siteMap.get(id);if(!site)return{started:false,reason:'Unknown service',...getState()};
    const reason=reasonFor(site,context);if(reason)return{started:false,reason,...getState()};
    active={site,elapsed:0,position:point(context.position),vehiclePosition:finitePoint(context.vehiclePosition)?point(context.vehiclePosition):null,
      vehicleYaw:context.vehicleYaw,damageVersion:context.damageVersion,health:context.health};result=null;
    return{started:true,...getState()};
  }
  function outcomeFor(site){
    if(site.type==='food')return{healthDelta:25,neuralBoost:{duration:45,regenerationMultiplier:1.3}};
    if(site.type==='clinic')return{healthRestore:100};
    if(site.type==='recharge')return{energyDelta:60};
    if(site.type==='garage')return{repairVehicle:true,integrityRestore:100};
    if(!destinations.length)return{};
    const destination=destinations[site.destinationCursor++%destinations.length];waypoint={id:destination.id,label:destination.label,district:destination.district,...point(destination.approach),type:destination.type};return{waypoint:copy(waypoint)};
  }
  function update(dt,context={}){
    const events=[];if(!Number.isFinite(dt)||dt<0)return{...getState(),events};
    const step=Math.min(dt,.25);clock+=step;
    if(active){
      let reason=reasonFor(active.site,context,true);
      if(context.damaged||context.damageVersion!==active.damageVersion||Number.isFinite(context.health)&&Number.isFinite(active.health)&&context.health<active.health)reason='Damage interrupted the service';
      if(finitePoint(context.position)&&(horizontal(context.position,active.position)>.18||Math.abs(context.position.y-active.position.y)>.18))reason='Movement interrupted the service';
      if(active.site.type==='garage'&&finitePoint(context.vehiclePosition)&&active.vehiclePosition&&
        (horizontal(context.vehiclePosition,active.vehiclePosition)>.08||Number.isFinite(context.vehicleYaw)&&Math.abs(Math.sin(context.vehicleYaw-active.vehicleYaw))>.025))reason='The interceptor moved during repair';
      if(reason)events.push(...cancel(reason).events);
      else{
        active.elapsed+=step;
        if(active.elapsed+EPS>=active.site.duration){
          const site=active.site,outcome=outcomeFor(site);cooldowns.set(site.id,clock+site.cooldown);completed++;
          const messages={food:'Recovery meal dispensed. Neural regeneration boosted.',clinic:'Medical scan complete. Health restored.',garage:'Interceptor repairs complete.',recharge:'Neural recharge complete.',wayfinding:'Service waypoint updated.'};
          result={id:site.id,type:site.type,title:site.label,message:messages[site.type],success:true};
          events.push({type:'completed',id:site.id,eventId:epoch+':'+(++serial),outcome});active=null;
        }
      }
    }
    return{...getState(),events};
  }
  function reset(){clock=0;active=result=waypoint=null;completed=cancelled=serial=0;epoch++;cooldowns.clear();for(const[index,site]of sites.filter(s=>s.type==='wayfinding').entries())site.destinationCursor=index*count%Math.max(1,destinations.length);return getState();}
  return{list,findInteractable,begin,update,cancel,reset,getState};
}
