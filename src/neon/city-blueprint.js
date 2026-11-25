import { SCENE_PLACEMENTS } from './asset-placements.js';
// Authoritative structural rules and placement records shared by the game,
// Blender exporter, diagram viewer and independent clearance audit.
export const CITY_RULES=Object.freeze({roadWidth:22,clearDrivingHalfWidth:8,vehicleRadius:1.45,minimumOverheadClearance:5,minimumFacadeMargin:.38,wallMountOffset:.9,groundY:.05,baseGradeY:-.05,sidewalkBuildingSetback:4,units:'metres'});

function buildingRecords(layout) {
  return layout.colliders.filter(v=>v.sy>5&&v.sx>4&&v.sz>4).map((v,i)=>{
    const id='B'+String(i+1).padStart(3,'0');
    let sections=[];
    if(v.blockId)sections=layout.boxes.filter(b=>b.blockId===v.blockId&&b.kind==='solid'&&b.sy>5&&b.sx>v.sx*.24&&b.sz>v.sz*.24).map(b=>({x:b.x,y:b.y,z:b.z,sx:b.sx,sy:b.sy,sz:b.sz}));
    else sections=layout.boxes.filter(b=>b.lod!=='far'&&b.chunk===v.chunk&&b.kind==='solid'&&Math.abs(b.x-v.x)<.01&&Math.abs(b.z-v.z)<.01&&Math.abs(b.sx-v.sx)<.01&&Math.abs(b.sz-v.sz)<.01&&Math.abs(b.sy-v.sy)<.01).map(b=>({x:b.x,y:b.y,z:b.z,sx:b.sx,sy:b.sy,sz:b.sz}));
    if(!sections.length)sections=[{x:v.x,y:v.y,z:v.z,sx:v.sx,sy:v.sy,sz:v.sz}];
    sections.sort((a,b)=>a.y-a.sy/2-(b.y-b.sy/2));
    return {id,label:id+' / '+(v.chunk||'Kasumi skyline'),sourceId:v.blockId||v.chunk+'-'+i,chunk:v.chunk||'core',x:v.x,y:v.y,z:v.z,sx:v.sx,sy:v.sy,sz:v.sz,sections};
  });
}

