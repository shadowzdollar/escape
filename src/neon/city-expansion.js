// Deterministic outer city. This data is also consumed directly by Blender.
export function createExpansionLayout() {
  let state=741095;
  const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const pick=a=>a[Math.floor(rand()*a.length)];
  const boxes=[],signs=[],colliders=[],roads=[],chunks=[],supports=[],elevatedConnections=[];
  const bounds={minX:-350,maxX:350,minZ:-600,maxZ:190};
  let chunk='infrastructure';
  const b=(x,y,z,sx,sy,sz,c='#1b2a37',kind='solid',ry=0,lod='near')=>boxes.push({x,y,z,sx,sy,sz,c,kind,ry,chunk,lod});
  const g=(x,y,z,sx,sy,sz,c)=>b(x,y,z,sx,sy,sz,c,'glow');
  const sup=(x,y,z,sx,sy,sz,c,role,attachedTo)=>{
    const id='SUP-E'+String(supports.length+1).padStart(4,'0');
    b(x,y,z,sx,sy,sz,c,'metal');boxes[boxes.length-1].supportId=id;
    supports.push({id,x,y,z,sx,sy,sz,baseY:y-sy/2,role,attachedTo,chunk});return id;
  };
  const column=(x,z,height,id)=>[sup(x,.18,z,.6,.26,.6,'#586575','foundation',id),sup(x,(height+.18)/2,z,.2,height-.18,.2,'#617584','ground column',id)];
  const road=(x,z,sx,sz,name)=>roads.push({x,z,sx,sz,name});
  const avenues=[-310,-210,-90,90,210,310],crossings=[140,50,-70,-180,-300,-420,-540];
  for(const x of avenues)road(x,-205,22,750,'Avenue '+x);
  road(0,-15,22,330,'Kasumi Avenue');
  road(0,-440,22,280,'Crown Avenue');
  for(const z of crossings) {
    if(z===-70){road(-200,z,260,22,'West Canal Road');road(200,z,260,22,'East Canal Road');}
    else road(0,z,660,22,'Crossway '+z);
  }
  const districts=[
    {name:'Kasumi Ward',x:0,z:-65,radius:100,color:'#24dded',themeColor:'#24dded',activity:'nightlife'},
    {name:'Lantern Market',x:-150,z:96,radius:135,color:'#fb8c37',themeColor:'#ff702b',activity:'festival'},
    {name:'Iron Docks',x:220,z:48,radius:150,color:'#ffb947',themeColor:'#bc8f35',activity:'industry'},
    {name:'Stacktown',x:-200,z:-225,radius:155,color:'#f443b9',themeColor:'#bf42dd',activity:'residential'},
    {name:'Meridian East',x:205,z:-285,radius:155,color:'#46d7d2',themeColor:'#a5e74d',activity:'medical'},
    {name:'Crown Plaza',x:0,z:-435,radius:180,color:'#45bbff',themeColor:'#778bff',activity:'luxury'}
  ];
  const nearestDistrict=(x,z)=>{
    if(z>50)return x<0?districts[1]:districts[2];
    if(z< -300&&Math.abs(x)<200)return districts[5];
    return x<0?districts[3]:z>-180?districts[2]:districts[4];
  };
  // The full network joins the preserved hero avenue at 50m and -180m.
  for(const r of roads) {
    b(r.x,.008,r.z,r.sx,.05,r.sz,'#111e2b','pavement');
    const vertical=r.sz>r.sx,length=vertical?r.sz:r.sx;
    for(let p=-length/2+2;p<length/2-2;p+=8) {
      const x=vertical?r.x:r.x+p,z=vertical?r.z+p:r.z;
      for(const lane of [-.15,.15])b(x+(vertical?lane:0),.039,z+(vertical?0:lane),vertical?.075:2.7,.012,vertical?2.7:.075,'#87805c','pavement');
      if(Math.abs(p)%24<8)for(const side of [-1,1])g(x+(vertical?side*10.8:0),.07,z+(vertical?0:side*10.8),vertical?.055:.48,.018,vertical?.48:.055,'#1c5467');
    }
  }
  // Crossings use broken pedestrian markings and small traffic islands at corners.
  for(const x of [-310,-210,-90,0,90,210,310])for(const z of crossings) {
    if(x===0&&(z===-70||z===-180||z===-300))continue;
    for(const side of [-1,1])for(let lane=-8;lane<=8;lane+=2) {
      b(x+lane,.047,z+side*13,1.0,.01,2.7,'#58636b','pavement');
      b(x+side*13,.047,z+lane,2.7,.01,1.0,'#58636b','pavement');
    }
    for(const sx of [-1,1])for(const sz of [-1,1]) {
      b(x+sx*13,2.6,z+sz*13,.1,5.1,.1,'#344657','metal');
      b(x+sx*13,4.9,z+sz*13,.35,.9,.35,'#141e2b');
      g(x+sx*13,5.12,z+sz*13+.19,.13,.13,.03,'#d03a4e');
      g(x+sx*13,4.8,z+sz*13+.19,.13,.13,.03,'#3d9682');
    }
  }
  function smallBuilding(x,z,width,depth,height,theme,detail=1,streetSide=0) {
    const color=pick(theme==='docks'?['#394047','#273746','#4c4037']:theme==='market'?['#3d2c35','#333b43','#293c42']:['#1a2b3b','#253343','#253c48']);
    b(x,height/2+.2,z,width,height,depth,color);
    b(x,height+.15,z,width+.6,.4,depth+.6,'#334959','metal');
    colliders.push({x,y:height/2+.2,z,sx:width,sy:height,sz:depth,chunk});
    b(x,height/2+.2,z,width,height,depth,color,'solid',0,'far');
    b(x,height+.3,z,width*.75,.45,depth*.75,'#284251','solid',0,'far');
    if(theme==='docks') {
      for(const side of [-1,1]) {
        b(x,2.5,z+side*(depth/2+.04),width*.52,4.4,.15,'#59626a','metal');
        for(let y=.7;y<4.8;y+=.35)b(x,y,z+side*(depth/2+.14),width*.49,.055,.04,'#26394a');
      }
      for(let xx=x-width/2+.4;xx<x+width/2;xx+=3)b(xx,height/2,z+depth/2+.15,.13,height,.3,'#2c4254','metal');
    } else {
      const floor=theme==='corporate'?3.4:2.8;
      for(let y=2.2;y<height-1;y+=floor) {
        for(let xx=x-width/2+1;xx<x+width/2-.6;xx+=2.2)for(const side of [-1,1]) {
          if(rand()<.2)continue;
          const light=pick(theme==='corporate'?['#499caf','#3a748d','#7ac4d3']:['#bb9a72','#ddbb89','#65949b','#486d85']);
          b(xx,y,z+side*(depth/2+.06),.78,.81,.07,light,'window');
          if(theme==='residential'&&rand()<.14)b(xx,y-.65,z+side*(depth/2+.4),1.6,.12,.8,'#3c4f61','metal');
        }
        for(let zz=z-depth/2+1;zz<z+depth/2-.6;zz+=2.5)for(const side of [-1,1])if(rand()>.27)b(x+side*(width/2+.05),y,zz,.07,.78,.72,pick(['#678f99','#c6a87c','#427183']),'window');
      }
    }
    for(let v=0;v<8*detail;v++) {
      const vx=x+(rand()-.5)*(width-1.5),vy=2+rand()*(height-3);
      b(vx,vy,z+depth/2+.14,.6+rand()*.8,.3+rand()*.6,.3,'#354450','metal');
      if(v%3===0)b(vx,vy,z+depth/2+.31,.35,.06,.05,'#7e7b6b');
    }
    const accent=theme==='corporate'?'#19a3ca':theme==='market'?'#d74685':theme==='docks'?'#b07c35':'#367e96';
    g(x,height+.43,z+depth/2+.32,width*.68,.08,.08,accent);
    for(let r=0;r<3;r++) {
      const rx=x+(rand()-.5)*width*.6,rz=z+(rand()-.5)*depth*.6;
      b(rx,height+1.1,rz,1.0+rand()*1.4,1.6,1.1+rand()*1.8,'#3c4b5b','metal');
      b(rx,height+2.6,rz,.06,1.5,.06,'#476073','metal');
    }
    // Frontage variation deliberately uses its own random stream: the previously
    // audited road grid, building dimensions and collider data remain identical.
    const frontageBoxStart=boxes.length,frontageSignStart=signs.length;
    let frontageState=(Math.round((x+400)*173+(z+700)*397+width*811)>>>0)||1;
    const frontRandom=()=>{frontageState=(Math.imul(frontageState,1664525)+1013904223)>>>0;return frontageState/4294967296;};
    const frontPick=a=>a[Math.floor(frontRandom()*a.length)];
    const isDock=theme==='docks',isMarket=theme==='market',isCorporate=theme==='corporate';
    const tint=isDock?'#f7a63d':isMarket?frontPick(['#ff843c','#f0369b','#31d2dd']):isCorporate?'#3fd5ef':frontPick(['#f33dba','#4fbccc','#dea35e']);
    const names=isDock?['GEAR WORKS','KITE FREIGHT','CHROME GARAGE','DOCK 09']:isMarket?['RAMEN 24','BYTE BAR','NIGHT MART','NEUROSHOP']:isCorporate?['AEON SYSTEMS','NEURAL BANK','CROWN OPTICS','MIND MARKET']:['AFTER HOURS','SYNTH CLINIC','MEMORY SHOP','NOVA AUDIO'];
    const label=frontPick(names);
    for(const side of [-1,1]) {
      const face=x+side*(width/2+.1);
      // Shop glazing, industrial shutters, bright mullions and awning fascia.
      b(face,2.15,z,.18,3.85,depth-.55,'#142633','metal');
      if(isDock) {
        b(face+side*.12,2.1,z,.08,3.2,depth*.62,'#657077','metal');
        for(let slat=.7;slat<3.7;slat+=.38)b(face+side*.18,slat,z,.05,.06,depth*.62,'#273c4c','metal');
        for(const end of [-1,1])g(face+side*.2,2.1,z+end*depth*.32,.06,3.25,.065,tint);
      } else {
        const count=depth>18?4:3;
        for(let bay=0;bay<count;bay++) {
          const bayZ=z-depth*.41+(bay+.5)*depth*.82/count,bayW=depth*.82/count-.27;
          b(face+side*.13,1.94,bayZ,.05,2.55,bayW,isMarket?'#b48358':isCorporate?'#477f98':'#617b7f','window');
          b(face+side*.19,1.96,bayZ-bayW/2-.1,.09,3.45,.13,'#6c7f84','metal');
          b(face+side*.23,.9,bayZ,.22,.14,bayW+.12,'#536976','metal');
          b(face+side*.2,2.0,bayZ,.04,.055,bayW,'#1c3649');
        }
      }
      b(face+side*.13,4.01,z,.25,.38,depth+.12,'#435460','metal');
      b(face+side*.42,4.27,z,.95,.16,depth+.35,isMarket?'#735246':'#3c5161','metal');
      g(face+side*.89,4.19,z,.055,.075,depth*.88,tint);
      b(face+side*.08,.47,z,.32,.15,depth+.1,'#586671','metal');
      signs.push({text:label,sub:isDock?'REPAIR / IMPORT / EXPORT':isMarket?'GOOD FOOD / BAD HABITS':'OPEN ALL NIGHT',w:Math.min(9,depth*.65),h:.88,tint,x:face+side*.28,y:3.91,z,ry:side*Math.PI/2,art:'shop',chunk});
      // One exposed utility compressor per street face, with separated voxel fins.
      if(streetSide===0||side===streetSide) {
        const unitZ=z-depth*.28;
        b(face+side*.39,5.75,unitZ,.8,1.0,1.5,'#657078','metal');
        b(face+side*.83,5.75,unitZ,.08,.73,1.18,'#203341');
        for(let fin=0;fin<4;fin++)b(face+side*.9,5.47+fin*.18,unitZ,.04,.055,1.08,'#83919a','metal');
        b(face+side*.32,7.7,unitZ+.72,.13,3.0,.13,'#65808b','metal');
        if(frontRandom()>.38) {
          const bladeZ=z+depth*.22,bladeX=face+side*.83;
          b(bladeX,7.4,bladeZ,1.42,3.58,.35,'#263745','metal');
          signs.push({text:isDock?'GARAGE':isMarket?'NOODLES':isCorporate?'OPTICS':'CLINIC',sub:'24 / 7',w:1.3,h:3.45,tint,x:bladeX,y:7.4,z:bladeZ+.2,ry:0,art:'type',vertical:isDock?'修理':isMarket?'夜市':isCorporate?'電脳':'診療',chunk});
          b(face+side*.35,8.3,bladeZ,1.1,.09,.1,'#66818e','metal');
        }
      }
      // Articulated floor lips and corner pilasters give walls readable depth.
      for(let floor=1;floor<=Math.min(4,Math.floor(height/5));floor++)b(face+side*.16,4.8+floor*(height-6)/Math.min(4,Math.floor(height/5)),z,.37,.14,depth+.15,'#435767','metal');
      for(const end of [-1,1])b(face+side*.05,height*.51,z+end*(depth/2-.18),.24,height-.9,.24,'#344d60','metal');
    }
    for(let i=frontageBoxStart;i<boxes.length;i++)boxes[i].detail='street-frontage';
    for(let i=frontageSignStart;i<signs.length;i++)signs[i].detail='street-frontage';
    return {x,z,width,depth,height,streetSide};
  }
  function districtArchitecture(cx,cz,width,depth,district,buildings) {
    const firstBox=boxes.length,firstSign=signs.length;
    let visualState=(Math.round((cx+701)*103+(cz+903)*733)>>>0)||1;
    const vr=()=>{visualState=(Math.imul(visualState,1664525)+1013904223)>>>0;return visualState/4294967296;};
    const vp=a=>a[Math.floor(vr()*a.length)];
    const activity=district.activity;
    const detailBox=(x,y,z,sx,sy,sz,c,kind='solid',far=false)=>{
      b(x,y,z,sx,sy,sz,c,kind);
      if(far)b(x,y,z,sx,sy,sz,c,kind==='glow'?'glow':'solid',0,'far');
    };
    function campaign(build,index) {
      const side=build.streetSide||1,px=build.x+side*(build.width/2+.44);
      const options=activity==='festival'?[3,3,0]:activity==='industry'?[1,0,2]:activity==='residential'?[1,0]:activity==='medical'?[0,1]:[2,1,2];
      const slot=Math.abs(index),adIndex=options[slot%options.length],posterW=3.0+(slot%3)*.6,posterH=posterW*1.5;
      const py=Math.max(8,Math.min(build.height-3,12+(slot%3)*4)),pz=build.z+build.depth*(slot%2?.21:-.21);
      b(px,py,pz,.18,posterH+.2,posterW+.2,'#30475b','metal');
      signs.push({text:['KURO OPTICS','AXIOM','OFFWORLD','RAMEN 24'][adIndex],sub:'',w:posterW,h:posterH,tint:district.themeColor,x:px+side*.13,y:py,z:pz,ry:side*Math.PI/2,art:'campaign',adIndex,chunk});
    }
    buildings.forEach((build,index)=>{
      const {x,z,width:bw,depth:bd,height:h}=build,side=build.streetSide||1,face=x+side*(bw/2+.18);
      if(activity==='festival') {
        // Layered red market roofs, striped awnings and hot-food counters.
        detailBox(x,h+.62,z,bw+.5,.75,bd+.6,'#65352e','metal',true);
        detailBox(x,h+1.08,z,bw*.9,.22,bd*.92,'#ba6641','metal',true);
        for(let zz=z-bd*.43;zz<z+bd*.43;zz+=1.1) {
          b(face+side*.62,4.6,zz,1.65,.22,.96,(Math.round(zz*10)%2)?'#b83b37':'#d17e3c','metal');
          g(face+side*1.44,4.43,zz,.08,.09,.8,'#ef792b');
        }
        for(let n=0;n<3;n++) {
          const zz=z+(n-1)*Math.min(4,bd*.27),xx=face+side*.82;
          b(xx,.95,zz,.95,1.45,2.4,'#784c35','metal');
          b(xx,1.74,zz,1.13,.13,2.6,'#b3a37a','metal');
          for(let bowl=0;bowl<3;bowl++)g(xx,1.89,zz-.68+bowl*.65,.42,.13,.35,bowl===1?'#ffd095':'#b47642');
          b(face+side*.75,3.23,zz,.56,.85,.56,'#962f20');
          g(face+side*.77,3.23,zz,.47,.62,.47,'#ff8a2d');
        }
      } else if(activity==='industry') {
        // Rusty pressure mains, large ribbed chimneys, hazard paint and roof cranes.
        for(const end of [-1,1]) {
          const pipeZ=z+end*bd*.33;
          b(face+side*.38,h*.54,pipeZ,.54,h*.85,.54,'#46807e','metal');
          for(let clamp=4;clamp<h;clamp+=2){b(face+side*.38,clamp,pipeZ,.72,.18,.72,'#bd9350','metal');b(x+side*(bw/2+.28),clamp,pipeZ,.67,.13,.19,'#687b7c','metal');}
          for(let stripe=0;stripe<7;stripe++)b(face+side*.31,.9+stripe*.39,z+end*(bd*.44),.06,.23,.8,stripe%2?'#293b42':'#cea134','metal');
        }
        b(face+side*.47,6.2,z,.7,.65,bd*.78,'#806041','metal');
        for(const stack of [-1,1]) {
          const sh=6+index%3*2,xx=x+stack*bw*.24,zz=z-bd*.15;
          detailBox(xx,h+sh/2+.2,zz,1.5,sh,1.5,'#54706c','metal',true);
          for(let band=0;band<3;band++)detailBox(xx,h+1.5+band*(sh/3),zz,1.65,.62,1.65,band%2?'#7e4334':'#b89755','metal',true);
          g(xx,h+sh+.24,zz,1.3,.08,1.3,'#bb7940');
        }
        if(index%2===0) {
          const craneX=x-side*bw*.25,craneY=h+12;
          detailBox(craneX,h+5.7,z,1.05,11.4,1.05,'#a17f39','metal',true);
          detailBox(craneX,craneY,z+5,1.5,1.15,16,'#ba943f','metal',true);
          for(let rib=0;rib<9;rib++)b(craneX,craneY+.84,z-2+rib*1.6,1.5,.13,.16,'#786238','metal');
          b(craneX,craneY-4,z+12,.055,8,.055,'#647d87','metal');
          g(craneX,craneY+1.25,z,.19,.35,.19,'#f15130');
        }
      } else if(activity==='residential') {
        // Offset violet housing pods with terraces, railings and lived-in laundry.
        for(let tier=0;tier<3;tier++) {
          const py=8+tier*6;if(py+2>h)continue;
          for(const unit of [-1,1]) {
            const pz=z+unit*bd*.24+(tier%2?.7:-.3),px=face+side*.58;
            b(px,py,pz,1.55,3.1,4.15,vp(['#665075','#484264','#6b425f','#314b63']));
            b(px+side*.82,py+.2,pz,.08,1.4,2.55,'#3d203e');
            g(px+side*.88,py+.18,pz,.035,1.1,1.94,tier%2?'#aa438d':'#6536a1');
            b(px+side*.77,py-1.65,pz,2.5,.2,4.65,'#59526b','metal');
            b(px+side*1.94,py-1.01,pz,.07,1.13,4.65,'#8f7398','metal');
            for(let bar=0;bar<5;bar++)b(px+side*1.97,py-.99,pz-1.9+bar*.95,.09,1.05,.07,'#644e75','metal');
            if(tier===1) {
              b(px+side*1.5,py+.8,pz,.035,.035,4.4,'#907d93','metal');
              for(const end of [-1,1])b(px+side*1.5,py+.19,pz+end*2.17,.045,1.3,.045,'#8b7795','metal');
              for(let cloth=0;cloth<4;cloth++){b(px+side*1.52,py+.3,pz-1.4+cloth*.9,.04,.8,.63,vp(['#b56471','#587d91','#c59871','#8d5e97']));b(px+side*1.52,py+.75,pz-1.4+cloth*.9,.04,.16,.04,'#927b8c');}
            }
          }
        }
        detailBox(x,h+.7,z,bw+.45,1.0,bd+.4,'#4b385c','metal',true);
        detailBox(x,h+1.22,z+bd/2+.25,bw*.86,.15,.13,'#ba32c4','glow',true);
        signs.push({text:['AFTERLIFE CLUB','BLOCK PARTY','SLEEP / REPEAT','NOISE FLOOR'][index%4],sub:'STACKTOWN / AFTER DARK',w:Math.min(9,bd*.7),h:1.3,tint:'#f25ad9',x:face+side*.42,y:5.25,z,ry:side*Math.PI/2,art:'shop',chunk});
      } else if(activity==='medical') {
        // Clean white ribs, acid-green diagnostic instruments and cyan light wells.
        for(const strip of [-1,0,1]) {
          const zz=z+strip*bd*.36;
          b(face+side*.2,h*.5,zz,.54,h-.8,.48,'#a5bdc9','metal');
          g(face+side*.52,h*.53,zz,.07,h*.76,.10,strip===0?'#87d731':'#239dab');
        }
        for(let level=6;level<h-1;level+=8) {
          b(face+side*.34,level,z,.8,.55,bd*.86,'#93a9b9','metal');
          g(face+side*.78,level+.08,z,.06,.18,bd*.67,'#2fcac5');
        }
        const dy=Math.min(h-3,12),dz=z+bd*.2;
        b(face+side*.6,dy,dz,.45,4.2,3.5,'#31545c','metal');
        g(face+side*.85,dy,dz,.04,.62,2.6,'#b3ed56');
        g(face+side*.85,dy,dz,.04,2.7,.59,'#b3ed56');
        for(let signal=0;signal<6;signal++)g(face+side*.72,5.8+signal*.47,z-bd*.25,.06,.18,.35+signal*.2,'#69e9d3');
        detailBox(x,h+.8,z,bw*.91,1.25,bd*.92,'#7498aa','metal',true);
        detailBox(x,h+1.47,z+bd*.46,bw*.78,.22,.18,'#89cf53','glow',true);
        signs.push({text:['KURO / OPTICS','GENOME CLINIC','SYNAPSE LAB','BIO REPAIR'][index%4],sub:'MERIDIAN / HUMAN SYSTEMS',w:Math.min(9,bd*.7),h:1.2,tint:'#a7ef73',x:face+side*.4,y:5.3,z,ry:side*Math.PI/2,art:'shop',chunk});
      } else if(activity==='luxury') {
        // Blue-violet facades with gold mullions and layered luxury tower crowns.
        for(const strip of [-1,1]) {
          const zz=z+strip*bd*.39;
          b(face+side*.23,h*.52,zz,.42,h*.94,.46,'#8c805c','metal');
          g(face+side*.49,h*.52,zz,.045,h*.9,.08,'#9c8952');
        }
        for(let tier=0;tier<3;tier++) {
          const ratio=1-tier*.12;
          detailBox(x,h+.7+tier*.8,z,bw*ratio,.9,bd*ratio,'#354966','metal',true);
          detailBox(x,h+1.15+tier*.8,z+bd*ratio/2,bw*ratio,.14,.17,tier===2?'#d2b06a':'#6579db','glow',true);
        }
        for(let ledge=9;ledge<h;ledge+=12) {
          b(face+side*.34,ledge,z,.87,.24,bd*.84,'#657282','metal');
          for(let plant=0;plant<3;plant++){b(face+side*.64,ledge+.4,z+(plant-1)*bd*.23,.65,.62,1.6,'#384548');b(face+side*.64,ledge+1,z+(plant-1)*bd*.23,.8,.8,1.8,'#387164');}
        }
        signs.push({text:['OFFWORLD LOUNGE','AUREL / RESIDENCES','CROWN EXCHANGE','ORBITAL CLUB'][index%4],sub:'ABOVE THE EVERYDAY',w:Math.min(9,bd*.7),h:1.15,tint:'#c5b576',x:face+side*.42,y:5.2,z,ry:side*Math.PI/2,art:'shop',chunk});
      }
      if(index%2===0)campaign(build,index+Math.floor(cx/30));
    });
    // Large district silhouettes remain legible while driving down the avenues.
    if(width>25) {
      const avenue=cx-width/2-15;
      if(activity==='festival') {
        for(const offset of [-.3,0,.3]) {
          const lz=cz+offset*depth;
          const id='CON-'+chunk+'-lantern-'+offset;
          const supportIds=[...column(avenue-15,lz,10.3,id),...column(avenue+15,lz,10.3,id)];
          elevatedConnections.push({id,label:'Grounded lantern canopy',kind:'lantern-canopy',x:avenue,y:9,z:lz,sx:30,sy:3,sz:.6,from:{x:avenue-15,y:10.2,z:lz},to:{x:avenue+15,y:10.2,z:lz},supportIds,chunk});
          for(let step=0;step<=30;step++) {
            const ly=10.2-Math.sin(step/30*Math.PI)*1.65;
            b(avenue-15+step,ly,lz,1.06,.04,.04,'#836442','metal');
            if(step>0) {
              const previousY=10.2-Math.sin((step-1)/30*Math.PI)*1.65;
              b(avenue-15+step-.5,(ly+previousY)/2,lz,.12,Math.abs(previousY-ly)+.05,.045,'#836442','metal');
            }
            if(step%4===2) {
              b(avenue-15+step,ly-.35,lz,.035,.65,.035,'#785345');
              g(avenue-15+step,ly-.95,lz,.49,.66,.49,step%8===2?'#ff7828':'#dd3723');
              b(avenue-15+step,ly-.6,lz,.6,.12,.6,'#81462c');
              b(avenue-15+step,ly-1.32,lz,.53,.1,.53,'#9e542c');
            }
          }
        }
      } else if(activity==='residential') {
        // A purple utility catwalk and colorful hanging laundry cross high overhead.
        const id='CON-'+chunk+'-catwalk',supportIds=[];
        for(const end of [-1,1])for(const side of [-1,1])supportIds.push(...column(avenue+end*15.2,cz+side*.93,15.1,id));
        supportIds.push(sup(avenue,15.1,cz,31,.4,2.2,'#4b415f','catwalk deck',id));
        elevatedConnections.push({id,label:'Supported residential catwalk',kind:'catwalk',x:avenue,y:15.1,z:cz,sx:31,sy:2.4,sz:2.3,from:{x:avenue-15.2,y:15.1,z:cz},to:{x:avenue+15.2,y:15.1,z:cz},supportIds,chunk});
        for(let post=-15;post<=15;post+=1.4)b(avenue+post,15.8,cz+1,.055,1.2,.055,'#806187','metal');
        b(avenue,16.4,cz+1,31,.08,.09,'#a479a8','metal');
        g(avenue,14.83,cz+1.15,25,.1,.09,'#9e329a');
        for(let cloth=0;cloth<11;cloth++){b(avenue-12+cloth*2.4,14.1,cz+1.2,.95,1.1,.05,vp(['#8f596f','#89765c','#527992','#85649b']));b(avenue-12+cloth*2.4,14.85,cz+1.12,.045,.46,.19,'#9a7c99','metal');}
      } else if(activity==='luxury') {
        // Suspended segmented orbital rings form a recognizable district gateway.
        const ringY=17.5,ringZ=cz+depth*.18;
        const id='CON-'+chunk+'-orbital',supportIds=[...column(avenue-13.2,ringZ,23.1,id),...column(avenue+13.2,ringZ,23.1,id)];
        supportIds.push(sup(avenue,23,ringZ,26.7,.23,.23,'#6c7594','orbital crossbeam',id));
        for(let segment=0;segment<48;segment++) {
          const angle=segment/48*Math.PI*2,xx=avenue+Math.cos(angle)*5.4,yy=ringY+Math.sin(angle)*5.4;
          detailBox(xx,yy,ringZ-.22,.83,.83,.18,'#34465f','metal',true);
          detailBox(xx,yy,ringZ,.55,.55,.52,segment%6<3?'#516bb6':'#af925b','metal',true);
          detailBox(xx,yy,ringZ+.29,.31,.31,.08,segment%6<3?'#567cef':'#e0ba70','glow',true);
        }
        supportIds.push(sup(avenue,22.95,ringZ-.1,.2,.45,.4,'#8494ac','orbital hanger',id));
        elevatedConnections.push({id,label:'Grounded orbital ring gateway',kind:'orbital-gantry',x:avenue,y:17.5,z:ringZ,sx:26.7,sy:11.7,sz:1,from:{x:avenue-13.2,y:23,z:ringZ},to:{x:avenue+13.2,y:23,z:ringZ},supportIds,chunk});
      } else if(activity==='industry') {
        // Elevated teal pressure conduits and hazard-colored gantries.
        const id='CON-'+chunk+'-pipe',supportIds=[...column(avenue-13.5,cz,11.5,id),...column(avenue+13.5,cz,11.5,id)];
        supportIds.push(sup(avenue,11.4,cz,31,.8,.8,'#447c79','pressure bridge',id));
        for(let clamp=-14;clamp<15;clamp+=2.5)b(avenue+clamp,11.4,cz,.18,1.03,1.03,'#b09248','metal');
        elevatedConnections.push({id,label:'Grounded industrial pipe bridge',kind:'pipe-bridge',x:avenue,y:11.4,z:cz,sx:31,sy:1.1,sz:1.1,from:{x:avenue-13.5,y:11.4,z:cz},to:{x:avenue+13.5,y:11.4,z:cz},supportIds,chunk});
      }
    }
    const campaignChoices=activity==='festival'?[3,0]:activity==='industry'?[1,0]:activity==='residential'?[1,0]:activity==='medical'?[0,1]:[2,1];
    for(const spec of signs)if(spec.chunk===chunk&&spec.art==='campaign'&&spec.detail!=='district-theme') {
      spec.adIndex=campaignChoices[Math.abs(Math.round(spec.x+spec.z))%campaignChoices.length];
      spec.text=['KURO OPTICS','AXIOM','OFFWORLD','RAMEN 24'][spec.adIndex];
    }
    for(let i=firstBox;i<boxes.length;i++)boxes[i].detail='district-theme';
    for(let i=firstSign;i<signs.length;i++)signs[i].detail='district-theme';
  }
  const xEdges=[-310,-210,-90,0,90,210,310];
  let blockIndex=0;
  function cityBlock(cx,cz,width,depth,forcedTheme) {
    const district=nearestDistrict(cx,cz);
    const theme=forcedTheme||(district.name==='Iron Docks'?'docks':district.name==='Lantern Market'?'market':district.name==='Crown Plaza'?'corporate':'residential');
    chunk='block-'+blockIndex++;chunks.push({id:chunk,x:cx,z:cz,sx:width,sz:depth,radius:Math.hypot(width,depth)/2,theme,district:district.name});
    b(cx,.085,cz,width,.2,depth,theme==='corporate'?'#2e404b':'#24323f','pavement');
    // Four corner buildings leave a service courtyard inside every urban block.
    const bw=Math.min(21,width*.32),bd=Math.min(22,depth*.32);
    const buildings=[];
    for(const dx of [-1,1])for(const dz of [-1,1]) {
      const x=cx+dx*(width/2-bw/2-1.2),z=cz+dz*(depth/2-bd/2-1.2);
      const h=theme==='market'?8+rand()*13:theme==='docks'?7+rand()*8:theme==='corporate'?28+rand()*42:17+rand()*29;
      buildings.push(smallBuilding(x,z,bw,bd,h,theme,1,dx));
    }
    if(theme==='corporate') {
      const h=52+rand()*34;
      buildings.push(smallBuilding(cx,cz,Math.min(16,width*.25),Math.min(17,depth*.25),h,'corporate',2));
      for(let y=14;y<h;y+=8)g(cx+8.1,y,cz,.1,5,.1,'#21c6e4');
      for(let f=0;f<5;f++)b(cx-11,1.5,cz-10+f*5,1.4,2.2,1.4,'#325a52');
    } else if(theme==='docks') {
      for(let n=0;n<9;n++) {
        const x=cx+(n%3-1)*4.7,z=cz+(Math.floor(n/3)-1)*6.8;
        b(x,1.5,z,3.2,2.8,5.8,pick(['#805c39','#3c5e66','#764552','#475b6b']),'metal');
        colliders.push({x,y:1.5,z,sx:3.2,sy:2.8,sz:5.8,chunk});
        for(let rib=-2.3;rib<2.6;rib+=.6)b(x+1.64,1.5,z+rib,.08,2.65,.09,'#30444f','metal');
      }
      b(cx,12,cz,1.1,23,1.1,'#746039','metal');
      b(cx,22.3,cz+8,1.3,1.1,20,'#84713f','metal');
      b(cx,17,cz+16,.06,10,.06,'#426276','metal');
      g(cx,23.2,cz,.23,.36,.23,'#ef4d39');
    } else {
      // Courtyard stalls, small trees and lit service kiosks fill the district.
      for(let n=0;n<6;n++) {
        const x=cx+(n%2?1:-1)*8,z=cz-8+Math.floor(n/2)*8;
        b(x,.55,z,2.1,.9,2.1,'#33424a');
        if(theme==='market') {
          b(x,1.5,z,2.7,.15,2.8,'#825949','metal');
          b(x,2.75,z,3.5,.18,3.3,pick(['#834759','#a2693c','#3c7581']));
          for(const s of [-1,1])b(x+s*1.4,1.85,z,.07,1.6,.07,'#4c6670','metal');
          g(x,2.61,z+1.7,2.9,.07,.06,'#ff9b51');
        } else {b(x,1.8,z,.25,2.4,.25,'#4e594d');b(x,3.0,z,1.9,1.3,1.8,'#285650');}
      }
    }
    // Visible district names at the corners aid navigation without adding quests.
    const supportBoxStart=boxes.length;
    const districtSignX=cx-width/2+bw/2+1.2,districtSignZ=cz+depth/2-1.03;
    b(districtSignX,4.7,districtSignZ-.12,8.3,1.72,.2,'#344855','metal');
    signs.push({text:district.name.toUpperCase(),sub:'FREE CITY / OPEN ALL NIGHT',w:8,h:1.5,tint:district.color,x:districtSignX,y:4.7,z:districtSignZ+.015,ry:0,art:'shop',chunk});
    if(blockIndex%3===0) {
      const adX=cx-width*.3,adZ=cz+depth/2+.1;
      b(adX,13,adZ-.16,4.26,6.26,.25,'#354758','metal');
      for(const side of [-1,1])b(adX+side*1.6,8.9,adZ-.24,.13,8.0,.13,'#567181','metal');
      signs.push({text:['CHROME OPTICS','SYNTHETIC SELF','ORBITAL DREAMS','RAMEN 24'][Math.floor(blockIndex/3)%4],sub:'',w:4,h:6,tint:'#ff349f',x:adX,y:13,z:adZ,ry:0,art:'campaign',adIndex:Math.floor(blockIndex/3)%4,chunk});
    }
    for(let i=supportBoxStart;i<boxes.length;i++)boxes[i].detail='street-frontage';
    for(let n=0;n<20;n++) {
      const x=cx+(rand()-.5)*width,z=cz+(rand()-.5)*depth;
      b(x,.207,z,.3+rand()*.7,.015,.2+rand()*.5,pick(['#273e4b','#1d2e3a','#3b4145']),'pavement');
    }
    districtArchitecture(cx,cz,width,depth,district,buildings);
  }
  for(let row=0;row<crossings.length-1;row++)for(let col=0;col<xEdges.length-1;col++) {
    const cx=(xEdges[col]+xEdges[col+1])/2,cz=(crossings[row]+crossings[row+1])/2;
    // The original authored core occupies these six parcels, including its skyline.
    if(Math.abs(cx)<70&&cz<50&&cz> -300)continue;
    cityBlock(cx,cz,xEdges[col+1]-xEdges[col]-30,crossings[row]-crossings[row+1]-30);
  }
  for(const x of [-332,332])for(const z of [96,-360])cityBlock(x,z,18,54,x>0?'docks':'residential');
  // Road signs at the two clear entries to the original Kasumi corridor.
  chunk='infrastructure';
  for(const z of [50,-180]) {
    for(const side of [-1,1])b(side*13.4,4,z+15,.13,7.8,.13,'#345366','metal');
    signs.push({text:z===50?'KASUMI WARD':'CROWN / DOCKS / STACKTOWN',sub:z===50?'NORTH / NEON DISTRICT':'← WEST LOOP       EAST LOOP →',w:z===50?9:13,h:1.6,tint:'#47d9e6',x:0,y:7.5,z:z+15,ry:0,art:'shop',chunk});
  }
  const loop=(region,x1,x2,z1,z2,height=5)=>({region,height,speed:4.8,points:[{x:x1,z:z1},{x:x2,z:z1},{x:x2,z:z2},{x:x1,z:z2}]});
  const patrolRoutes=[
    {region:'Kasumi Ward',height:4.7,speed:4.5,points:[{x:-5,z:35},{x:-5,z:-155}]},
    {region:'Kasumi Ward',height:5.5,speed:4.8,points:[{x:5,z:-155},{x:5,z:35}]},
    loop('Lantern Market',-210,-90,50,140),loop('Lantern Market',-310,-210,50,140),
    loop('Iron Docks',90,210,50,140),loop('Iron Docks',210,310,-70,50),
    loop('Stacktown',-310,-210,-300,-180),loop('Stacktown',-210,-90,-420,-300),
    loop('Meridian East',90,210,-300,-180),loop('Meridian East',210,310,-420,-300),
    loop('Crown Plaza',-90,0,-540,-420,6),loop('Crown Plaza',0,90,-420,-300,6)
  ];
  const roadLength=roads.reduce((n,r)=>n+Math.max(r.sx,r.sz),0);
  return {boxes,signs,colliders,roads,chunks,districts,bounds,patrolRoutes,supports,elevatedConnections,citySize:{width:700,depth:790,roadLength,blocks:blockIndex}};
}
