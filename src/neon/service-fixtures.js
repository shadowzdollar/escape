// Renderer-independent exterior service mechanisms. All coordinates are metres.
// The same fixed-size boxes and sampled poses can be exported to Blender.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:0));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const interval=(p,a,b)=>smooth((p-a)/(b-a));
const copyPoint=p=>({x:p.x,y:p.y,z:p.z});
const world=(recipe,x,y,z)=>({x:recipe.origin.x+Math.cos(recipe.ry)*x+Math.sin(recipe.ry)*z,y:recipe.origin.y+y,z:recipe.origin.z-Math.sin(recipe.ry)*x+Math.cos(recipe.ry)*z});
const local=(recipe,p)=>{const dx=p.x-recipe.origin.x,dz=p.z-recipe.origin.z,c=Math.cos(recipe.ry),s=Math.sin(recipe.ry);return{x:dx*c-dz*s,y:p.y-recipe.origin.y,z:dx*s+dz*c};};

export function createServiceFixtures({source={},sites=[]}={}){
  const byId=new Map((source.boxes||[]).filter(b=>b.id).map(b=>[b.id,b]));
  const assemblies=new Map((source.streetDetails?.assemblies||[]).map(a=>[a.id,a]));
  const recipes=[],removedBoxIds=[];
  for(const site of sites){
    const assembly=assemblies.get(site.assemblyId);if(!assembly)continue;
    const originals=assembly.boxIds.map(id=>byId.get(id)).filter(Boolean),back=originals.find(b=>b.role==='anchored masonry surround');
    if(!back)continue;
    const ry=assembly.ry||0,nScale=back.sz/.24,n={x:Math.sin(ry),z:Math.cos(ry)};
    const recipe={id:site.id,type:site.type,label:site.label,hostBuilding:site.hostBuilding,assemblyId:assembly.id,ry,
      origin:{x:back.x-n.x*.1*nScale,y:assembly.groundY,z:back.z-n.z*.1*nScale},normal:n,nScale,
      target:copyPoint(site.target),approach:copyPoint(site.approach),parking:site.parking?{...site.parking,route:undefined}:null,
      duration:site.duration,cooldown:site.cooldown,removedBoxIds:[],parts:[]};
    const palette={food:['#554438','#cf9660','#eaae55'],clinic:['#45626a','#adc8c0','#82d6c1'],garage:['#334852','#b6a25d','#edb44e'],recharge:['#414058','#8d769f','#a682dc'],wayfinding:['#304453','#b7a779','#78c2d6']}[site.type];
    if(!palette)continue;
    const [dark,metal,accent]=palette;
    function box(name,x,y,z,sx,sy,sz,color=metal,partGroup='fixed',emissive=false,solid=true){
      const p=world(recipe,x,y,z),part={id:site.id+'-FIX-'+name,partGroup,...p,sx,sy,sz,ry,color,solid,emissive,local:{x,y,z},role:name};recipe.parts.push(part);return part;
    }
    function rail(name,x,y,z,sx,sy,sz){box(name,x,y,z,sx,sy,sz,dark);}
    // The indicator is flush on the existing control surround, clear of the
    // interaction ray's endpoint. Its base physically meets the authored panel.
    box('status-base',1.61,2.14,.555,.15,.36,.17,dark);
    for(let i=0;i<3;i++)box('status-'+i,1.61,2.03+i*.11,.648,.075,.064,.025,accent,'fixed',true,false);
    if(site.type==='food'){
      recipe.removedBoxIds=originals.filter(b=>b.role==='hatch shutter slat').map(b=>b.id);
      // The original counter and backing remain. The deeper, continuous
      // shutter encloses a supported serving drawer instead of exposing a wall.
      for(const side of [-1,1]){
        rail('shutter-guide-'+side,side*1.36,2.05,.64,.12,2.10,.17);
        box('guide-standoff-'+side,side*1.36,1.72,.49,.12,1.3,.30,dark);
        rail('drawer-slide-'+side,side*.46,1.13,.80,.09,.08,1.03);
      }
      box('shutter-header',0,3.055,.64,2.83,.14,.17,metal);
      for(let i=0;i<5;i++)box('shutter-'+i,0,1.353+i*.245,.64,2.65,.246,.08,i%2?dark:metal,'shutter');
      box('drawer',0,1.195,.52,1.03,.06,.40,metal,'drawer');
      box('drawer-front',0,1.24,.73,1.07,.13,.055,dark,'drawer');
      box('meal-base',0,1.247,.49,.35,.044,.20,'#796c59','drawer');
      box('meal-bowl',0,1.31,.49,.30,.085,.20,'#e6c6a1','drawer');
      box('meal-rim',0,1.357,.49,.34,.034,.20,'#baa785','drawer');
      for(let i=0;i<5;i++)box('noodles-'+i,-.10+i*.05,1.382,.49,.025,.018,.16,i%2?'#dabc72':'#edcd8c','drawer');
      box('garnish',.065,1.40,.49,.075,.025,.07,'#71854b','drawer');
    }else if(site.type==='clinic'){
      rail('scanner-rail',.72,1.74,.555,.115,1.40,.15);
      for(const y of [1.10,2.38])box('scanner-standoff-'+y,.72,y,.465,.23,.13,.22,dark);
      box('scanner-head',.72,2.32,.68,.49,.20,.19,metal,'scanner');
      box('scanner-lens',.72,2.32,.788,.35,.047,.029,accent,'scanner',true,false);
      box('scanner-top-stop',.72,2.48,.56,.26,.12,.18,dark);
      box('scanner-bottom-stop',.72,1.00,.56,.26,.12,.18,dark);
    }else if(site.type==='garage'){
      // The existing wall jambs carry two long beams. A cross-carriage moves
      // above the parked car; the non-contact repair head never enters its hull.
      for(const t of [-1.47,1.47]){
        box('wall-plate-'+t,t,2.69,.50,.36,.70,.22,dark);
        box('cantilever-'+t,t,3.045,2.98,.19,.19,5.18,metal);
        box('wall-upright-'+t,t,2.87,.64,.17,.50,.22,metal);
        for(let j=0;j<7;j++)box('brace-'+t+'-'+j,t,2.45+j*.075,.68+j*.27,.14,.16,.36,dark);
      }
      box('front-tie',0,3.045,5.49,3.13,.19,.19,metal);
      box('bridge',1.47,3.045,4.2,6.25,.18,.20,dark,'bridge');
      box('bridge-end-left',-1.66,3.045,4.2,.15,.25,.29,accent,'bridge');
      box('bridge-end-right',4.60,3.045,4.2,.15,.25,.29,accent,'bridge');
      box('tool-carriage',1.47,2.97,4.2,.38,.24,.39,metal,'carriage');
      box('tool-upper-sleeve',1.47,2.86,4.2,.14,.60,.14,dark,'carriage');
      box('tool-sliding-stem',1.47,2.83,4.2,.085,.80,.085,metal,'tool');
      box('repair-head',1.47,2.43,4.2,.39,.18,.31,dark,'tool');
      box('repair-lens',1.47,2.324,4.2,.27,.032,.19,accent,'tool',true,false);
    }else if(site.type==='recharge'){
      box('charge-housing',.71,1.50,.49,.59,.62,.24,dark);
      for(const side of [-1,1])box('charge-edge-'+side,.71+side*.255,1.5,.64,.075,.64,.10,metal);
      box('charge-cell-backing',.71,1.50,.66,.36,.54,.11,dark);
      box('charge-contact',.71,1.50,.775,.32,.14,.15,metal,'contact');
      for(let i=0;i<5;i++)box('charge-cell-'+i,.71,1.28+i*.105,.718,.27,.06,.03,accent,'fixed',true,false);
    }else{
      box('directory-backing',.60,1.65,.48,.85,.78,.24,dark);
      for(const side of [-1,1])box('directory-frame-'+side,.60+side*.44,1.65,.61,.075,.85,.14,metal);
      for(const y of [1.23,2.07])box('directory-frame-'+y,.60,y,.61,.94,.075,.14,metal);
      box('directory-screen',.60,1.65,.601,.80,.72,.022,'#0e252d');
      for(let i=0;i<5;i++)box('map-block-'+i,.28+(i%3)*.24,1.46+Math.floor(i/3)*.28,.627,.12,.13,.036,metal);
      for(let i=0;i<6;i++)box('route-pixel-'+i,.27+i*.12,1.69,.620,.08,.035,.018,accent,'fixed',true,false);
    }
    removedBoxIds.push(...recipe.removedBoxIds);recipes.push(recipe);
  }
  return{version:1,recipes,removedBoxIds};
}