export function enforceCityPlacements(layout) {
  const corrections={movedBuildings:[],removedBuildings:[],remountedSigns:0,removedLegacyMountParts:0,newSupports:0};
  // These secondary masses were physically intersecting the authored skyline or
  // newer parcels. Each move below is a named blueprint correction, not randomness.
  const moves=[];
  for(const c of layout.colliders) {
    if(c.blockId?.startsWith('core-building--1-')&&[-83,-111,-139].includes(c.z))moves.push({source:c,targetX:-68,targetZ:({[-83]:-96,[-111]:-122,[-139]:-149})[c.z]});
    if(c.blockId?.startsWith('core-building-1-')&&[-96,-124].includes(c.z))moves.push({source:c,targetX:68,targetZ:c.z===-96?-101:-130});
    if(c.blockId==='core-tower--24--231')moves.push({source:c,targetX:-41,targetZ:-237});
    if(c.blockId==='core-tower-25--233')moves.push({source:c,targetX:41,targetZ:-237});
  }
  const removedIds=new Set([1,12,15,20,22].map(n=>'core-background-'+n));
  const removal=layout.colliders.filter(c=>removedIds.has(c.blockId));
  corrections.removedBuildings=removal.map(c=>({sourceId:c.blockId,x:c.x,z:c.z,reason:'Redundant background footprint intersected another planned building.'}));
  layout.boxes=layout.boxes.filter(b=>!removedIds.has(b.blockId));
  layout.signs=layout.signs.filter(s=>!removedIds.has(s.blockId));
  layout.colliders=layout.colliders.filter(c=>!removedIds.has(c.blockId));
  for(const {source,targetX,targetZ} of moves) {
    const dx=targetX-source.x,dz=targetZ-source.z,oldX=source.x,oldZ=source.z;
    for(const box of layout.boxes) {
      const rooftop=!box.blockId&&box.y>source.sy-.6&&Math.abs(box.x-oldX)<source.sx/2+1&&Math.abs(box.z-oldZ)<source.sz/2+1;
      if(box.blockId===source.blockId||rooftop){box.x+=dx;box.z+=dz;}
    }
    for(const sign of layout.signs)if(sign.blockId===source.blockId){sign.x+=dx;sign.z+=dz;}
    const collider=layout.colliders.find(c=>c.blockId===source.blockId);collider.x=targetX;collider.z=targetZ;
    corrections.movedBuildings.push({sourceId:source.blockId,from:{x:oldX,z:oldZ},to:{x:targetX,z:targetZ},reason:'Separated intersecting building envelopes; preserved all roads.'});
  }
  const buildings=buildingRecords(layout),supports=[...(layout.supports||[])],connections=[...(layout.elevatedConnections||[])];
  let supportCounter=0;
  function support(x,y,z,sx,sy,sz,role,attachedTo,chunk='core',c='#455a6b') {
    const id='SUP-M'+String(++supportCounter).padStart(4,'0');
    const record={id,x,y,z,sx,sy,sz,baseY:y-sy/2,role,attachedTo,chunk};supports.push(record);
    layout.boxes.push({x,y,z,sx,sy,sz,c,kind:'metal',ry:0,chunk,lod:'near',supportId:id,detail:'blueprint-support'});return id;
  }
  function groundColumn(x,z,height,attachedTo,chunk='core') {
    const ids=[];ids.push(support(x,.18,z,.58,.26,.58,'foundation',attachedTo,chunk,'#526171'));
    ids.push(support(x,(height+.18)/2,z,.18,height-.18,.18,'ground column',attachedTo,chunk));return ids;
  }
  function rotatedSupport(x,y,z,sx,sy,sz,ry,role,attachedTo,c='#455a6b') {
    const id=support(x,y,z,sx,sy,sz,role,attachedTo,'core',c);
    supports[supports.length-1].ry=ry;layout.boxes[layout.boxes.length-1].ry=ry;return id;
  }
  // Remove old disconnected billboard slabs and their ungrounded struts. Actual
  // shop awnings and wall beams are retained; new mounts attach to building faces.
  const originalSigns=layout.signs.map(s=>({...s})),oldMounts=new Set(),mountBins=new Map();
  layout.boxes.forEach((v,i)=>{const key=Math.floor(v.x/25)+','+Math.floor(v.z/25);if(!mountBins.has(key))mountBins.set(key,[]);mountBins.get(key).push(i);});
  for(const sign of originalSigns) {
    if(Math.abs(sign.x+17.5)<.1&&Math.abs(sign.z-3.41)<.2&&sign.art==='portrait')continue;
    const normalX=Math.abs(Math.sin(sign.ry||0))>.7;
    const nearby=[];for(let bx=-1;bx<=1;bx++)for(let bz=-1;bz<=1;bz++)nearby.push(...(mountBins.get((Math.floor(sign.x/25)+bx)+','+(Math.floor(sign.z/25)+bz))||[]));
    nearby.forEach(i=>{const v=layout.boxes[i];
      if(v.supportId||v.kind==='pavement'||v.lod==='far')return;
      const tangent=normalX?v.sz:v.sx,thickness=normalX?v.sx:v.sz;
      const tangentDistance=normalX?Math.abs(v.z-sign.z):Math.abs(v.x-sign.x),normalDistance=normalX?Math.abs(v.x-sign.x):Math.abs(v.z-sign.z);
      const panel=thickness<.85&&tangent>sign.w*.76&&tangent<sign.w*1.5&&v.sy>sign.h*.76&&v.sy<sign.h*1.5&&Math.abs(v.y-sign.y)<.5&&normalDistance<1.6&&tangentDistance<.4;
      const orphanPole=sign.art==='campaign'&&v.sx<.21&&v.sz<.21&&v.sy>sign.h*.7&&v.sy<sign.h*1.6&&normalDistance<.65&&tangentDistance<sign.w*.55&&v.y<sign.y;
      if(panel||orphanPole)oldMounts.add(i);
    });
  }
  layout.boxes=layout.boxes.filter((_,i)=>!oldMounts.has(i));corrections.removedLegacyMountParts=oldMounts.size;
  const occupied=new Map(),physicalSigns=[];
  const panelBounds=s=>({x:s.x,y:s.y,z:s.z,sx:Math.abs(Math.cos(s.ry||0))*s.w+Math.abs(Math.sin(s.ry||0))*.14,sy:s.h,sz:Math.abs(Math.sin(s.ry||0))*s.w+Math.abs(Math.cos(s.ry||0))*.14});
  const freePhysical=s=>{const a=panelBounds(s);return !physicalSigns.some(v=>Math.abs(a.x-v.x)<(a.sx+v.sx)/2+.06&&Math.abs(a.y-v.y)<(a.sy+v.sy)/2+.12&&Math.abs(a.z-v.z)<(a.sz+v.sz)/2+.06);};
  function freeRect(key,t,y,w,h) {
    return !(occupied.get(key)||[]).some(r=>Math.abs(t-r.t)<(w+r.w)/2+.12&&Math.abs(y-r.y)<(h+r.h)/2+.12);
  }
  function claim(key,t,y,w,h){if(!occupied.has(key))occupied.set(key,[]);occupied.get(key).push({t,y,w,h});}
  for(let index=0;index<layout.signs.length;index++) {
    const sign=layout.signs[index],old={x:sign.x,y:sign.y,z:sign.z};sign.id='AD'+String(index+1).padStart(3,'0');
    const preserved=Math.abs(sign.x+17.5)<.1&&Math.abs(sign.z-3.41)<.2&&sign.art==='portrait';
    if(preserved) {
      sign.mountType='freestanding-frame';sign.attachedTo='HERO-AD-FRAME';sign.anchor={x:sign.x,y:.05,z:sign.z-.65};
      sign.supportIds=[...groundColumn(sign.x-3.1,sign.z-.65,28.6,sign.attachedTo),...groundColumn(sign.x+3.1,sign.z-.65,28.6,sign.attachedTo)];
      sign.supportIds.push(support(sign.x,28.55,sign.z-.65,6.35,.17,.18,'top crossbeam',sign.attachedTo));
      sign.supportIds.push(support(sign.x,13.65,sign.z-.65,6.35,.17,.18,'bottom crossbeam',sign.attachedTo));
      for(const side of [-1,1])for(const y of [13.7,28.3]) {
        const xx=sign.x+side*3.1,frameZ=3.15-Math.sin(.14)*side*3.1,postZ=sign.z-.65;
        sign.supportIds.push(support(xx,y,(frameZ+postZ)/2,.14,.14,Math.abs(frameZ-postZ)+.24,'frame-to-column tie',sign.attachedTo));
      }
      physicalSigns.push(panelBounds(sign));
      continue;
    }
    const landmarkRoof=Math.abs(sign.x-23)<.1&&Math.abs(sign.z+43)<.1?'B017':Math.abs(sign.x+23)<.1&&Math.abs(sign.z+61)<.1?'B004':null;
    const landmarkMarquee=sign.text==='NOODLES'&&Math.abs(sign.x+12.8)<.1&&Math.abs(sign.z-12)<.1;
    if(landmarkRoof||landmarkMarquee) {
      const building=buildings.find(b=>b.id===(landmarkRoof||'B001'));
      const ry=sign.ry||0,cos=Math.cos(ry),sin=Math.sin(ry),local=(lx,ly,lz)=>({x:sign.x+lx*cos+lz*sin,y:sign.y+ly,z:sign.z-lx*sin+lz*cos});
      sign.attachedTo=building.id;sign.supportIds=[];
      sign.mountType=landmarkRoof?'rooftop-cantilever-frame':'projecting-marquee';
      sign.mountName=landmarkRoof==='B017'?'AXIOM rooftop frame':landmarkRoof==='B004'?'KURO rooftop frame':'NOODLES cantilever marquee';
      const panel=local(0,0,-.08);
      sign.supportIds.push(rotatedSupport(panel.x,panel.y,panel.z,sign.w+.14,sign.h+.14,.18,ry,'landmark panel backing',building.id,'#263a4c'));
      for(const end of [-1,1]) {
        const post=local(end*sign.w*.36,0,-.24);
        sign.supportIds.push(rotatedSupport(post.x,post.y,post.z,.16,sign.h+.42,.2,ry,'landmark frame upright',building.id));
      }
      for(const end of [-1,1]) {
        const rail=local(0,end*(sign.h/2+.13),-.24);
        sign.supportIds.push(rotatedSupport(rail.x,rail.y,rail.z,sign.w+.15,.18,.2,ry,'landmark frame crossbeam',building.id));
      }
      if(landmarkRoof) {
        const section=building.sections[0],roofY=section.y+section.sy/2;
        sign.anchor={x:Math.max(section.x-section.sx/2+.8,Math.min(section.x+section.sx/2-.8,sign.x)),y:roofY,z:Math.max(section.z-section.sz/2+.8,Math.min(section.z+section.sz/2-.8,sign.z))};
        for(const end of [-1,1]) {
          const rear=local(end*sign.w*.36,-sign.h/2-.14,-.24);
          const ax=Math.max(section.x-section.sx/2+.65,Math.min(section.x+section.sx/2-.65,rear.x));
          const az=Math.max(section.z-section.sz/2+.8,Math.min(section.z+section.sz/2-.8,rear.z));
          sign.supportIds.push(support(ax,roofY+.04,az,.7,.17,.7,'roof anchor plate',building.id));
          sign.supportIds.push(support(ax,(roofY+rear.y)/2,az,.2,rear.y-roofY+.12,.2,'roof riser',building.id));
          sign.supportIds.push(support((ax+rear.x)/2,rear.y,(az+rear.z)/2,Math.abs(ax-rear.x)+.22,.22,Math.abs(az-rear.z)+.24,'roof cantilever beam',building.id));
        }
      } else {
        const section=building.sections[0],wallX=section.x+section.sx/2;
        sign.anchor={x:wallX,y:sign.y,z:sign.z};
        for(const end of [-1,1])for(const up of [-1,1]) {
          const rear=local(end*sign.w*.36,up*sign.h*.32,-.24);
          sign.supportIds.push(support(wallX+.015,rear.y,rear.z,.17,.3,.28,'marquee wall plate',building.id));
          sign.supportIds.push(support((wallX+rear.x)/2,rear.y,rear.z,Math.abs(wallX-rear.x)+.2,.14,.16,'marquee wall bracket',building.id));
        }
      }
      corrections.remountedSigns++;physicalSigns.push(panelBounds(sign));continue;
    }
    if(sign.chunk==='infrastructure') {
      sign.mountType='gantry';sign.attachedTo='GANTRY-'+sign.id;sign.anchor={x:sign.x,y:.05,z:sign.z-.12};
      const top=sign.y+sign.h/2+.4;
      sign.supportIds=[...groundColumn(sign.x-13.4,sign.z-.17,top,sign.attachedTo,'infrastructure'),...groundColumn(sign.x+13.4,sign.z-.17,top,sign.attachedTo,'infrastructure')];
      sign.supportIds.push(support(sign.x,top,sign.z-.17,26.9,.19,.21,'gantry crossbeam',sign.attachedTo,'infrastructure'));
      sign.supportIds.push(support(sign.x,sign.y,sign.z-.1,sign.w+.12,sign.h+.12,.15,'sign backing',sign.attachedTo,'infrastructure','#213848'));
      for(const side of [-1,1])sign.supportIds.push(support(sign.x+side*sign.w*.4,top-.3,sign.z-.17,.07,.65,.11,'panel hanger',sign.attachedTo,'infrastructure'));
      physicalSigns.push(panelBounds(sign));
      corrections.remountedSigns++;continue;
    }
    const local=buildings.filter(b=>sign.chunk?b.chunk===sign.chunk:b.chunk==='core');
    const candidates=local.length?local:buildings;
    const building=candidates.reduce((best,b)=>{
      const score=Math.hypot(Math.max(0,Math.abs(sign.x-b.x)-b.sx/2),Math.max(0,Math.abs(sign.z-b.z)-b.sz/2))+Math.abs(sign.y-Math.min(sign.y,b.sy))*.15;
      return !best||score<best.score?{b,score}:best;
    },null)?.b;
    if(!building)continue;
    const section=building.sections.find(s=>sign.y>=s.y-s.sy/2&&sign.y<=s.y+s.sy/2)||building.sections.reduce((a,b)=>Math.abs(a.y-sign.y)<Math.abs(b.y-sign.y)?a:b);
    const bottom=section.y-section.sy/2,top=section.y+section.sy/2;
    sign.h=Math.min(sign.h,Math.max(.55,section.sy-.75));
    let normalX,side;
    if(sign.art==='type') {normalX=true;side=sign.x>=section.x?1:-1;}
    else {normalX=Math.abs(Math.sin(sign.ry||0))>.7;side=normalX?(sign.x>=section.x?1:-1):(sign.z>=section.z?1:-1);}
    const faceWidth=normalX?section.sz:section.sx,tangentCenter=normalX?section.z:section.x;
    sign.w=Math.min(sign.w,Math.max(.55,faceWidth-.8));
    let t=Math.max(tangentCenter-faceWidth/2+sign.w/2+.4,Math.min(tangentCenter+faceWidth/2-sign.w/2-.4,normalX?sign.z:sign.x));
    let y=Math.max(bottom+sign.h/2+.35,Math.min(top-sign.h/2-.35,sign.y));
    const face=normalX?section.x+side*section.sx/2:section.z+side*section.sz/2;
    const key=[building.id,section.y,normalX?'x':'z',side].join('|');
    for(let attempt=0;attempt<8;attempt++) {
      let found=null;
      for(const dy of [0,sign.h+.35,-sign.h-.35,2*(sign.h+.35),-2*(sign.h+.35)])for(const dt of [0,sign.w+.35,-sign.w-.35,2*(sign.w+.35),-2*(sign.w+.35)]) {
        const nt=Math.max(tangentCenter-faceWidth/2+sign.w/2+.4,Math.min(tangentCenter+faceWidth/2-sign.w/2-.4,t+dt));
        const ny=Math.max(bottom+sign.h/2+.35,Math.min(top-sign.h/2-.35,y+dy));
        const candidate=sign.art==='type'?{x:face+side*(sign.w/2+.5),y:ny,z:nt,w:sign.w,h:sign.h,ry:0}:{x:normalX?face+side*CITY_RULES.wallMountOffset:nt,y:ny,z:normalX?nt:face+side*CITY_RULES.wallMountOffset,w:sign.w,h:sign.h,ry:normalX?side*Math.PI/2:side<0?Math.PI:0};
        if(!found&&freeRect(key,nt,ny,sign.w,sign.h)&&freePhysical(candidate))found={t:nt,y:ny};
      }
      if(found){t=found.t;y=found.y;break;}
      sign.w*=.78;sign.h*=.78;
    }
    claim(key,t,y,sign.w,sign.h);sign.y=y;sign.attachedTo=building.id;sign.supportIds=[];
    if(sign.art==='type') {
      sign.x=face+side*(sign.w/2+.5);sign.z=t;sign.ry=0;sign.mountType='projecting-blade';sign.anchor={x:face,y,z:t};
      const offset=sign.w/2+.5;
      sign.supportIds.push(support(sign.x,y,t-.1,sign.w+.12,sign.h+.12,.16,'blade backing',building.id,sign.chunk));
      for(const dy of [-sign.h*.35,sign.h*.35])sign.supportIds.push(support(face+side*offset/2,y+dy,t-.12,offset+.1,.10,.16,'blade wall bracket',building.id,sign.chunk));
    } else {
      const offset=CITY_RULES.wallMountOffset;
      sign.x=normalX?face+side*offset:t;sign.z=normalX?t:face+side*offset;
      sign.ry=normalX?side*Math.PI/2:side<0?Math.PI:0;sign.mountType='wall-panel';sign.anchor={x:normalX?face:t,y,z:normalX?t:face};
      sign.supportIds.push(support(normalX?face+side*(offset-.1):t,y,normalX?t:face+side*(offset-.1),normalX?.15:sign.w+.12,sign.h+.12,normalX?sign.w+.12:.15,'wall panel backing',building.id,sign.chunk));
      for(const tangent of [-sign.w*.36,sign.w*.36])for(const yy of [-sign.h*.34,sign.h*.34])sign.supportIds.push(support(normalX?face+side*offset*.45:t+tangent,y+yy,normalX?t+tangent:face+side*offset*.45,normalX?offset:.10,.10,normalX?.10:offset,'wall stand-off',building.id,sign.chunk));
    }
    corrections.remountedSigns++;
    physicalSigns.push(panelBounds(sign));
    sign.previousPosition=old;
  }
  // Footings extend into the actual base slab, including the unpaved gaps between
  // parcels. Their tops stay fixed so columns remain in continuous contact.
  for(const footing of supports)if(footing.role==='foundation'&&footing.baseY>CITY_RULES.baseGradeY) {
    const extension=footing.baseY-CITY_RULES.baseGradeY;
    footing.y-=extension/2;footing.sy+=extension;footing.baseY=CITY_RULES.baseGradeY;
    const box=layout.boxes.find(b=>b.supportId===footing.id);if(box){box.y=footing.y;box.sy=footing.sy;}
  }
  corrections.newSupports=supportCounter;layout.supports=supports;layout.elevatedConnections=connections;layout.placementCorrections=corrections;
  layout.buildings=buildings;
  layout.blueprint=createCityBlueprint(layout);return layout;
}

