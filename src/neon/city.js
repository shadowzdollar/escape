import {createCityPopulation} from './civilian-source.js';
import {AIRCRAFT_BODY_PARTS as trafficParts,AIRCRAFT_GLOW_PARTS} from './aircraft-source.js';
import * as THREE from 'three';
import { createCityLayout } from './city-layout.js';
import { ADVERT_CAMPAIGNS } from './advert-campaigns.js';
import { createStreetCollisionLayout } from './street-collisions.js';
import { createCivilianSystem } from './civilians.js';
import { createSurfaceMaterial } from './surface-materials.js';
import {surfaceProfileFor} from './surface-profiles.js';
import { createCityServices } from './city-services.js';
import { createServiceFixtures } from './service-fixtures.js';
import { createGroundHeightSampler } from './ground-height.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

// The same deterministic voxel modules are exported to the editable Blender scene.
export function createCity(scene) {
  const layout=createCityLayout();
  const {boxes,signs,colliders,bounds,roads,districts,patrolRoutes,chunks,citySize}=layout;
  const groundSurfaces=boxes.filter(v=>v.kind==='pavement'&&v.sx>=1&&v.sz>=1&&v.y+v.sy/2>=.08&&v.y+v.sy/2<=.4);
  const groundHeightAt=createGroundHeightSampler(groundSurfaces);
  const serviceSource={boxes,streetDetails:layout.streetDetails,roads,districts,colliders,buildings:layout.buildings};
  const serviceFixtures=createServiceFixtures({source:serviceSource,sites:createCityServices({layout:serviceSource,groundHeightAt}).list()});
  const replacedServiceBoxes=new Set(serviceFixtures.removedBoxIds);
  const {staticColliders:streetColliders,dynamicProps,removedBoxes}=createStreetCollisionLayout(layout,{excludedBoxIds:replacedServiceBoxes});
  const collisionGrid=new Map(),collisionCell=12;let indexedColliders=-1;
  function indexCollisions(){
    collisionGrid.clear();indexedColliders=colliders.length;
    for(const c of [...colliders,...streetColliders]){
      const cs=Math.abs(Math.cos(c.ry||0)),sn=Math.abs(Math.sin(c.ry||0));
      const hx=(cs*c.sx+sn*c.sz)/2,hz=(sn*c.sx+cs*c.sz)/2;
      for(let x=Math.floor((c.x-hx)/collisionCell);x<=Math.floor((c.x+hx)/collisionCell);x++)for(let z=Math.floor((c.z-hz)/collisionCell);z<=Math.floor((c.z+hz)/collisionCell);z++){
        const key=x+','+z;if(!collisionGrid.has(key))collisionGrid.set(key,[]);collisionGrid.get(key).push(c);
      }
    }
  }
  function getCollidersAt(x,z,radius=1){
    if(indexedColliders!==colliders.length)indexCollisions();
    const nearby=new Set();
    for(let ix=Math.floor((x-radius)/collisionCell);ix<=Math.floor((x+radius)/collisionCell);ix++)for(let iz=Math.floor((z-radius)/collisionCell);iz<=Math.floor((z+radius)/collisionCell);iz++)for(const c of collisionGrid.get(ix+','+iz)||[])nearby.add(c);
    return [...nearby];
  }
  const root=new THREE.Group();root.name='KASUMI WARD / concept city';scene.add(root);
  const cube=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D(),color=new THREE.Color();
  function luminousMaterial(intensity) {
    const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.38,metalness:.15,emissive:0xffffff,emissiveIntensity:intensity});
    // Instance colors must tint emission as well as diffuse. This gives every
    // neon module and tiny window colored HDR radiance for the bloom pass.
    material.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif');
    };
    material.customProgramCacheKey=()=>`colored-voxel-emission-${intensity}`;
    return material;
  }
  const materials={
    solid:createSurfaceMaterial('solid'),
    metal:createSurfaceMaterial('metal'),
    pavement:createSurfaceMaterial('pavement'),
    window:luminousMaterial(.95),glow:luminousMaterial(4.2),
    glass:new THREE.MeshStandardMaterial({roughness:.16,metalness:.75,transparent:true,opacity:.34,depthWrite:false})
  };
  // Door panes are frosted glazing, not full-bright tower advertisements. Keep
  // medical symbols distinct from the pane when the player stands close to it.
  materials.doorGlass=luminousMaterial(.12);materials.doorGlass.roughness=.58;materials.doorGlass.metalness=.06;
  materials.medicalIndicator=luminousMaterial(1.4);
  const chunkGroups=new Map();
  for(const chunk of chunks) {
    const near=new THREE.Group(),far=new THREE.Group();near.name=chunk.id+' / detailed';far.name=chunk.id+' / distant skyline';
    root.add(near,far);chunkGroups.set(chunk.id,{...chunk,near,far});
  }
  const targetGroup=(chunk,lod)=>chunkGroups.has(chunk)?chunkGroups.get(chunk)[lod==='far'?'far':'near']:root;
  const batches=new Map();
  const profiledMaterials=new Map();
  for(const box of boxes){if(removedBoxes.has(box)||replacedServiceBoxes.has(box.id))continue;const kind=box.role==='inset door glazing'?'doorGlass':box.role==='medical cross'?'medicalIndicator':box.kind;const key=[box.chunk||'core',box.lod||'near',kind,surfaceProfileFor(box)].join('|');if(!batches.has(key))batches.set(key,[]);batches.get(key).push(box);}
  for(const [key,items] of batches) {
    const [chunk,lod,kind,profile]=key.split('|');
    if(profile&&!profiledMaterials.has(profile))profiledMaterials.set(profile,createSurfaceMaterial(kind,profile));
    const mesh=new THREE.InstancedMesh(cube,profile?profiledMaterials.get(profile):materials[kind]||materials.solid,items.length);
    mesh.name=`Shared Blender city / ${kind}${profile?' / '+profile:''} / ${items.length} voxels`;
    mesh.userData.surfaceProfile=profile;
    items.forEach((v,i)=>{
      dummy.position.set(v.x,v.y,v.z);dummy.rotation.set(0,v.ry||0,0);dummy.scale.set(v.sx,v.sy,v.sz);dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,color.set(v.c));
    });
    mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
    mesh.castShadow=kind==='solid'||kind==='metal';mesh.receiveShadow=kind!=='glow'&&kind!=='window';
    mesh.computeBoundingSphere();targetGroup(chunk,lod).add(mesh);
  }
  const textureLoader=new THREE.TextureLoader();
  const portrait=textureLoader.load('/assets/advert-portrait.png');portrait.colorSpace=THREE.SRGBColorSpace;portrait.anisotropy=8;
  const campaignMeshes=new Map();
  function fitCampaign(mesh,aspect){
    const {w,h}=mesh.userData.displayPanel;
    const width=Math.min(w,h*aspect),height=width/aspect;
    mesh.scale.set(width/w,height/h,1);
  }
  const campaigns=ADVERT_CAMPAIGNS.map(({file},index)=>{
    const texture=textureLoader.load('/assets/'+file,loaded=>{
      const aspect=loaded.image.width/loaded.image.height;
      for(const mesh of campaignMeshes.get(index)||[])fitCampaign(mesh,aspect);
    });texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
  });
  const animatedSigns=[],adCache=new Map();
  function canvasAd(spec) {
    const cacheKey=[spec.art,spec.text,spec.sub,spec.tint,spec.w/spec.h,spec.vertical].join('|');
    if(adCache.has(cacheKey))return adCache.get(cacheKey);
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=Math.round(512*spec.h/spec.w);
    const ctx=canvas.getContext('2d');let state=371+Math.round(spec.x*17+spec.z*11);
    const r=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    if(spec.art==='circuit') {
      const chip=spec.text==='神経回路';
      const cols=44,rows=Math.round(cols*spec.h/spec.w),cw=canvas.width/cols,ch=canvas.height/rows;
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++) {
        const nx=(x-cols*.48)/(cols*.42),ny=(y-rows*.44)/(rows*.34),ring=Math.sqrt(nx*nx+ny*ny);
        let fill=['#116a9e','#138bc0','#42c3e6','#217dab','#8dddf0'][Math.floor(r()*5)];
        if(ring>.48&&ring<.8)fill=r()>.4?'#caf6ff':'#98e8ff';
        if(ring<.3)fill=r()>.4?'#ed44c5':'#7a267f';if(r()>.92)fill='#0b355a';
        if(chip){
          const dx=Math.abs(x-cols*.5),dy=Math.abs(y-rows*.36);
          const core=dx<7&&dy<7,wiring=(x%4===0&&dy<12)||(y%4===0&&dx<17);
          fill=core?(dx>5||dy>5?'#b5f580':'#2e8490'):wiring?(r()>.15?'#39cace':'#cfff8c'):'#072e3f';
        }
        ctx.fillStyle=fill;ctx.fillRect(x*cw,y*ch,cw-.7,ch-.7);
      }
      ctx.fillStyle='#c9faff';ctx.font=`900 ${canvas.height*.17}px "Yu Gothic",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(spec.text,canvas.width*.5,canvas.height*.78,canvas.width*.88);
      ctx.fillStyle='#bff3ff';ctx.font=`700 ${canvas.height*.045}px monospace`;ctx.fillText(spec.sub,canvas.width*.5,canvas.height*.94,canvas.width*.92);
    } else if(spec.art==='shop') {
      ctx.fillStyle='#33180e';ctx.fillRect(0,0,canvas.width,canvas.height);
      for(let y=0;y<canvas.height;y+=10)for(let x=0;x<canvas.width;x+=10){ctx.fillStyle=r()>.5?'#56301a':'#432114';ctx.fillRect(x,y,9,9);}
      ctx.fillStyle=spec.tint;ctx.font=`900 ${Math.min(canvas.height*.7,canvas.width/(spec.text.length*.63))}px monospace`;
      ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillText(spec.text,256,canvas.height*.47,490);
      ctx.strokeStyle=spec.tint;ctx.lineWidth=4;ctx.strokeRect(4,4,504,canvas.height-8);
      if(spec.sub){ctx.font=`600 ${canvas.height*.13}px monospace`;ctx.fillText(spec.sub,256,canvas.height*.89,480);}
    } else {
      ctx.fillStyle='#171523';ctx.fillRect(0,0,canvas.width,canvas.height);
      const chars=(spec.vertical||spec.text).split('');ctx.fillStyle=spec.tint;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font=`700 ${Math.min(410,canvas.height*.8/chars.length)}px "Yu Gothic",sans-serif`;
      chars.forEach((char,i)=>ctx.fillText(char,256,canvas.height*(.15+i*.68/chars.length),460));
      ctx.strokeStyle=spec.tint;ctx.lineWidth=8;ctx.strokeRect(5,5,502,canvas.height-10);
      ctx.font=`800 ${Math.min(70,canvas.width/(spec.text.length*.68))}px monospace`;ctx.fillText(spec.text,256,canvas.height*.9,460);
      ctx.globalAlpha=.1;ctx.fillStyle='#000000';
      for(let x=0;x<canvas.width;x+=13)ctx.fillRect(x,0,1,canvas.height);
      for(let y=0;y<canvas.height;y+=13)ctx.fillRect(0,y,canvas.width,1);ctx.globalAlpha=1;
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;adCache.set(cacheKey,texture);return texture;
  }
  for(const spec of signs) {
    const image=spec.art==='portrait'||spec.art==='dancer'||spec.art==='campaign';
    const texture=spec.art==='campaign'?campaigns[spec.adIndex||0]:image?portrait:canvasAd(spec);
    const brightness=spec.art==='campaign'?1.24:image?1.55:1.3;
    const material=new THREE.MeshBasicMaterial({map:texture,color:new THREE.Color().setScalar(brightness),side:THREE.DoubleSide,toneMapped:true});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(spec.w,spec.h),material);
    mesh.position.set(spec.x,spec.y,spec.z);mesh.rotation.y=spec.ry||0;
    // The display sits 25 mm in front of its planned mounting plane, clear of the backing.
    mesh.translateZ(.025);mesh.name=`Billboard / ${spec.text}`;targetGroup(spec.chunk,'near').add(mesh);
    mesh.userData.adArt=spec.art;mesh.userData.adIndex=spec.adIndex;
    if(spec.art==='campaign'){
      const index=spec.adIndex||0;
      mesh.userData.campaignId=ADVERT_CAMPAIGNS[index].id;mesh.userData.displayPanel={w:spec.w,h:spec.h};
      if(!campaignMeshes.has(index))campaignMeshes.set(index,[]);campaignMeshes.get(index).push(mesh);
      fitCampaign(mesh,texture.image?texture.image.width/texture.image.height:ADVERT_CAMPAIGNS[index].aspectRatio);
    }
    if(image)animatedSigns.push({material,phase:spec.x+spec.z,brightness});
  }
  // The renderer owns all weather, haze, reflective surfaces and environmental sky.
  const lamps=[[-13.8,3.4,14,'#ff8430',23,13],[-15,17,5,'#ef2db7',20,19],[16,9,10,'#29caff',21,18],[18,24,-44,'#e736b1',20,22],[-14,4,-36,'#37d4e9',12,12],[14,4,-100,'#ff9b55',13,15]];
  for(const [x,y,z,c,intensity,distance] of lamps){const lamp=new THREE.PointLight(c,intensity,distance,2);lamp.position.set(x,y,z);root.add(lamp);}
  // Emissive signs do not illuminate Standard materials by themselves. Reuse a
  // small pool of local lights at actual mounted signs so their spill reaches
  // the sidewalk and adjacent unlit masonry without adding hundreds of lights.
  const storefrontEmitters=signs.filter(s=>s.chunk&&s.y>2&&s.y<8&&s.w>2.5&&s.h<2.8&&s.mountType==='wall-panel').map(s=>({
    id:s.id,x:s.x+Math.sin(s.ry||0)*.9,y:s.y-.45,z:s.z+Math.cos(s.ry||0)*.9,ry:s.ry||0,
    color:new THREE.Color(s.tint).lerp(new THREE.Color('#b9d1e1'),.48),
    intensity:22,width:Math.min(8,s.w),height:1.2
  }));
  // A broad canopy emits across its width. It illuminates the pavement without
  // the concentrated white reflection produced by a point close to metal trim.
  RectAreaLightUniformsLib.init();
  const storefrontLights=Array.from({length:4},(_,i)=>{
    const light=new THREE.RectAreaLight('#a5c9df',0,8,1.2);light.name='Mounted storefront spill / '+(i+1);
    light.userData.emitterId=null;light.userData.targetIntensity=0;root.add(light);return light;
  });
  let lightingState={nearestEmitters:[],activeLights:0,visibleBlocks:0};
  function selectStorefrontLights(px,pz){
    const inHero=Math.abs(px)<32&&pz> -180&&pz<45;
    const selected=inHero?[]:storefrontEmitters.map(e=>({emitter:e,distance:Math.hypot(e.x-px,e.z-pz)}))
      .filter(e=>e.distance<62).sort((a,b)=>a.distance-b.distance).slice(0,4);
    const targets=new Map(selected.map(e=>[e.emitter.id,e]));
    for(const light of storefrontLights){
      const existing=targets.get(light.userData.emitterId);
      if(existing){light.userData.targetIntensity=existing.emitter.intensity;targets.delete(existing.emitter.id);}
      else light.userData.targetIntensity=0;
    }
    for(const light of storefrontLights){
      if(light.userData.targetIntensity>0)continue;
      const next=targets.values().next().value;
      if(!next)continue;
      const emitter=next.emitter;targets.delete(emitter.id);
      light.position.set(emitter.x,emitter.y,emitter.z);light.color.copy(emitter.color);light.width=emitter.width;light.height=emitter.height;
      light.lookAt(emitter.x+Math.sin(emitter.ry)*.25,emitter.y-1,emitter.z+Math.cos(emitter.ry)*.25);
      light.intensity=0;light.userData.emitterId=emitter.id;light.userData.targetIntensity=emitter.intensity;
    }
    lightingState={nearestEmitters:selected.map(({emitter,distance})=>({id:emitter.id,distance,position:[emitter.x,emitter.y,emitter.z]})),activeLights:selected.length,
      visibleBlocks:[...chunkGroups.values()].filter(c=>c.near.visible).length};
  }
  const {people,airTraffic:traffic}=createCityPopulation({districts});
  const pedestrianCount=people.reduce((n,p)=>n+p.pieces.length,0);
  const pedestrian=new THREE.InstancedMesh(cube,new THREE.MeshStandardMaterial({roughness:.74,metalness:.2}),pedestrianCount);
  pedestrian.name='Animated citizens / segmented voxel coats and umbrellas';pedestrian.instanceMatrix.setUsage(THREE.DynamicDrawUsage);pedestrian.frustumCulled=false;root.add(pedestrian);
  const civilians=createCivilianSystem({people,mesh:pedestrian,colliders:[...colliders,...streetColliders],groundHeightAt,bounds});
  const craft=new THREE.InstancedMesh(cube,materials.metal,traffic.length*trafficParts.length);craft.frustumCulled=false;root.add(craft);
  const craftGlow=new THREE.InstancedMesh(cube,materials.glow,traffic.length*4);craftGlow.frustumCulled=false;root.add(craftGlow);
  function set(mesh,i,x,y,z,sx,sy,sz,c,rx=0,ry=0) {
    dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(c)mesh.setColorAt(i,color.set(c));
  }
  let first=true,lodTime=-1;
  function update(dt,time,playerPosition) {
    if(first||time-lodTime>.35) {
      const px=playerPosition?.x??0,pz=playerPosition?.z??29;
      for(const chunk of chunkGroups.values()) {
        const distance=Math.hypot(chunk.x-px,chunk.z-pz);
        chunk.near.visible=distance<250+chunk.radius*.35;
        chunk.far.visible=!chunk.near.visible&&distance<750;
      }
      selectStorefrontLights(px,pz);
      lodTime=time;
    }
    const lightBlend=1-Math.exp(-Math.max(0,dt)*7);
    for(const light of storefrontLights)light.intensity=THREE.MathUtils.lerp(light.intensity,light.userData.targetIntensity,lightBlend);
    civilians.update(dt,time,playerPosition);
    traffic.forEach((p,i)=>{
      p.x+=dt*p.speed;if(p.x>p.range)p.x=-p.range;if(p.x< -p.range)p.x=p.range;
      const yy=p.y+Math.sin(time*.6+i)*.22;
      trafficParts.forEach(([x,y,z,sx,sy,sz,c],j)=>set(craft,i*trafficParts.length+j,p.x+x,yy+y,p.z+z,sx,sy,sz,first?c:null));
      AIRCRAFT_GLOW_PARTS.forEach(([x,y,z,sx,sy,sz,c],k)=>set(craftGlow,i*4+k,p.x+x,yy+y,p.z+z,sx,sy,sz,first?c:null));
    });
    craft.instanceMatrix.needsUpdate=true;craftGlow.instanceMatrix.needsUpdate=true;
    if(first){craft.instanceColor.needsUpdate=true;craftGlow.instanceColor.needsUpdate=true;first=false;}
    for(const {material,phase,brightness} of animatedSigns)material.color.setScalar(brightness+Math.sin(time*.7+phase)*.045);
  }
  update(0,0,new THREE.Vector3(0,2.7,29));
  return {root,colliders,streetColliders,dynamicProps,groundSurfaces,getCollidersAt,bounds,update,groundHeightAt,civilians,roads,districts,patrolRoutes,citySize,
    serviceSource,serviceFixtures,
    audioEmitters:storefrontEmitters,
    lighting:{getState:()=>({...lightingState,emitterCount:storefrontEmitters.length,pooledLights:storefrontLights.length})},
    layoutStats:{voxels:boxes.length,signs:signs.length,pedestrians:people.length,pedestrianVoxels:pedestrianCount,blocks:chunks.length,roadLength:citySize.roadLength,streetColliders:streetColliders.length,movableBins:dynamicProps.length}};
}
