import { createExpansionLayout } from './city-expansion.js';
import { enforceCityPlacements } from './city-blueprint.js';
import { applyAdvertCampaigns } from './advert-campaigns.js';
import { applyStreetDetails } from './street-detail.js';
import { applyBlockCompositions } from './block-compositions.js';
import { applyHousingCompositions } from './housing-compositions.js';
import { applyIronDocksCompositions } from './iron-docks-compositions.js';
// Pure deterministic art layout. Shared by the browser and the Blender scene builder.
export function createCityLayout() {
  let state=938217;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const choice=a=>a[Math.floor(random()*a.length)];
  const boxes=[],signs=[],colliders=[],footprints=[],supports=[],elevatedConnections=[];
  let currentBlock=null;
  const b=(x,y,z,sx,sy,sz,c='#172230',kind='solid',ry=0)=>boxes.push({x,y,z,sx,sy,sz,c,kind,ry,blockId:currentBlock});
  const g=(x,y,z,sx,sy,sz,c='#21cef3')=>b(x,y,z,sx,sy,sz,c,'glow');
  const sup=(x,y,z,sx,sy,sz,role,attachedTo)=>{
    const id='SUP-C'+String(supports.length+1).padStart(3,'0');b(x,y,z,sx,sy,sz,'#3c5268','metal');boxes[boxes.length-1].supportId=id;
    supports.push({id,x,y,z,sx,sy,sz,baseY:y-sy/2,role,attachedTo,chunk:'core'});return id;
  };
  const column=(x,z,height,id)=>[sup(x,.18,z,.55,.26,.55,'foundation',id),sup(x,(height+.18)/2,z,.17,height-.18,.17,'ground column',id)];
  const w=(x,y,z,sx,sy,sz,c)=>b(x,y,z,sx,sy,sz,c,'window');
  const sign=(text,sub,width,height,tint,x,y,z,ry=0,art,vertical)=>signs.push({text,sub,w:width,h:height,tint,x,y,z,ry,art,vertical,blockId:currentBlock});
  const palette=['#111b28','#172230','#1b2530','#242c38','#202c38','#131e29','#2b303a'];
  const windowColors=['#ffb677','#ecdbb6','#6cc7dd','#64adbe','#8fcede','#ffcd9d','#39819c'];
  const darkColors=['#142a3b','#152635','#203341','#1b3143'];
  const bounds={minX:-350,maxX:350,minZ:-600,maxZ:190};
  b(0,-.55,-205,700,1,790,'#0b121c');
  b(0,-.015,-72,22,.08,215,'#101c28','pavement');
  for(const side of [-1,1]) {
    b(side*14,.03,-66.25,5.9,.27,203.5,'#25303c','pavement');
    for(let z=37;z> -168;z-=.65) {
      b(side*11.12,.17,z,.27,.24,.59,choice(['#414650','#283444','#4b4e52']));
      if(random()<.12)g(side*11.34,.12,z,.04,.06,.35,side<0?'#996450':'#396a81');
    }
    for(let i=0;i<550;i++) {
      const x=side*(11.5+random()*5.1),z=36-random()*203;
      b(x,.177,z,.3+random()*.8,.016,.2+random()*.5,choice(['#303945','#212d39','#141f2d']),'pavement');
    }
  }
  for(let z=35;z> -175;z-=10)for(const x of [-.18,.18])b(x,.035,z,.07,.02,3.5,'#766e50','pavement');
  for(let z of [22,-38,-99,-154])for(let x=-10;x<11;x+=1.7)b(x,.04,z,1.05,.016,3.2,'#52606a','pavement');
  // Fine patched asphalt and separated short reflection streaks, never a uniform mirror.
  for(let i=0;i<1050;i++) {
    const x=(random()-.5)*21.7,z=38-random()*215;
    b(x,.043,z,.07+random()*.35,.01,.1+random()*.8,choice(['#182b3a','#0a1825','#1c2938','#252733']),'pavement');
  }

  function ac(side,front,y,z,size=1) {
    b(front-side*.32,y,z,.62*size,.72*size,1.1*size,'#4a4a4b','metal');
    b(front-side*.66,y,z,.04,.49*size,.55*size,'#101926');
    for(let k=0;k<4;k++)b(front-side*.7,y-.24*size+k*.15*size,z,.04,.04,.53*size,'#63707a','metal');
    b(front-side*.73,y,z,.05,.26,.09,'#293846');
    b(front-side*.73,y,z,.05,.09,.26,'#293846');
    b(front-side*.25,y-.64*size,z+.36*size,.12,.62*size,.1,'#56606b','metal');
  }
  function fireEscape(side,front,h,z) {
    for(let y=5;y<h-3;y+=3.2) {
      b(front-side*.64,y,z,1.45,.12,3.15,'#293748','metal');
      for(let zz=z-1.45;zz<=z+1.5;zz+=.42)b(front-side*1.32,y+.5,zz,.045,.9,.045,'#46576a','metal');
      b(front-side*1.32,y+.96,z,.07,.06,3.1,'#354759','metal');
      for(let step=0;step<12;step++)b(front-side*.57,y+.22+step*.25,z-1.2+step*.2,1.1,.08,.24,'#455361','metal');
    }
  }
  function building(side,inner,z,width,depth,height,detail=1,shop=false) {
    const x=side*(inner+width/2),front=side*inner;
    const previousBlock=currentBlock;currentBlock=`core-building-${side}-${inner}-${z}`;
    footprints.push({id:currentBlock,x,z,sx:width,sz:depth});
    const c=choice(palette);
    b(x,height/2,z,width,height,depth,c);
    colliders.push({x,y:height/2,z,sx:width,sy:height,sz:depth,blockId:currentBlock});
    // Heavy imperfect cornices and staggered rooftop structures.
    b(x,height-.2,z,width+.35,.5,depth+.45,'#283240');
    b(x+side*.55,height+1.5,z-.8,width*.56,3,depth*.48,choice(palette));
    b(x+side*.55,height+3.05,z-.8,width*.58,.2,depth*.51,'#334251');
    for(let r=0;r<4;r++) {
      const rx=x+(random()-.5)*width*.7,rz=z+(random()-.5)*depth*.7;
      b(rx,height+.7,rz,.7+random(),1.3,1.1+random(),'#343e4b','metal');
      for(let sl=0;sl<3;sl++)b(rx,height+1.39,rz-.35+sl*.3,.72,.05,.05,'#131f2c');
    }
    // Small brick/voxel plates break silhouettes and all street-facing masonry.
    if(detail) {
      for(let y=.55;y<height-.6;y+=.47)for(let zz=z-depth/2+.25;zz<z+depth/2-.2;zz+=.62) {
        if(random()>.48*detail)continue;
        b(front-side*(.045+random()*.09),y,zz,.12+random()*.14,.28+random()*.11,.44+random()*.12,choice(palette));
      }
      for(let y=1;y<height-.5;y+=.51)for(let xx=x-width/2+.35;xx<x+width/2-.3;xx+=.65) {
        if(random()>.5*detail)continue;
        b(xx,y,z+depth/2+.07,.44+random()*.12,.29+random()*.11,.12+random()*.1,choice(palette));
      }
    }
    const floor=2.15;
    for(let y=shop?6.25:2.1;y<height-1.1;y+=floor) {
      b(front-side*.13,y-.73,z,.24,.15,depth+.15,'#0e1927');
      for(let zz=z-depth/2+1;zz<z+depth/2-.65;zz+=1.42) {
        const lit=random()>.33;
        b(front-side*.16,y,zz,.2,1.04,.87,'#08121e');
        w(front-side*.275,y,zz,.027,.69,.53,lit?choice(windowColors):choice(darkColors));
        b(front-side*.3,y,zz,.036,.044,.63,'#111b29');
        b(front-side*.3,y,zz,.036,.76,.035,'#111b29');
        if(random()<.18) b(front-side*.35,y-.58,zz,.55,.13,1.01,'#45505c','metal');
      }
      for(let xx=x-width/2+.8;xx<x+width/2-.5;xx+=1.46) {
        b(xx,y,z+depth/2+.08,.85,1.01,.18,'#08111d');
        w(xx,y,z+depth/2+.185,.52,.66,.027,random()>.38?choice(windowColors):choice(darkColors));
        b(xx,y,z+depth/2+.21,.63,.035,.035,'#142030');
        b(xx,y,z+depth/2+.21,.035,.75,.035,'#142030');
      }
    }
    // Dark supporting beams stay thin and irregular instead of flattening the facade.
    for(let zz=z-depth/2+.5;zz<z+depth/2;zz+=5.2) {
      b(front-side*.13,height*.49,zz,.22,height*.97,.14,'#0c1724');
      for(let y=4;y<height;y+=4.5)b(front-side*.3,y,zz,.12,.19,.48,'#344150');
    }
    if(detail>.6) {
      const pipeZ=z-depth/2+1.6;
      b(front-side*.35,height*.49,pipeZ,.18,height-.7,.18,'#58606a','metal');
      for(let y=2;y<height;y+=2)b(front-side*.37,y,pipeZ,.25,.12,.25,'#817265','metal');
      for(let a=0;a<Math.floor(height/4);a++)ac(side,front,5+a*3.1,z-depth*.3+(a%3)*3.1,.7+random()*.4);
      if(random()>.35)fireEscape(side,front,height,z+depth*.3);
    }
    if(shop) {
      b(front-side*.18,2,z,.25,3.8,depth-.7,'#08111c');
      for(let zz=z-depth/2+1.5;zz<z+depth/2-.5;zz+=2.25) {
        w(front-side*.32,1.85,zz,.04,2.8,1.73,side<0?'#945830':'#4c6268');
        b(front-side*.38,1.85,zz-.94,.14,3.4,.12,'#485362','metal');
        b(front-side*.4,1.12,zz,.14,.06,1.83,'#263749');
        for(let shelf=0;shelf<3;shelf++)for(let item=0;item<4;item++)b(front-side*.43,.52+shelf*.68,zz-.57+item*.35,.14,.12+random()*.2,.14,choice(['#c88951','#577d79','#ded3a9','#943e55']));
      }
      // Patched metal awning with emissive underside and visible brackets.
      b(front-side*.95,4.2,z,2.4,.18,depth+.4,side<0?'#523529':'#263944','metal');
      for(let zz=z-depth/2;zz<z+depth/2;zz+=.52)b(front-side*1.0,4.32,zz,2.45,.06,.08,'#455057','metal');
      g(front-side*1.84,4.05,z,.08,.08,depth*.7,side<0?'#ff9a3d':'#63d7e8');
      for(let zz=z-depth/2+.4;zz<z+depth/2;zz+=4.4)b(front-side*1.6,3.55,zz,.08,1.3,.08,'#36404b','metal');
    }
    const id=currentBlock;currentBlock=previousBlock;
    return {x,front,z,width,depth,height,id};
  }

  const lowLeft=[{z:20,h:32,d:20,in:16},{z:-7,h:19,d:17,in:17},{z:-31,h:14,d:18,in:16},{z:-56,h:21,d:17,in:17.5},{z:-80,h:12,d:18,in:16},{z:-105,h:19,d:18,in:17},{z:-132,h:15,d:20,in:17},{z:-160,h:16,d:16,in:17}];
  const lowRight=[{z:22,h:27,d:20,in:18},{z:-6,h:20,d:17,in:17},{z:-31,h:16,d:18,in:18},{z:-57,h:17,d:18,in:16.7},{z:-81,h:14,d:18,in:18},{z:-106,h:21,d:19,in:17},{z:-134,h:16,d:20,in:18},{z:-160,h:17,d:15,in:17}];
  const labels=[['麺屋','NOODLES'],['診療','CHROME'],['音楽','NOVA'],['夜市','MARKET'],['記憶','MEMORY'],['電脳','CYBER']];
  for(const side of [-1,1]) {
    const row=side<0?lowLeft:lowRight;
    row.forEach((spec,index)=>{
      const build=building(side,spec.in,spec.z,10+random()*4,spec.d,spec.h,index<3?1:.66,true);
      // Many small light boxes attached to the masonry, with varied proportions.
      const label=labels[(index+(side>0?2:0))%labels.length];
      const tint=choice(['#ff672d','#e92192','#1cc4ec','#ffd17e']);
      const bladeZ=spec.z+spec.d*.31;
      b(build.front-side*.65,7.3,bladeZ,1.2,4.6,.32,'#20202e','metal');
      sign(label[1],'24 / 7',1.15,4.5,tint,build.front-side*.66,7.3,bladeZ+.18,0,'type',label[0]);
      sign(index===0&&side<0?'NOODLES':label[1],'',Math.min(7,spec.d*.55),.93,tint,build.front-side*.32,3.5,spec.z,side<0?Math.PI/2:-Math.PI/2,'shop');
      for(let t=0;t<8;t++) {
        const zz=spec.z+(random()-.5)*(spec.d-1),xx=side*(spec.in-1-random()*1.5);
        b(xx,.25,zz,.4+random()*.55,.45,.4+random()*.4,choice(['#5b4032','#344752','#61503c','#543748']));
        if(t%3===0){b(xx,.64,zz,.45,.34,.42,'#806249');for(let fruit=0;fruit<4;fruit++)b(xx+(fruit%2)*.15-.08,.88,zz+Math.floor(fruit/2)*.15-.08,.13,.14,.13,'#d88b44');}
      }
      if(index===0||index===3||index===5)for(const offset of [-3,3]) {
        const zz=spec.z+offset;
        b(side*(spec.in-1.8),2.7,zz,.4,.85,.4,'#7b2f23');
        g(side*(spec.in-1.8),2.7,zz,.31,.64,.31,'#ff9a32');
        b(side*(spec.in-1.8),3.26,zz,.07,.45,.07,'#23303d');
      }
    });
    // Staggered medium towers set behind the short shop fronts leave the sky open.
    for(let i=0;i<7;i++) {
      const z=5-i*28+(side>0?11:-4),inner=30+random()*10,h=31+random()*26;
      building(side,inner,z,10+random()*8,16+random()*8,h,.22,false);
      if(i%2===0) {
        const sx=side*(inner+3),top=h+3;
        b(sx,top+4,z,4,8,5,'#172737');
        g(sx-side*2.03,top+4,z+2.53,.05,7.8,.05,'#16869f');
        b(sx,top+11,z,.13,7,.13,'#435569','metal');
        g(sx,top+14.7,z,.15,.4,.15,'#ef2c97');
      }
    }
  }

  // Concept's large, full-bleed portrait and cyan ads are architectural surfaces.
  b(-17.5,21,3,8.5,14.5,.7,'#293142','metal',.14);
  sign('HUMAN+','',8.0,14,'#ff299d',-17.5,21,3.41,.14,'portrait');
  // No glass in front of the art; small projecting brackets make the slab tangible.
  for(const y of [13.7,28.3])b(-17.5,y,3.15,8.75,.18,1.0,'#333e4c','metal',.14);
  sign('神経回路','CHROME / NEW HUMAN',7,5,'#2edcff',-13.2,11.0,-8,0,'circuit');
  b(19,11.8,10,10.2,5.8,.5,'#273142','metal',-.16);
  sign('記憶','RECALL / TOMORROW',9.8,5.4,'#37dcff',19,11.8,10.3,-.16,'circuit');
  sign('夢','SYNTHETIC DREAMS',8.4,12.6,'#ed3bb4',23,29,-43,.06,'dancer');
  sign('AI','MIND / MACHINE',5.2,9.2,'#ef39be',-23,36,-61,.02,'portrait');
  sign('視覚','OPTIC SYSTEMS',7.6,4.8,'#24c9fc',27,22,-95,-.1,'circuit');
  // Near-left noodle shop exactly anchors the warm corner in the concept.
  sign('NOODLES','',5.7,1.15,'#ff9a35',-12.8,5.9,12,.1,'shop');
  b(-12.85,5.9,11.72,6.15,1.5,.35,'#673d20','metal',.1);
  // Put another face on the main side frontage for all approach angles.
  sign('NOODLES','HOT FOOD / 24H',7.2,1.15,'#ff9c38',-15.65,5.55,20,Math.PI/2,'shop');
  for(let i=0;i<14;i++) {
    const z=12+i*.62;
    g(-15.55,3.65,z,.1,.12,.38,'#ffd092');
    b(-15.45,1.35,z,.45,.12,.44,'#a78053','metal');
    b(-15.2,.75,z,.5,.9,.55,'#51352c');
  }
  // Pagoda awning trims and loose suspended lanterns add overlapping silhouettes.
  for(let i=0;i<5;i++) {
    const z=15+i*1.8;
    b(-13.9,4.05,z,.5,.9,.5,'#8b361f');
    g(-13.9,4.05,z,.42,.66,.42,'#ff8a2b');
    b(-13.9,4.8,z,.04,.6,.04,'#344453');
    for(let yy=3.77;yy<4.4;yy+=.17)b(-13.9,yy,z,.46,.035,.46,'#863c22');
  }

  function tower(x,z,width,depth,height,accent='#1984a4',feature=false) {
    const previousBlock=currentBlock;currentBlock=`core-tower-${x}-${z}`;
    footprints.push({id:currentBlock,x,z,sx:width+(feature?3:1),sz:depth+(feature?5:1)});
    colliders.push({x,y:height/2,z,sx:width+(feature?3:1),sy:height,sz:depth+(feature?5:1),blockId:currentBlock});
    const tiers=feature?[[1,.32],[.88,.25],[.68,.24],[.46,.11],[.29,.08]]:[[1,.54],[.79,.3],[.54,.16]];
    let base=0;
    for(let ti=0;ti<tiers.length;ti++) {
      const [ratio,fraction]=tiers[ti],ww=width*ratio,dd=depth*ratio,hh=height*fraction;
      b(x,base+hh/2,z,ww,hh,dd,choice(['#111e2e','#162536','#1a293a']));
      b(x,base+hh-.3,z,ww+.65,.6,dd+.6,'#23394b');
      for(let yy=base+1.1;yy<base+hh-.9;yy+=1.75) {
        for(let xx=x-ww/2+.65;xx<x+ww/2-.3;xx+=1.08) {
          if(random()<.19)continue;
          w(xx,yy,z+dd/2+.04,.45,.5,.035,random()>.35?choice(windowColors):'#163952');
          if(feature&&random()<.13)g(xx,yy+.32,z+dd/2+.06,.58,.035,.035,accent);
        }
        for(const side of [-1,1])for(let zz=z-dd/2+.7;zz<z+dd/2-.4;zz+=1.08) {
          if(random()<.23)continue;
          w(x+side*(ww/2+.04),yy,zz,.035,.5,.43,random()>.4?choice(windowColors):'#17374d');
        }
      }
      // Closely spaced vertical dark ribs separate the tiny recessed window fields.
      for(let xx=x-ww/2+.2;xx<x+ww/2;xx+=3.45)b(xx,base+hh/2,z+dd/2+.15,.19,hh,.26,'#0d1929');
      for(const side of [-1,1]) {
        for(let zz=z-dd/2+.2;zz<z+dd/2;zz+=3.4)b(x+side*(ww/2+.12),base+hh/2,zz,.24,hh,.18,'#0d1a29');
        if(feature||ti>0) {
          const edge=feature?.67:.42;
          if(feature) {
            for(let segmentY=base+.85;segmentY<base+hh-.5;segmentY+=1.34)g(x+side*(ww/2+.18),segmentY,z+dd/2+.18,edge,1.15,edge,accent);
          } else g(x+side*(ww/2+.18),base+hh/2,z+dd/2+.18,edge,hh-.8,edge,accent);
          g(x+side*(ww/2+.18),base+hh-.28,z,feature?.52:.32,feature?.45:.28,dd+.2,accent);
          if(feature) {
            // Lit setback fins and interrupted inner light wells remain visible
            // at street distance rather than becoming subpixel dotted outlines.
            b(x+side*(ww/2+.65),base+hh*.52,z+dd*.12,1.15,hh*.86,dd*.67,'#19324b');
            g(x+side*(ww/2+1.27),base+hh*.52,z+dd*.45,.48,hh*.86,.48,'#1cabdf');
            for(let strip=0;strip<Math.floor(hh/8);strip++) {
              g(x+side*ww*.23,base+4+strip*8,z+dd/2+.28,.38,5.2,.13,'#28b9e6');
              g(x+side*ww*.23,base+6.55+strip*8,z+dd/2+.29,1.4,.16,.14,'#47d9f7');
            }
            // Irregular external machinery and projecting decks interrupt the
            // perfect tier geometry while retaining the landmark's silhouette.
            const shaftX=x+side*ww*.36,shaftY=base+hh*(side<0?.43:.57);
            b(shaftX,shaftY,z+dd/2+.53,1.25,hh*.56,1.1,'#243d51','metal');
            for(let braceY=shaftY-hh*.25;braceY<shaftY+hh*.26;braceY+=2.2)b(shaftX,braceY,z+dd/2+1.12,1.6,.16,.13,'#3b5267','metal');
            for(let deck=0;deck<3;deck++) {
              const deckY=base+hh*(.24+deck*.23),deckX=x+side*ww*(deck%2?.3:.4),deckW=Math.max(2.4,ww*.16);
              b(deckX,deckY,z+dd/2+1.15,deckW,.4,2.6,'#314757','metal');
              b(deckX,deckY+.66,z+dd/2+2.4,deckW,.09,.09,'#4b6374','metal');
              for(let barX=deckX-deckW/2;barX<deckX+deckW/2;barX+=.5)b(barX,deckY+.35,z+dd/2+2.4,.055,.68,.06,'#30475b','metal');
              b(deckX+side*.4,deckY+1.0,z+dd/2+.73,1.1,1.5,1.3,'#334c5d','metal');
              for(let vent=0;vent<4;vent++)b(deckX+side*.4,deckY+.45+vent*.3,z+dd/2+1.4,.75,.07,.06,'#142a3c');
              g(deckX-side*.6,deckY-.25,z+dd/2+2.4,.75,.07,.1,'#33c1db');
            }
            if(ti<3) {
              const adX=x+side*ww*.33,adY=base+hh*(side<0?.75:.36),adZ=z+dd/2+1.21;
              b(adX,adY,adZ,2.5,3.8,.32,'#142637','metal');
              for(let ax=0;ax<7;ax++)for(let ay=0;ay<11;ay++) {
                if((ax+ay+ti)%5===0)continue;
                const tint=(ax+ay)%3===0?'#cf329b':'#1e9fc7';
                g(adX-1.05+ax*.34,adY-1.65+ay*.32,adZ+.19,.26,.25,.05,tint);
              }
            }
          }
        }
      }
      if(feature) {
        for(let segmentX=x-ww/2;segmentX<x+ww/2;segmentX+=1.34)g(segmentX,base+hh-.23,z+dd/2+.2,1.15,.47,.38,accent);
      } else if(random()>.6)g(x,base+hh-.23,z+dd/2+.2,ww+.2,.24,.2,accent);
      // Step-like roof plant, tanks, antennae; skyline tops must be intricate.
      for(let k=0;k<6;k++) {
        const xx=x+(random()-.5)*ww*.8,zz=z+(random()-.5)*dd*.8;
        b(xx,base+hh+.65,zz,.5+random()*.6,1.3,1.0+random(),'#354457','metal');
      }
      base+=hh;
    }
    b(x,height+4,z,.16,8,.16,'#335268','metal');
    g(x,height+8.1,z,.18,.9,.18,accent);
    if(feature) {
      for(let crown=0;crown<5;crown++) {
        const ww=8.4-crown*1.45;
        b(x,height+crown*2+.6,z,ww,1.8,ww,'#235b7b');
        for(let xx=x-ww/2+.3;xx<x+ww/2;xx+=.65)g(xx,height+crown*2+.8,z+ww/2+.08,.39,1.3,.06,'#28cfff');
        g(x,height+crown*2+1.5,z+ww/2+.13,ww,.13,.13,'#57e2ff');
      }
      g(x,height+15,z,.13,14,.13,'#41ddff');
      sign('AEON','',6.4,10,'#ff49bd',x,height*.73,z+depth*.34+.25,0,'portrait');
    }
    const id=currentBlock;currentBlock=previousBlock;return id;
  }
  // A slender stepped spire, rather than a wall across the end of the avenue.
  tower(0,-214,56,38,245,'#23c4f2',true);
  tower(-24,-231,16,18,75,'#1386ac');tower(25,-233,16,18,72,'#1a89a4');
  const skyline=[[-43,-81,15,18,78],[-50,-129,17,22,101],[-31,-167,15,17,85],[-62,-185,18,20,103],[-80,-105,21,23,87],[39,-109,18,19,88],[50,-163,18,23,105],[31,-182,16,18,88],[77,-92,17,19,86],[68,-226,20,23,110],[-39,-274,18,22,103],[37,-279,19,22,107],[-81,-249,22,23,96],[92,-244,23,25,110],[-15,-295,16,20,93],[17,-307,18,19,103],[-96,-159,19,20,105],[94,-157,18,21,100]];
  skyline.forEach(([x,z,ww,dd,hh],i)=>{
    const id=tower(x,z,ww,dd,hh*1.16,i%3===0?'#d52c9f':'#148eaf');
    if(i<8&&i%2===1){currentBlock=id;sign('NEURAL','',5.4,7.5,i%3?'#35cbfc':'#f62aaa',x,hh*.62,z+dd/2+.2,0,i%3?'circuit':'portrait');currentBlock=null;}
  });
  // A few distant silhouettes end in haze, at differing heights and depths.
  for(let i=0;i<24;i++) {
    const x=(i%2?-1:1)*(42+random()*100),z=-190-random()*160,h=45+random()*63;
    const ww=7+random()*9,dd=9+random()*9;currentBlock='core-background-'+i;
    footprints.push({id:currentBlock,x,z,sx:ww,sz:dd});colliders.push({x,y:h/2,z,sx:ww,sy:h,sz:dd,blockId:currentBlock});
    b(x,h/2,z,ww,h,dd,'#142538');
    for(let y=4;y<h;y+=3)for(let j=0;j<3;j++)w(x-2.4+j*2.4,y,z+7,.46,.6,.05,choice(['#287490','#567583','#b19379']));
    currentBlock=null;
  }
  // Very slim crossing bridges leave the cyan landmark and open sky visible.
  for(const [z,y] of [[-55,15],[-115,28]]) {
    const id='CON-CORE-BRIDGE-'+(-z),supportIds=[...column(-17.8,z,y,id),...column(17.8,z,y,id)];
    supportIds.push(sup(0,y,z,36,.65,2.7,'bridge deck',id));
    b(0,y+.38,z-1.25,35,.13,.13,'#435265','metal');
    b(0,y+1.4,z+1.3,35,.08,.08,'#4a5e6e','metal');
    for(let x=-17;x<=17;x+=.8)b(x,y+.83,z+1.3,.06,1.15,.06,'#3e4e5d','metal');
    g(0,y-.3,z+1.38,26,.06,.08,'#247786');
    elevatedConnections.push({id,label:'Grounded Kasumi pedestrian bridge',kind:'pedestrian-bridge',x:0,y,z,sx:36,sy:2.3,sz:2.7,from:{x:-17.8,y,z},to:{x:17.8,y,z},supportIds,chunk:'core'});
  }
  // Hanging cables are voxel-stair curves, reproduced exactly inside Blender.
  for(let n=0;n<11;n++) {
    const z=16-n*17,y=14+random()*5;
    const id='CON-CORE-CABLE-'+n,supportIds=[...column(-18,z,y+.06,id),...column(18.18,z,y+.06,id)];
    for(let j=0;j<54;j++) {
      const x=-18+(j+.5)*.67,y0=y-Math.sin(j/54*Math.PI)*2.3,y1=y-Math.sin((j+1)/54*Math.PI)*2.3;
      b(x,(y0+y1)/2,z,.75,Math.abs(y1-y0)+.045,.045,'#112235','metal');
    }
    elevatedConnections.push({id,label:'Grounded utility cable',kind:'utility-cable',x:.09,y:y-1.15,z,sx:36.18,sy:2.4,sz:.08,from:{x:-18,y,z},to:{x:18.18,y,z},supportIds,chunk:'core'});
  }
  // Dense curbside infrastructure: narrow light poles, bins, crates, vending machines.
  for(const side of [-1,1])for(let i=0;i<11;i++) {
    const z=30-i*19,x=side*11.8;
    b(x,2.8,z,.09,5.5,.09,'#334553','metal');
    b(x-side*.55,5.55,z,1.2,.1,.1,'#43596a','metal');
    g(x-side*1.07,5.49,z,.38,.09,.24,'#92d8e5');
    b(x,.35,z,.27,.48,.27,'#263647');
    if(i%2===0) {
      b(side*14.4,.6,z+4,.7,1.05,.65,'#414b56','metal');
      b(side*14.4,1.17,z+4,.77,.08,.72,'#7a817d','metal');
      b(side*14.4,.94,z+4.34,.46,.14,.035,'#111b29');
      const vx=side*15.9,vz=z+6;
      b(vx,1.15,vz,1.0,2.05,.8,'#713749','metal');
      w(vx,1.39,vz+.42,.72,1.0,.05,'#70c9d7');
      for(let r=0;r<3;r++)for(let c=0;c<4;c++)b(vx-.25+c*.17,1.08+r*.3,vz+.46,.1,.17,.05,choice(['#ee9872','#ebcdc1','#429db2']));
      b(vx,.44,vz+.44,.66,.14,.04,'#101822');
    }
  }
  const expansion=createExpansionLayout();
  const intersects=(a,r,margin=0)=>Math.abs(a.x-r.x)<(a.sx+r.sx)/2+margin&&Math.abs(a.z-r.z)<(a.sz+r.sz)/2+margin;
  // Remove complete old background buildings where the new street grid passes.
  // This preserves open driveable roads instead of cutting tunnels through towers.
  const removed=footprints.filter(f=>expansion.roads.some(r=>intersects(f,r,.5)));
  const removedIds=new Set(removed.map(f=>f.id));
  const insideRemoved=(x,z,margin=1.5)=>removed.some(f=>Math.abs(x-f.x)<f.sx/2+margin&&Math.abs(z-f.z)<f.sz/2+margin);
  const keptBoxes=boxes.filter(v=>v.blockId?!removedIds.has(v.blockId):!(v.y>1&&v.sx<8&&v.sz<8&&insideRemoved(v.x,v.z)));
  const keptSigns=signs.filter(v=>v.blockId?!removedIds.has(v.blockId):!insideRemoved(v.x,v.z,0));
  // The original portrait is a single landmark. Other billboards advertise
  // distinct products and destinations, with their own original voxel artwork.
  const campaigns=[['KURO OPTICS','#beeb38'],['AXIOM','#ff4637'],['OFFWORLD','#8072ff'],['MIDNIGHT RAMEN','#ff992e']];
  let campaignIndex=0;
  for(const spec of keptSigns){
    if((spec.art==='portrait'||spec.art==='dancer')&&spec.text!=='HUMAN+'){
      spec.art='campaign';spec.adIndex=[1,0,2,3][campaignIndex++%4];
      [spec.text,spec.tint]=campaigns[spec.adIndex];spec.sub='';
    }
  }
  const keptColliders=colliders.filter(v=>!removedIds.has(v.blockId));
  return applyIronDocksCompositions(applyHousingCompositions(applyBlockCompositions(applyStreetDetails(applyAdvertCampaigns(enforceCityPlacements({boxes:keptBoxes.concat(expansion.boxes),signs:keptSigns.concat(expansion.signs),colliders:keptColliders.concat(expansion.colliders),bounds,roads:expansion.roads,districts:expansion.districts,patrolRoutes:expansion.patrolRoutes,chunks:expansion.chunks,citySize:expansion.citySize,removedCoreBuildings:removed.length,supports:supports.concat(expansion.supports),elevatedConnections:elevatedConnections.concat(expansion.elevatedConnections)}))))));
}