export function createCityBlueprint(layout) {
  if(!layout)throw new Error('createCityBlueprint requires a completed createCityLayout() result.');
  const buildings=layout.buildings||buildingRecords(layout);
  return {
    version:1,units:'metres',bounds:{...layout.bounds},rules:{...CITY_RULES},
    roads:(layout.roads||[]).map((r,i)=>({id:'R'+String(i+1).padStart(2,'0'),...r,label:r.name||'City road'})),
    parcels:(layout.chunks||[]).map((p,i)=>({id:'P'+String(i+1).padStart(2,'0'),label:p.district,chunk:p.id,x:p.x,z:p.z,sx:p.sx||p.width||p.radius*1.25,sz:p.sz||p.depth||p.radius*1.25,district:p.district})).concat(buildings.filter(b=>b.chunk==='core').map(b=>({id:'P-'+b.id,label:b.label,chunk:'core',x:b.x,z:b.z,sx:b.sx+.8,sz:b.sz+.8,district:'Kasumi Ward',role:'individual core plot'}))),
    buildings:buildings.map(b=>({...b})),
    signs:layout.signs.map(s=>({id:s.id,x:s.x,y:s.y,z:s.z,w:s.w,h:s.h,ry:s.ry||0,label:s.text,art:s.art,attachedTo:s.attachedTo,mountType:s.mountType,mountName:s.mountName,anchor:s.anchor,supportIds:s.supportIds||[],chunk:s.chunk||'core'})),
    supports:(layout.supports||[]).map(s=>({...s})),elevatedConnections:(layout.elevatedConnections||[]).map(c=>({...c})),props:Object.values(SCENE_PLACEMENTS).map(p=>({...p})),districts:layout.districts,corrections:layout.placementCorrections||{}
  };
}

