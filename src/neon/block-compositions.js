// Authored block recipes shared by Three.js, collision generation and Blender.
// Post-frontage application preserves service IDs and source-array positions.
const GROUND=.185;
const extent=b=>{const c=Math.abs(Math.cos(b.ry||0)),s=Math.abs(Math.sin(b.ry||0));return{minX:b.x-(c*b.sx+s*b.sz)/2,maxX:b.x+(c*b.sx+s*b.sz)/2,minY:b.y-b.sy/2,maxY:b.y+b.sy/2,minZ:b.z-(s*b.sx+c*b.sz)/2,maxZ:b.z+(s*b.sx+c*b.sz)/2};};

export function applyBlockCompositions(layout){
  const boxes=[],supports=[],assemblies=[],paths=[],seats=[],buildingSections=[],replacements=[];let current;
  function begin(id,label,chunk,hosts=[],mountType='ground-supported assembly'){
    current={id,label,chunk,hostBuildings:hosts,mountType,boxIds:[],supportIds:[]};assemblies.push(current);return current;
  }
  function add(x,y,z,sx,sy,sz,c,kind='solid',role='architectural member',structural=false,ry=0){
    const id=current.id+'-'+String(current.boxIds.length+1).padStart(3,'0');
    const b={id,x,y:GROUND+y,z,sx,sy,sz,c,kind,ry,chunk:current.chunk,lod:'near',detail:'block-craft',assemblyId:current.id,attachedTo:current.hostBuildings[0]||current.id,role};
    if(structural){b.supportId='SUP-'+id;supports.push({id:b.supportId,x:b.x,y:b.y,z:b.z,sx,sy,sz,ry,baseY:b.y-sy/2,role,attachedTo:b.attachedTo,chunk:b.chunk});current.supportIds.push(b.supportId);}
    boxes.push(b);current.boxIds.push(id);return b;
  }
  const local=(x,z,ry=0)=>(u,y,v,w,h,d,c,kind='solid',role='architectural member',structural=false)=>add(x+Math.cos(ry)*u+Math.sin(ry)*v,y,z-Math.sin(ry)*u+Math.cos(ry)*v,w,h,d,c,kind,role,structural,ry);
  function post(x,z,top,width=.18,c='#788389'){
    add(x,.12,z,width+.20,.24,width+.20,'#495664','metal','column foot',true);
    add(x,(top+.18)/2,z,width,top-.18,width,c,'metal','grounded column',true);
  }
  function route(id,label,points,width=2.4){paths.push({id,label,width,clearHeight:2.3,points:points.map(([x,z])=>({x,y:GROUND,z}))});}
  function tree(id,x,z,variant){
    begin(id,'Stepped branching courtyard planter','block-15');const b=local(x,z);
    b(0,.22,0,3.2,.44,2.35,'#55616a','solid','grounded planter base',true);
    b(0,.47,0,2.78,.14,1.94,'#3d5144','solid','planted soil');
    for(const s of [-1,1]){b(s*1.51,.50,0,.20,.19,2.43,'#758178','solid','stepped planter coping');b(0,.50,s*1.10,2.92,.19,.19,'#758178','solid','stepped planter coping');}
    b(.05,1.55,0,.32,2.20,.34,'#6a6551','solid','branching trunk',true);
    b(-.30,1.94,0,.82,.24,.26,'#776d57','solid','low branch',true);
    b(-.64,2.20,0,.24,.48,.25,'#776d57','solid','stepped branch rise',true);
    b(.45,2.26,0,.92,.22,.25,'#7d755d','solid','high branch',true);
    b(.82,2.51,0,.22,.38,.24,'#7d755d','solid','high branch rise',true);
    const leaf=variant%2?'#426e61':'#50796a';
    b(-.76,2.54,0,1.67,.55,1.58,leaf,'solid','lower asymmetric canopy');
    b(-1.12,2.76,-.12,.93,.35,1.28,'#638b73','solid','stepped leaf crown');
    b(.12,2.77,.10,1.20,.56,1.25,'#386657','solid','connected inner foliage');
    b(.84,2.95,0,1.60,.64,1.44,leaf,'solid','upper asymmetric canopy');
    b(1.10,3.29,.06,1.01,.34,1.09,'#688b70','solid','upper stepped crown');
    b(.49,3.20,-.36,.69,.34,.86,'#50775e','solid','branch canopy shoulder');
    for(let i=0;i<7;i++)b(-1.1+i*.34,.61,.67+(i%2)*.10,.27,.18+(i%3)*.055,.30,i%2?'#527455':'#668765','solid','ground planting');
  }
  function bench(id,x,z,ry){
    begin(id,'Resident bench with clear seated approach','block-15');const b=local(x,z,ry);
    for(const s of [-1,1]){b(s*.97,.24,0,.22,.48,.72,'#56606c','metal','bench grounded leg',true);b(s*.97,.80,-.34,.14,.72,.16,'#77808a','metal','bench back support',true);}
    for(let slat=0;slat<5;slat++)b(0,.51,-.30+slat*.15,2.82,.12,.125,'#987f70','solid','seat slat');
    for(const y of [.88,1.09])b(0,y,-.36,2.82,.14,.16,'#a48a77','solid','backrest slat');
    for(const s of [-1,1]){b(s*1.29,.65,.02,.12,.28,.14,'#6f7c86','metal','armrest riser');b(s*1.29,.82,.02,.15,.10,.76,'#8a9494','metal','armrest');}
    seats.push({id:current.id,position:{x,y:GROUND+.57,z},yaw:ry,width:2.5,approach:{x:x+Math.sin(ry)*1.15,y:GROUND,z:z+Math.cos(ry)*1.15},clearance:{sx:3.4,sz:1.3},boxIds:[...current.boxIds]});
  }
  // Replace the six old tree icons while opening the central east/west route.
  for(const[i,x,z]of[[0,-158,-248],[1,-142,-250],[2,-158,-232],[3,-142,-230],[4,-152,-258],[5,-148,-220]])tree('COURT-15-GARDEN-'+i,x,z,i);
  bench('COURT-15-SEAT-SOUTH',-159.5,-252.3,0);bench('COURT-15-SEAT-NORTH',-159.5,-227.7,Math.PI);
  begin('COURT-15-CIRCULATION','Covered residential circulation spine','block-15',['B102','B103']);
  for(const[z,h]of[[-260,3.72],[-252,3.72],[-246,4.42],[-234,4.42],[-228,3.72],[-220,3.72]])for(const x of[-175.5,-170.5])post(x,z,h);
  for(const[z,len,h]of[[-255.8,12.4,3.72],[-240,20,4.42],[-224.2,12.4,3.72]]){
    add(-173,h,z,5.44,.20,len,'#756873','metal','stepped circulation canopy',true);
    for(const x of[-175.55,-170.45])add(x,h-.17,z,.16,.20,len,'#a29199','metal','continuous canopy edge beam',true);
    for(let p=-len/2+.5;p<len/2;p+=1.65)add(-173,h+.14,z+p,5.15,.12,.12,'#b09c9a','metal','exposed roof rib');
    add(-170.36,h-.16,z,.08,.055,len-.35,'#da79bb','window','shielded circulation strip');
  }
  for(const z of[-250,-230])for(const x of[-175.5,-170.5])add(x,3.92,z,.18,.99,.18,'#968b92','metal','canopy level tie',true);
  add(-167,.011,-240,56,.020,3.0,'#526071','pavement','west entry walking band');
  add(-173,.012,-240,3.1,.022,40.0,'#4a5868','pavement','covered circulation walking band');
  // The old gateway has two grounded masts only 1.86m apart. The broad
  // residential approach passes beside them, keeping that structure intact.
  route('COURT-15-ROAD-ENTRY','West road to residential court',[[-210,-240],[-200,-240],[-198,-244],[-190,-244],[-182,-240],[-168.8,-240],[-150,-240]],2.6);
  route('COURT-15-ENTRY-WALK','Court to residential entrance',[[-150,-240],[-166.1,-240],[-166.1,-255.9],[-177.8,-255.9],[-177.8,-258.6]],2.0);
  route('COURT-15-LOOP','Residential circulation and service loop',[[-173,-240],[-173,-224],[-160,-224],[-155,-224],[-155,-240],[-173,-240]],1.8);
  route('COURT-15-SEAT-ACCESS-S','Covered walk to south seating',[[-173,-240],[-173,-251.15],[-159.5,-251.15]],1.2);
  route('COURT-15-SEAT-ACCESS-N','Covered walk to north seating',[[-173,-240],[-173,-228.85],[-159.5,-228.85]],1.2);
  begin('COURT-15-HOME-ENTRY','Housing 15 entrance, mail and building services','block-15',['B102'],'wall-supported entrance');
  const e=local(-177.8,-261.8);
  e(0,1.78,.15,7.7,3.56,.38,'#756577','solid','residential entry surround',true);
  e(0,1.51,.39,3.1,2.96,.22,'#202b3b','metal','recessed residential doors');
  for(const s of[-1,1]){e(s*1.70,1.55,.48,.25,3.1,.40,'#b59d9f','metal','entry jamb',true);e(s*.73,1.91,.514,1.29,1.56,.04,'#587485','window','residential door glass');e(s*.10,1.10,.61,.06,.55,.18,'#aeb5ab','metal','entry pull');}
  e(0,.10,.45,3.68,.2,.82,'#8e8e87','solid','flush entry threshold',true);
  e(0,3.22,.46,3.7,.24,.47,'#bda8a2','metal','entry lintel',true);
  e(0,3.78,1.82,8.15,.25,4.15,'#675466','metal','attached entrance porch canopy',true);
  for(const x of[-181.48,-174.12])post(x,-258.24,3.78,.22,'#a18d96');
  e(0,3.63,3.87,7.8,.08,.08,'#f4a7cc','window','porch edge light');
  for(let col=0;col<3;col++)for(let row=0;row<3;row++){e(-2.98+col*.48,.79+row*.53,.46,.40,.45,.38,'#6c7784','metal','resident mail cabinet');e(-2.98+col*.48,.85+row*.53,.665,.26,.045,.035,'#c1b6a1','metal','mail slot');}
  e(2.71,1.66,.48,1.32,2.12,.47,'#3b4b5a','metal','building service cabinet',true);
  for(let i=0;i<6;i++)e(2.71,1.08+i*.24,.73,1.03,.075,.05,'#829599','metal','service cabinet louvre');
  e(3.55,1.56,.31,.16,2.88,.16,'#8c8a81','metal','grounded utility riser',true);e(2.65,2.97,.31,1.95,.16,.16,'#8c8a81','metal','utility manifold');
  for(const id of['B102','B103']){
    const host=layout.buildings.find(b=>b.id===id),toward=id==='B102'?1:-1,face=host.z+toward*host.sz/2;
    begin('COURT-15-'+id+'-BAYS','Residential courtyard bays and service landings','block-15',[id],'wall-supported bays');
    for(const[x,base,width]of[[host.x-4.1,5.0,6.0],[host.x+3.4,8.0,6.0]]){
      add(x,base+1.6,face+toward*.40,width,3.2,.84,'#586372','solid','projecting inhabited bay',true);
      add(x,base+1.85,face+toward*.84,width-.55,1.84,.08,'#7b999d','window','long bay glazing');
      for(let k=0;k<4;k++)add(x-width/2+.28+k*(width-.55)/3,base+1.83,face+toward*.91,.12,2.07,.16,'#b3a2a1','metal','bay mullion');
      add(x,base-.03,face+toward*.70,width+.42,.20,1.47,'#a78e9c','metal','supported landing ledge',true);
      add(x,base+3.22,face+toward*.58,width+.42,.19,1.25,'#846d82','metal','bay upper cap');
    }
  }
  // Full-depth stall counters and shelves leave a clear middle loading aisle.
  for(let row=0;row<2;row++)for(let column=0;column<3;column++){
    const x=-269+column*9,z=row?103:87,ry=row?Math.PI:0;
    begin('MARKET-0-STALL-'+row+'-'+column,'Market preparation and serving bay','block-0');const b=local(x,z,ry);
    b(0,.09,0,4.72,.18,3.50,'#715346','solid','grounded market plinth',true);
    for(const u of[-2.15,2.15])for(const v of[-1.53,1.53]){b(u,1.65,v,.15,3.12,.15,'#aa8867','metal','stall frame post',true);b(u,.24,v,.29,.30,.29,'#4a4d4c','metal','stall post foot',true);}
    b(0,3.22,0,4.88,.21,3.70,row?'#74465d':'#9d653d','metal','supported deep stall awning',true);
    for(let stripe=0;stripe<9;stripe++)b(-2.14+stripe*.535,3.34,0,.24,.05,3.65,column%2?'#d1ac79':'#b3a38c','solid','awning fabric stripe');
    b(0,1.49,-1.55,4.22,2.67,.14,'#523f3d','solid','prep bay rear wall',true);
    b(0,1.01,.85,4.15,.94,1.05,'#7f6250','solid','deep serving counter',true);b(0,1.52,.84,4.33,.14,1.20,'#beb39a','metal','serving worktop');
    for(const u of[-1.80,1.80])b(u,.30,.85,.18,.60,.72,'#938773','metal','grounded counter leg',true);
    b(0,.71,-.89,3.98,1.14,.93,'#6a6659','metal','preparation cupboards',true);
    for(const y of[1.35,2.05,2.69])b(0,y,-1.08,4.03,.12,.90,'#b39973','solid','rear preparation shelf');
    for(let c=0;c<7;c++)for(let level=0;level<2;level++)b(-1.56+c*.52,1.55+level*.70,-1.13,.28,.29,.32,['#79876a','#bf875c','#aa6650'][(c+column)%3],'solid','shelf container');
    for(const u of[-1.43,-.52,.48,1.38]){b(u,1.64,.92,.58,.10,.54,'#baaa88','solid','serving tray');b(u,1.75,.92,.39,.15,.32,column%2?'#b88962':'#acb084','solid','prepared market produce');}
    b(0,3.10,1.90,4.4,.11,.11,'#f8ba73','window','sheltered stall lamp');
  }
  begin('MARKET-0-LOADING-GATE','Open market loading entrance and covered access','block-0',['B044','B045']);
  for(const x of[-244,-228])for(const z of[90.6,99.4])post(x,z,4.30,.23,'#ae8b60');
  add(-236,4.30,95,17,.23,9.5,'#775347','metal','loading gateway roof',true);
  for(const z of[90.55,99.45])add(-236,4.02,z,17,.34,.23,'#bc956c','metal','loading gateway beam',true);
  add(-227.6,4.04,95,.23,.30,9.4,'#bc956c','metal','loading entry head beam',true);
  for(let i=0;i<10;i++)add(-243.7+i*1.72,4.48,95,.18,.15,9.25,'#ac8060','metal','loading roof rib');
  add(-227.45,3.99,95,.10,.13,7.4,'#ffc57c','window','loading entry light');add(-236,.012,95,23,.024,3.2,'#706a54','pavement','clear loading aisle');
  // Existing festival cable masts remain grounded at both entrances. Route
  // the usable approach around their feet, inside the open loading gateway.
  route('MARKET-0-LOADING-WALK','Avenue to market serving aisle',[[-210,95],[-219,97.3],[-230,97.3],[-237,95],[-244,95],[-260,95],[-278,95]],2.6);
  route('MARKET-0-SERVICE-WALK','Market aisle to preserved food hatch',[[-260,95],[-280,95],[-289,97.3],[-298,97.3],[-298,61.5],[-283.07,61.5],[-283.07,63.86]],1.2);
  for(const id of['B044','B045']){
    const host=layout.buildings.find(b=>b.id===id),base=host.y+host.sy/2-GROUND;
    begin('MARKET-0-'+id+'-SETBACK','Terraced market upper storeys','block-0',[id],'roof-supported upper storeys');
    const h=id==='B044'?6.8:4.0,cx=host.x-2.5,cz=host.z+(id==='B044'?-1.6:1.9);
    const first=add(cx,base+h/2-.05,cz,13.7,h,13.0,id==='B044'?'#826051':'#5a6870','solid','setback occupied upper floor',true);
    const second=add(cx-1.5,base+h+1.57,cz-1.0,9.0,3.15,8.3,'#564d54','solid','second setback floor',true);
    for(const mass of[first,second]){
      const section={x:mass.x,y:mass.y,z:mass.z,sx:mass.sx,sy:mass.sy,sz:mass.sz};buildingSections.push({buildingId:id,boxId:mass.id,...section});
      layout.colliders.push({...section,id:'COLLIDER-'+mass.id,chunk:host.chunk,sourceBoxId:mass.id});
      add(mass.x,mass.y-GROUND+mass.sy/2+.12,mass.z,mass.sx+.46,.24,mass.sz+.46,'#b59d86','metal','terrace coping',true);
      for(const side of[-1,1])for(let i=0;i<4;i++){
        const z=mass.z-mass.sz*.33+i*mass.sz*.22;add(mass.x+side*(mass.sx/2+.04),mass.y-GROUND+.37,z,.09,1.83,mass.sz*.16,'#acaa8b','window','recessed upper glazing');
        add(mass.x+side*(mass.sx/2+.14),mass.y-GROUND-1.02,z,.32,.17,mass.sz*.19,'#cfb189','metal','upper sill');
      }
    }
    // B045's retained vertical noodle sign occupies the north balcony bay.
    // Offset the inhabited terrace southward so its guard never bisects art.
    const balconyLength=id==='B045'?9.6:host.sz*.73,balconyZ=id==='B045'?111.9:host.z;
    for(const height of[6.8,10.2]){
      add(host.x+host.sx/2+.37,height,balconyZ,.78,.21,balconyLength,'#9b8974','metal','attached market balcony edge',true);
      for(let i=0;i<9;i++)add(host.x+host.sx/2+.61,height+.5,balconyZ-balconyLength*.46+i*balconyLength*.115,.13,.89,.11,'#b7a58d','metal','balcony guard upright');
      add(host.x+host.sx/2+.61,height+.99,balconyZ,.15,.11,balconyLength,'#c0ad91','metal','balcony top rail');
    }
  }
  const treeSlots=[],stallSlots=[];
  layout.boxes.forEach((b,index)=>{
    if(b.lod==='far'||b.detail||b.supportId)return;
    if(b.chunk==='block-15'&&[-158,-142].some(x=>Math.abs(b.x-x)<.001)&&[-248,-240,-232].some(z=>Math.abs(b.z-z)<.001)&&((b.sx===2.1&&b.sy===.9&&b.sz===2.1)||(b.sx===.25&&b.sy===2.4&&b.sz===.25)||(b.sx===1.9&&b.sy===1.3&&b.sz===1.8)))treeSlots.push(index);
    if(b.chunk==='block-0'&&[-268,-252].some(x=>Math.abs(b.x-x)<1.5)&&[87,95,103].some(z=>Math.abs(b.z-z)<1.75)&&((b.sx===2.1&&b.sy===.9)||(b.sx===2.7&&b.sy===.15)||(b.sx===3.5&&b.sy===.18)||(b.sx===.07&&b.sy===1.6)||(b.sx===2.9&&b.sy===.07)))stallSlots.push(index);
  });
  if(treeSlots.length!==18||stallSlots.length!==36)throw new Error('Authored courtyard source slots changed: '+treeSlots.length+'/'+stallSlots.length);
  const reused=new Set();
  for(const[slots,prefix]of[[treeSlots,'COURT-15-GARDEN-'],[stallSlots,'MARKET-0-STALL-']]){
    const replacementBoxes=boxes.filter(b=>b.assemblyId.startsWith(prefix));
    slots.forEach((sourceIndex,i)=>{const b=replacementBoxes[i];replacements.push({sourceIndex,original:layout.boxes[sourceIndex],boxId:b.id});layout.boxes[sourceIndex]=b;reused.add(b.id);});
  }
  layout.boxes.push(...boxes.filter(b=>!reused.has(b.id)));layout.supports.push(...supports);layout.blueprint.supports.push(...supports);
  const byId=new Map(boxes.map(b=>[b.id,b]));
  for(const assembly of assemblies){const q=assembly.boxIds.map(id=>extent(byId.get(id)));assembly.bounds={minX:Math.min(...q.map(b=>b.minX)),maxX:Math.max(...q.map(b=>b.maxX)),minY:Math.min(...q.map(b=>b.minY)),maxY:Math.max(...q.map(b=>b.maxY)),minZ:Math.min(...q.map(b=>b.minZ)),maxZ:Math.max(...q.map(b=>b.maxZ))};}
  for(const id of['B044','B045']){
    const hosts=new Set([layout.buildings.find(b=>b.id===id),layout.blueprint.buildings.find(b=>b.id===id)]);
    // Blueprint building records may share the old section array. Derive
    // once, then assign independent arrays instead of appending twice.
    const sections=[...layout.buildings.find(b=>b.id===id).sections,...buildingSections.filter(s=>s.buildingId===id).map(({buildingId,boxId,...s})=>s)];
    for(const host of hosts){host.sections=sections.map(s=>({...s}));const low=Math.min(...sections.map(s=>s.y-s.sy/2)),high=Math.max(...sections.map(s=>s.y+s.sy/2));host.y=(low+high)/2;host.sy=high-low;}
  }
  layout.blockCompositions={version:1,assemblies,replacements,paths,seats,buildingSections,addedVoxelModules:boxes.length,replacedSourceRecords:replacements.length,
    entrances:[{id:'COURT-15-HOME-ENTRY',hostBuilding:'B102',target:{x:-177.8,y:GROUND+1.55,z:-261.24},inspectionVantage:{x:-177.8,y:GROUND+1.75,z:-257.4},approach:{x:-177.8,y:GROUND,z:-259.0,sx:2.4,sz:2.2},normal:{x:0,y:0,z:1}}],
    reviewCameras:[{name:'Stacktown service court',x:-150,z:-240,tx:-174,ty:3,tz:-240},{name:'Lantern Market',x:-210,z:126,tx:-210,ty:16,tz:5}]};
  layout.blueprint.blockCompositions=layout.blockCompositions;return layout;
}
