// Deterministic, physically attached ground-floor craft. This layer consumes the
// corrected blueprint rather than inventing independent street coordinates.
export const STREET_DETAIL_RULES=Object.freeze({maximumHeight:4.5,sidewalkReserve:14.6,maximumProjection:1.05,facadeMargin:.7,approachDepth:2.4});

const THEMES={
  'Lantern Market':{type:'food-hatch',wall:'#704a38',edge:'#c78b58',dark:'#241c1c',accent:'#ff9e46',paint:'#a44432'},
  'Iron Docks':{type:'service-garage',wall:'#445d64',edge:'#9c9776',dark:'#15262d',accent:'#eabd55',paint:'#76603f'},
  'Stacktown':{type:'residential-entry',wall:'#494457',edge:'#947797',dark:'#1b2130',accent:'#d85dac',paint:'#57405f'},
  'Meridian East':{type:'clinic-entry',wall:'#779392',edge:'#b4c9be',dark:'#16313e',accent:'#a8e986',paint:'#406879'},
  'Crown Plaza':{type:'concierge-entry',wall:'#3a5268',edge:'#b6a279',dark:'#1a2838',accent:'#78b8d5',paint:'#5b617d'}
};
const boxBounds=b=>{
  const c=Math.abs(Math.cos(b.ry||0)),s=Math.abs(Math.sin(b.ry||0));
  return {minX:b.x-(c*b.sx+s*b.sz)/2,maxX:b.x+(c*b.sx+s*b.sz)/2,minY:b.y-b.sy/2,maxY:b.y+b.sy/2,minZ:b.z-(s*b.sx+c*b.sz)/2,maxZ:b.z+(s*b.sx+c*b.sz)/2};
};
const overlaps=(a,b,gap=0)=>a.minX<b.maxX+gap&&a.maxX>b.minX-gap&&a.minY<b.maxY+gap&&a.maxY>b.minY-gap&&a.minZ<b.maxZ+gap&&a.maxZ>b.minZ-gap;

// Axis-aligned subtraction is exact here: the outer building facade skins are
// authored at quarter turns. It leaves the surrounding rails and glazing in
// place while removing only the occupied doorway / utility inset aperture.
function subtractBounds(source,cut){
  if(!overlaps(source,cut))return[source];
  const lo={x:Math.max(source.minX,cut.minX),y:Math.max(source.minY,cut.minY),z:Math.max(source.minZ,cut.minZ)};
  const hi={x:Math.min(source.maxX,cut.maxX),y:Math.min(source.maxY,cut.maxY),z:Math.min(source.maxZ,cut.maxZ)};
  const pieces=[];
  function part(minX,maxX,minY,maxY,minZ,maxZ){if(Math.min(maxX-minX,maxY-minY,maxZ-minZ)>.002)pieces.push({minX,maxX,minY,maxY,minZ,maxZ});}
  part(source.minX,lo.x,source.minY,source.maxY,source.minZ,source.maxZ);
  part(hi.x,source.maxX,source.minY,source.maxY,source.minZ,source.maxZ);
  part(lo.x,hi.x,source.minY,lo.y,source.minZ,source.maxZ);
  part(lo.x,hi.x,hi.y,source.maxY,source.minZ,source.maxZ);
  part(lo.x,hi.x,lo.y,hi.y,source.minZ,lo.z);
  part(lo.x,hi.x,lo.y,hi.y,hi.z,source.maxZ);
  return pieces;
}

function facade(building,axis,side,roads,courtyard=false){
  const section=building.sections[0],nx=axis==='x'?side:0,nz=axis==='z'?side:0;
  const x=section.x+nx*section.sx/2,z=section.z+nz*section.sz/2;
  const width=axis==='x'?section.sz:section.sx,ry=Math.atan2(nx,nz);
  if(width<5.8)return null;
  const candidates=roads.filter(r=>axis==='x'?r.sz>r.sx:r.sx>r.sz).map(r=>{
    const signed=(axis==='x'?r.x-x:r.z-z)*side;
    const tangentDistance=axis==='x'?Math.abs(z-r.z):Math.abs(x-r.x);
    const length=axis==='x'?r.sz:r.sx;
    return {r,distance:signed,tangentDistance,length};
  }).filter(v=>v.distance>0&&v.tangentDistance<v.length/2-2).sort((a,b)=>a.distance-b.distance);
  const road=candidates[0];
  if(!courtyard&&(!road||road.distance>24||road.distance<STREET_DETAIL_RULES.sidewalkReserve+.6))return null;
  const projection=road?Math.min(1.02,road.distance-STREET_DETAIL_RULES.sidewalkReserve):1.02;
  if(projection<.6)return null;
  return {x,z,nx,nz,ry,width,section,road:road?.r.name||null,roadDistance:road?.distance||null,projection,courtyard};
}