/** A large commissioned screen has its own connected frame, behind the image.
 * Coordinates remain in the same metres as the shared building and road plan. */
export function mountCampaignFrame(layout, sign, plan) {
  const building=layout.buildings.find(b=>b.id===plan.buildingId);
  if(!building)throw new Error('Missing campaign host '+plan.buildingId);
  const section=building.sections[plan.sectionIndex||0];
  if(!section||![sign.x,sign.y,sign.z,sign.w,sign.h,sign.ry,plan.offset].every(Number.isFinite)||Math.min(sign.w,sign.h)<=0||plan.offset<.25)
    throw new Error('Invalid campaign frame geometry for '+sign.id);
  const normal={x:Math.sin(sign.ry),z:Math.cos(sign.ry)},tangent={x:Math.cos(sign.ry),z:-Math.sin(sign.ry)};
  const at=(t,y,n)=>({x:sign.x+t*tangent.x+n*normal.x,y,z:sign.z+t*tangent.z+n*normal.z});
  sign.supportIds=[];sign.attachedTo=building.id;sign.mountType=plan.mountType;
  sign.mountName=sign.text+' / engineered street display';sign.roadVantage={...plan.roadVantage};
  sign.anchor={x:plan.anchor.x,y:plan.anchor.y,z:plan.anchor.z};
  const add=(t,y,n,w,h,d,role,color='#43576b')=>{
    const p=at(t,y,n),id='SUP-C-'+sign.id+'-'+String(sign.supportIds.length+1).padStart(2,'0');
    const box={...p,sx:w,sy:h,sz:d,ry:sign.ry,c:color,kind:'metal',chunk:sign.chunk,lod:'near',supportId:id,detail:'campaign-frame'};
    layout.boxes.push(box);layout.supports.push({id,...p,sx:w,sy:h,sz:d,ry:sign.ry,baseY:y-h/2,role,attachedTo:building.id,chunk:sign.chunk});sign.supportIds.push(id);
  };
  add(0,sign.y,-.15,sign.w+.18,sign.h+.18,.24,'campaign panel backing','#152b3c');
  for(const edge of [-1,1]) {
    add(edge*(sign.w/2+.22),sign.y,-.14,.28,sign.h+.72,.32,'campaign frame upright');
    add(0,sign.y+edge*(sign.h/2+.22),-.14,sign.w+.72,.28,.32,'campaign frame crossbeam');
  }
  const toWall=plan.offset;
  if(plan.mountType==='campaign-wall-frame') {
    for(const t of [-sign.w*.35,sign.w*.35])for(const yy of [-sign.h*.35,sign.h*.35]) {
      add(t,sign.y+yy,-toWall,.7,.65,.24,'campaign wall anchor plate');
      add(t,sign.y+yy,-(toWall+.2)/2,.22,.22,toWall-.2+.24,'campaign wall stand-off');
    }
  } else {
    const roof=section.y+section.sy/2,postNormal=-toWall-.9,top=sign.y+sign.h/2+.2,feet=[];
    if(top<=roof+.3||Math.min(section.sx,section.sz)<1.1)throw new Error('Campaign roof frame needs a valid host roof: '+sign.id);
    for(const t of [-sign.w*.35,sign.w*.35]) {
      const desired=at(t,roof,postNormal),margin=.5;
      const foot={x:Math.max(section.x-section.sx/2+margin,Math.min(section.x+section.sx/2-margin,desired.x)),y:roof,
        z:Math.max(section.z-section.sz/2+margin,Math.min(section.z+section.sz/2-margin,desired.z))};
      const footT=(foot.x-sign.x)*tangent.x+(foot.z-sign.z)*tangent.z,footN=(foot.x-sign.x)*normal.x+(foot.z-sign.z)*normal.z;
      if(footN>-.3)throw new Error('Campaign roof masts must remain behind artwork: '+sign.id);
      feet.push(foot);
      add(footT,roof+.04,footN,.85,.2,.85,'campaign roof anchor plate');
      add(footT,(roof+top)/2,footN,.27,top-roof+.16,.27,'campaign roof mast');
      for(const yy of [-sign.h*.35,sign.h*.35]) {
        add(footT,sign.y+yy,(footN-.15)/2,.23,.23,-footN+.08,'campaign roof cantilever');
        if(Math.abs(footT-t)>.02)add((footT+t)/2,sign.y+yy,-.15,Math.abs(footT-t)+.23,.23,.23,'campaign rear transfer beam');
      }
    }
    sign.anchor={x:(feet[0].x+feet[1].x)/2,y:roof,z:(feet[0].z+feet[1].z)/2};
  }
  // Narrow illuminated insets sit on the exterior frame, outside the artwork.
  for(const edge of [-1,1]) {
    const p=at(edge*(sign.w/2+.22),sign.y,.035);
    layout.boxes.push({...p,sx:.055,sy:sign.h+.4,sz:.035,ry:sign.ry,c:sign.tint,kind:'glow',chunk:sign.chunk,lod:'near',detail:'campaign-frame-light'});
  }
  return sign;
}