export function evaluateServiceFixture(recipe,{phase='idle',progress=0,closure=0,elapsed=0,vehicle=null,position=null}={}){
  const p=clamp(progress),closing=phase==='success'||phase==='cancelled',amount=closing?1-smooth(closure):phase==='active'?1:0;
  const deployment=interval(p,0,.22)*amount,offsets={fixed:{x:0,y:0,z:0}},effects=[];
  let work=phase==='active'&&p>.22&&p<.91;
  if(recipe.type==='food'){
    offsets.shutter={x:0,y:.52*interval(p,0,.22)*(closing?1-interval(closure,.55,1):phase==='active'?1:0),z:0};
    offsets.drawer={x:0,y:0,z:.52*interval(p,.28,.70)*(closing?1-interval(closure,0,.6):phase==='active'?1:0)};
    if((phase==='active'&&p>.4||phase==='success'&&closure<.45))effects.push({id:recipe.id+'-steam',kind:'steam',origin:world(recipe,0,1.43,.52+offsets.drawer.z),opacity:.14*amount});
  }else if(recipe.type==='clinic'){
    offsets.scanner={x:0,y:-1.13*(.5-.5*Math.cos(Math.PI*2*interval(p,.18,.88)))*deployment,z:0};
    if(work){const from=world(recipe,.72,2.32+offsets.scanner.y,.82),to=position?{x:position.x,y:position.y-.52,z:position.z}:{...recipe.approach,y:recipe.approach.y-.52};effects.push({id:recipe.id+'-scan',kind:'beam',from,to,color:'#83d8ca',opacity:.18});}
  }else if(recipe.type==='garage'){
    const parked=recipe.parking?local(recipe,recipe.parking):{x:1.47,y:0,z:4.2},car=vehicle?local(recipe,vehicle):parked;
    const targetT=clamp(car.x,parked.x-1.05,parked.x+1.05),targetN=clamp(car.z,parked.z-1.05,parked.z+1.05);
    const scan=1.65*Math.sin(interval(p,.22,.87)*Math.PI*2)*deployment;
    offsets.bridge={x:0,y:0,z:(targetN-4.2)*deployment};
    offsets.carriage={x:(targetT-1.47)*deployment+scan,y:0,z:offsets.bridge.z};
    offsets.tool={...offsets.carriage,y:-.63*deployment};
    if(work){const from=world(recipe,1.47+offsets.tool.x,2.31+offsets.tool.y,4.2+offsets.tool.z),to={...from,y:vehicle?vehicle.y+1.29:recipe.origin.y+1.31};effects.push({id:recipe.id+'-repair',kind:'beam',from,to,color:'#ffc87d',opacity:.28});}
  }else if(recipe.type==='recharge')offsets.contact={x:0,y:.085*Math.sin(p*Math.PI*4)*deployment,z:0};
  const groups=Object.entries(offsets).map(([id,o])=>({id,...world(recipe,o.x,o.y,o.z),ry:recipe.ry}));
  const boxes=recipe.parts.map(part=>{const o=offsets[part.partGroup]||offsets.fixed,p=world(recipe,part.local.x+o.x,part.local.y+o.y,part.local.z+o.z);let intensity=part.emissive?.35:0;
    if(part.emissive&&phase==='active')intensity=.55+.35*Math.sin(elapsed*7+(part.local.y+part.local.x)*3)**2;
    if(part.emissive&&phase==='success')intensity=.8*(1-clamp(closure))+.35;
    if(part.emissive&&phase==='cooldown')intensity=.16;
    if(part.role.startsWith('charge-cell-'))intensity=phase==='active'&&Number(part.role.at(-1))/5<progress?.9:.18;
    if(part.role.startsWith('route-pixel-'))intensity=phase==='active'&&Number(part.role.at(-1))/6<progress?.9:phase==='success'?.7:.18;
    return{...part,...p,intensity};});
  return{id:recipe.id,type:recipe.type,phase,progress:p,boxes,groups,effects};
}