export function createStreetDetails(layout){
  const boxes=[],supports=[],assemblies=[],facadeCuts=[],chunks=new Map(layout.chunks.map(c=>[c.id,c]));
  const oldGround=new Map();
  layout.boxes.forEach((box,index)=>{
    if(box.lod==='far'||!['metal','solid','window'].includes(box.kind)||box.y-box.sy/2>=4.5||box.y+box.sy/2<.25)return;
    const list=oldGround.get(box.chunk)||[];list.push({box,index,bounds:boxBounds(box)});oldGround.set(box.chunk,list);
  });
  const existingSigns=layout.signs.map(s=>({id:s.id,...boxBounds({x:s.x,y:s.y,z:s.z,sx:s.w,sy:s.h,sz:.2,ry:s.ry})}));
  const groundBoxes=layout.boxes.filter(b=>b.kind==='pavement'&&b.sx>=1&&b.sz>=1&&b.y+b.sy/2>.08&&b.y+b.sy/2<.4);
  const groundAt=(x,z)=>groundBoxes.reduce((height,b)=>Math.abs(x-b.x)<=b.sx/2&&Math.abs(z-b.z)<=b.sz/2?Math.max(height,b.y+b.sy/2):height,.057);
  function assembly(building,face,variant,offset){
    const chunk=chunks.get(building.chunk),theme=THEMES[chunk.district];if(!theme)return;
    const id='STREET-CRAFT-'+building.id+(face.courtyard?'-COURT':'-FRONT');
    const base=groundAt(face.x+face.nx*.2,face.z+face.nz*.2),nScale=face.projection/1.02;
    const local=[],localSupports=[],panelHalf=1.61;
    const transform=(t,y,n)=>({x:face.x+Math.cos(face.ry)*(t+offset)+face.nx*n*nScale,y:base+y,z:face.z-Math.sin(face.ry)*(t+offset)+face.nz*n*nScale});
    function add(t,y,n,w,h,d,c,kind='metal',role='facade detail',structural=false){
      // Existing shop panels begin around3.47m: the canopy is tucked beneath
      // that reserved band instead of obscuring the old signage.
      if(y>=3.12)y-=.32;
      const boxId=id+'-'+String(local.length+1).padStart(3,'0'),p=transform(t,y,n);
      const b={id:boxId,...p,sx:w,sy:h,sz:d*nScale,ry:face.ry,c,kind,chunk:building.chunk,lod:'near',detail:'street-craft',assemblyId:id,attachedTo:building.id,role};
      if(structural){b.supportId='SUP-'+boxId;localSupports.push({id:b.supportId,...p,sx:w,sy:h,sz:d*nScale,ry:face.ry,baseY:p.y-h/2,role,attachedTo:building.id,chunk:building.chunk});}
      local.push(b);return b;
    }
    // A continuous backplate enters the actual host wall by20mm. Every raised
    // trim, hinge, display and canopy has a contact path through this substrate.
    add(0,1.55,.10,3.52,3.10,.24,theme.wall,'solid','anchored masonry surround',true);
    add(0,1.37,.27,2.82,2.57,.12,theme.dark,'metal','closed inset door');
    for(const side of [-1,1]){
      add(side*panelHalf,1.54,.32,.25,3.10,.38,theme.edge,'metal','door jamb',true);
      add(side*1.41,1.52,.365,.06,2.80,.15,theme.paint);
      for(const y of [.38,2.58])add(side*panelHalf,y,.523,.095,.11,.06,'#798689','metal','exposed frame bolt');
    }
    add(0,.12,.31,3.42,.24,.57,theme.edge,'metal','grounded threshold',true);
    add(0,2.95,.31,3.42,.28,.45,theme.edge,'metal','door lintel',true);
    add(0,3.22,.23,3.64,.31,.47,theme.paint,'metal','canopy wall beam',true);
    // Shallow canopy: roof directly meets the wall and two knee brackets join
    // its underside to the lintel; nothing hangs from an unconnected box.
    add(0,3.41,.45,3.92,.15,1.08,theme.paint,'metal','wall-mounted canopy',true);
    for(const side of [-1,1]){
      add(side*1.55,3.27,.45,.12,.16,1.06,theme.edge,'metal','canopy tie',true);
      add(side*1.55,3.12,.13,.14,.30,.40,theme.edge,'metal','canopy wall bracket',true);
    }
    add(0,3.38,1.007,3.68,.12,.035,theme.edge,'metal','canopy lip');
    add(0,3.33,.96,2.85,.045,.055,theme.accent,'glow','canopy tube');
    const mid=variant%3===0?-.54:.54;
    if(theme.type==='food-hatch'){
      add(0,1.76,.349,2.75,1.3,.07,'#886543','metal','serving hatch backing');
      for(let row=0;row<5;row++)add(0,1.22+row*.26,.402,2.65,.09,.08,row%2?theme.edge:theme.paint,'metal','hatch shutter slat');
      add(0,1.10,.53,2.88,.13,.67,theme.edge,'metal','folded serving counter',true);
      for(let stripe=0;stripe<7;stripe++)add(-1.65+stripe*.55,3.497,.45,.25,.025,1.05,stripe%2?'#b34932':'#d0a06b','solid','striped canopy fabric');
      for(const side of [-1,1]){add(side*1.25,2.39,.42,.18,.17,.12,theme.paint);add(side*1.25,2.39,.489,.11,.10,.045,'#ffb25d','glow','hatch status lamp');}
    }else if(theme.type==='service-garage'){
      for(let row=0;row<9;row++)add(0,.36+row*.28,.355,2.75,.21,.07,row%3===variant%3?theme.wall:'#536875','metal','roller door slat');
      add(0,.56,.43,.48,.12,.15,'#a7a28c','metal','recessed pull');
      for(const side of [-1,1])for(let stripe=0;stripe<5;stripe++)add(side*panelHalf,.28+stripe*.25,.526,.22,.12,.035,stripe%2?'#b99c4d':'#263641','solid','jamb hazard stripe');
    }else{
      for(const side of [-1,1]){
        add(side*.69,1.4,.348,1.27,2.49,.07,theme.paint,'metal','door leaf');
        add(side*.69,1.92,.395,1.04,1.00,.035,theme.type==='clinic-entry'?'#82b9c0':'#496b7f','window','inset door glazing');
        add(side*.11,1.15,.455,.055,.43,.16,theme.edge,'metal','door pull');
        add(side*.69,.66,.398,1.09,.19,.038,theme.edge,'metal','door kick plate');
      }
      add(0,1.4,.396,.055,2.54,.04,theme.edge,'metal','meeting stile');
      if(theme.type==='clinic-entry'){
        add(mid,1.92,.429,.45,.08,.04,theme.accent,'glow','medical cross');
        add(mid,1.92,.429,.08,.45,.04,theme.accent,'glow','medical cross');
      }else if(theme.type==='concierge-entry'){
        for(const side of [-1,1])for(let rib=0;rib<3;rib++)add(side*(1.54+rib*.06),1.54,.524,.025,2.84,.04,'#ae9875','metal','fluted bronze jamb');
      }else{
        for(let slot=0;slot<4;slot++)add(-.92+slot*.62,.48,.396,.37,.10,.04,'#83909c','metal','resident mail slot');
      }
    }
    // Access control and a compact service panel are mounted directly on the
    // surround. Their wiring is a continuous L rather than disconnected specks.
    add(1.47,1.33,.56,.29,.59,.22,theme.dark,'metal','access panel',true);
    add(1.47,1.46,.685,.19,.20,.05,theme.accent,'window','access display');
    for(let button=0;button<3;button++)add(1.40+button*.065,1.23,.688,.038,.046,.04,theme.edge,'metal','access keys');
    add(-1.68,1.5,.537,.055,1.61,.09,theme.paint,'metal','sealed cable riser');
    add(-1.39,2.27,.537,.61,.055,.09,theme.paint,'metal','sealed cable bend');
    const utilityT=variant%2?-2.43:2.43;
    add(utilityT,2.13,.17,.94,1.3,.4,theme.wall,'metal','wall-mounted service cabinet',true);
    add(utilityT,2.13,.405,.76,1.07,.16,theme.dark,'metal','service cabinet inset');
    if(theme.type==='clinic-entry'){
      for(let bar=0;bar<5;bar++)add(utilityT-.22+bar*.11,2.05+(bar%3)*.06,.503,.055,.37+(bar%3)*.12,.05,bar%2?theme.edge:theme.accent,'window','diagnostic indicator');
    }else{
      for(let fin=0;fin<6;fin++)add(utilityT,1.72+fin*.16,.503,.65,.06,.05,theme.type==='concierge-entry'?theme.edge:'#7d9194','metal','vent louvre');
    }
    add(utilityT+.44,1.30,.28,.13,2.23,.13,theme.paint,'metal','continuous utility pipe',true);
    for(const y of [.42,1.31,2.21])add(utilityT+.44,y,.30,.20,.11,.19,theme.edge,'metal','pipe collar');
    // Every host gets a stable two-digit unit identity built from attached
    // segmented metal inlays; no new billboard surfaces or random decals.
    add(-.67,2.72,.41,.78,.27,.16,theme.dark,'metal','unit number plate');
    const digits=String(Number(building.id.slice(1))%100).padStart(2,'0'),segments=['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'];
    const digitLines={a:[0,.09,.12,.022],b:[.065,.045,.022,.08],c:[.065,-.045,.022,.08],d:[0,-.09,.12,.022],e:[-.065,-.045,.022,.08],f:[-.065,.045,.022,.08],g:[0,0,.12,.022]};
    for(let digit=0;digit<2;digit++)for(const line of segments[Number(digits[digit])]){const [x,y,w,h]=digitLines[line];add(-.83+digit*.29+x,2.72+y,.502,w,h,.035,theme.edge,'metal','unit identifier');}
    // Larger deliberate wear patches follow the lower kick zones; clean clinics
    // and concierge entrances retain their manufactured finish.
    if(theme.type!=='clinic-entry'&&theme.type!=='concierge-entry')for(let chip=0;chip<5;chip++){
      const xx=-1.28+((chip*13+variant*7)%27)*.095;
      add(xx,.23+(chip%3)*.085,.342,.12+(chip%2)*.08,.024,.045,chip%2?'#6c746e':'#252f37','solid','worn lower panel');
    }
    const bounds=local.reduce((a,b)=>{const v=boxBounds(b);return {minX:Math.min(a.minX,v.minX),maxX:Math.max(a.maxX,v.maxX),minY:Math.min(a.minY,v.minY),maxY:Math.max(a.maxY,v.maxY),minZ:Math.min(a.minZ,v.minZ),maxZ:Math.max(a.maxZ,v.maxZ)};},{minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity});
    if(local.some(b=>Math.abs((b.x-face.x)*Math.cos(face.ry)-(b.z-face.z)*Math.sin(face.ry))+b.sx/2>face.width/2-STREET_DETAIL_RULES.facadeMargin))return;
    if(bounds.maxY>STREET_DETAIL_RULES.maximumHeight||existingSigns.some(s=>overlaps(bounds,s,.04)))return;
    // Also reject any proposed assembly that projects into an unrelated wall.
    if(layout.buildings.some(b=>b.id!==building.id&&overlaps(bounds,boxBounds(b),.05)))return;
    const aperture=(t,y,n,w,h,d)=>boxBounds({...transform(t,y,n),sx:w,sy:h,sz:d*nScale,ry:face.ry});
    const cutouts=[{role:'doorway aperture',bounds:aperture(0,1.56,.34,3.54,3.16,.80)},
      {role:'utility inset aperture',bounds:aperture(utilityT+.04,1.49,.34,1.16,2.84,.80)}];
    // Check the actual approach and the complete crafted assembly against the
    // old authored scene. A wall attachment alone does not prove a usable or
    // visible entrance: market stalls, projecting pipes and grounded sign
    // supports must remain outside its approach.
    const approach=aperture(0,1.53,1.43,3.60,2.74,1.94/nScale);
    for(const old of oldGround.get(building.chunk)||[]){
      const b=old.box,bb=old.bounds;
      const nCenter=(b.x-face.x)*face.nx+(b.z-face.z)*face.nz;
      const nHalf=face.nx?((bb.maxX-bb.minX)/2):((bb.maxZ-bb.minZ)/2);
      if(nCenter+nHalf<=.24)continue; // The host substrate stays behind the new finish.
      const repairable=b.detail==='street-frontage'&&!b.supportId&&Math.abs(Math.sin((b.ry||0)*2))<1e-7&&nCenter-nHalf>=-.08&&nCenter+nHalf<=.74;
      if(repairable)continue;
      if(overlaps(bounds,bb,.025)||overlaps(approach,bb,.025))return;
    }
    boxes.push(...local);supports.push(...localSupports);
    facadeCuts.push(...cutouts.map(c=>({...c,assemblyId:id,hostBuilding:building.id,chunk:building.chunk})));
    assemblies.push({id,label:theme.type.replaceAll('-',' ')+' / unit '+digits,district:chunk.district,chunk:building.chunk,hostBuilding:building.id,attachedTo:building.id,
      mountType:'wall-supported-frontage',anchor:{x:face.x,y:base+1.55,z:face.z},groundY:base,ry:face.ry,road:face.road,courtyard:face.courtyard,
      bounds,approach,offset,inspectionVantage:transform(0,1.75,(face.courtyard?2.15:5.27)/nScale),
      apertures:cutouts,boxIds:local.map(b=>b.id),supportIds:localSupports.map(s=>s.id),variant});
  }
  function tryAssembly(building,face,variant){
    const preferred=(variant%2?1:-1)*Math.min(face.width*.14,1.7);
    const offsets=[preferred,0];
    for(let step=1;step<=Math.floor(face.width/2);step++)offsets.push(preferred+step,preferred-step);
    for(const offset of offsets){const count=assemblies.length;assembly(building,face,variant,offset);if(assemblies.length>count)return true;}
    return false;
  }
  for(const chunk of layout.chunks){
    const buildings=layout.buildings.filter(b=>b.chunk===chunk.id).sort((a,b)=>a.z-b.z||a.x-b.x);
    const chosen=buildings.length>2?[buildings[0],buildings[buildings.length-1]]:buildings;
    chosen.forEach((building,index)=>{
      const faces=[];for(const axis of ['x','z'])for(const side of [-1,1]){const f=facade(building,axis,side,layout.roads);if(f)faces.push(f);}
      faces.sort((a,b)=>a.roadDistance-b.roadDistance||(a.width>b.width?-1:1));
      for(const face of faces)if(tryAssembly(building,face,Number(building.id.slice(1))+index))break;
    });
    // Selected inward faces make the service courts useful visual destinations.
    if(Number(chunk.id.split('-')[1])%2===0&&buildings[1]){
      const b=buildings[1],side=b.x<chunk.x?1:-1,face=facade(b,'x',side,layout.roads,true);
      if(face)tryAssembly(b,face,Number(b.id.slice(1))+3);
    }
  }
  const facadeReplacements=[];
  for(const [chunk,old] of oldGround){
    const cuts=facadeCuts.filter(c=>c.chunk===chunk);
    for(const entry of old){
      const b=entry.box;
      if(b.detail!=='street-frontage'||b.supportId||Math.abs(Math.sin((b.ry||0)*2))>1e-7)continue;
      const touching=cuts.filter(c=>overlaps(entry.bounds,c.bounds));if(!touching.length)continue;
      let pieces=[entry.bounds];for(const c of touching)pieces=pieces.flatMap(p=>subtractBounds(p,c.bounds));
      const replacements=pieces.map((p,i)=>({...b,id:'FACADE-REFIT-'+entry.index+'-'+i,
        x:(p.minX+p.maxX)/2,y:(p.minY+p.maxY)/2,z:(p.minZ+p.maxZ)/2,
        sx:p.maxX-p.minX,sy:p.maxY-p.minY,sz:p.maxZ-p.minZ,ry:0,
        detail:'street-frontage-refit',sourceIndex:entry.index,sourceAssemblyIds:[...new Set(touching.map(c=>c.assemblyId))]}));
      facadeReplacements.push({sourceIndex:entry.index,original:{...b},assemblyIds:[...new Set(touching.map(c=>c.assemblyId))],boxes:replacements});
    }
  }
  return {version:2,rules:STREET_DETAIL_RULES,boxes,supports,assemblies,facadeReplacements};
}

export function applyStreetDetails(layout){
  const detail=createStreetDetails(layout);
  const refits=new Map(detail.facadeReplacements.map(r=>[r.sourceIndex,r.boxes]));
  layout.boxes=layout.boxes.flatMap((box,index)=>refits.has(index)?refits.get(index):[box]);
  layout.boxes.push(...detail.boxes);layout.supports.push(...detail.supports);
  layout.streetDetails={version:detail.version,rules:detail.rules,assemblies:detail.assemblies,voxelCount:detail.boxes.length,
    facadeReplacements:detail.facadeReplacements.map(r=>({sourceIndex:r.sourceIndex,original:r.original,assemblyIds:r.assemblyIds,boxIds:r.boxes.map(b=>b.id)}))};
  layout.blueprint.supports.push(...detail.supports);layout.blueprint.streetDetails=layout.streetDetails;
  return layout;
}
