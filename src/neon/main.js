import './style.css';
import './free-roam.css';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCity } from './city.js';
import { createSimulation } from './simulation.js';
import { createAudio } from './audio.js';
import { batchVoxelAsset } from './voxel-assets.js';
import { createAtmosphere } from './atmosphere.js';
import { createCityLife } from './city-life.js';
import { SCENE_PLACEMENTS as placements } from './asset-placements.js';
import { createVehicleDamage } from './vehicle-damage.js';
import { createWeaponRig, RELOAD_DURATION } from './weapon-rig.js';
import { createWeaponVFX } from './weapon-vfx.js';
import { createPlayerMovement } from './player-movement.js';
import { createCityShadows } from './city-shadows.js';
import { resolveCameraBoom } from './camera-obstruction.js';
import { createCityServices } from './city-services.js';
import { createServiceInterface } from './service-interface.js';
import { createServiceWorld } from './service-world.js';
import { getKinematicPoseController } from './kinematic-pose.js';
import { createFootContact, collectFootSupportSurfaces } from './foot-contact.js';

const $=id=>document.getElementById(id);
const audio=createAudio();
let mode='menu',ready=false,firstRun=true,lookYaw=0,lookPitch=.30,health=100,energy=100,ammo=24,holstered=true,thirdPerson=false,photoMode=false;
let empCooldown=0,dashCooldown=0,shotCooldown=0,reloadTime=0,elapsed=0,totalTime=0;
let carSpeed=0,carYaw=-.2,bob=0,walkBlend=0,dashTime=0,lastFrameSeconds=.016;
let playerMovement,motion={grounded:true,speed:0,distanceMoved:0};
let cityShadows;
let footContact;
let cameraBoomState={active:false};
let services,serviceInterface,serviceSites=[],serviceCandidate=null,serviceResult=null,serviceResultUntil=0,damageVersion=0;
let serviceWorld;
let poseController;
const serviceWorldEvents=[];
let neuralBoost={remaining:0,regenMultiplier:1};
const serviceForward=new THREE.Vector3();
let simulation,city,cityLife,car,carBody,carDamage,weapon,weaponRig,weaponFX,avatar,av,atmosphere,renderer,composer,dragging=false,lastShift=-10,toastTimeout,mapWasPlaying=false,lastCarImpact=-10;
const keys=new Set(),position=new THREE.Vector3(placements.mercenary.x,1.75,placements.mercenary.z),carStart=new THREE.Vector3(placements.interceptor.x,placements.interceptor.y,placements.interceptor.z);
const carPosition=carStart.clone(),tempVec=new THREE.Vector3(),forward=new THREE.Vector3(),soundDirection=new THREE.Vector3();
const carStepStart=new THREE.Vector3();
const scene=new THREE.Scene();scene.background=new THREE.Color('#051423');scene.fog=new THREE.FogExp2('#082a43',.0033);
const camera=new THREE.PerspectiveCamera(66,innerWidth/innerHeight,.08,520);scene.add(camera);
const player={position,inVehicle:false,damage};
const map=$('minimap').getContext('2d');
const trackedFrames=[];

function toast(message,duration=2600){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('show'),duration)}
function feed(message){const line=document.createElement('div');line.className='feed-line';line.textContent=message;$('kill-feed').append(line);setTimeout(()=>line.remove(),3800)}
function damage(amount){
  if(mode!=='playing'||health<=0)return;
  damageVersion++;
  health=Math.max(0,health-amount);$('damage-overlay').style.opacity='.8';audio.damage();
  setTimeout(()=>$('damage-overlay').style.opacity='0',180);
  if(health<=0)finish();
}
function cancelService(reason){
  const result=services?.cancel(reason);
  if(!result?.cancelled)return false;
  serviceWorldEvents.push(...result.events);
  serviceResult=result.result||{title:'Service interrupted',message:reason,success:false};serviceResultUntil=totalTime+3;return true;
}
function onEvent(event){
  if(event.type==='shot')weaponFX?.fire(event);
  if(event.type==='toast')toast(event.text);
  if(event.type==='hit'){audio.hit();$('crosshair').classList.add('hit');setTimeout(()=>$('crosshair').classList.remove('hit'),130)}
  if(event.type==='kill'){feed('SECURITY DRONE // OFFLINE');audio.hit()}
  if(event.type==='civilianKilled')feed('CIVILIAN FATALITY // SECURITY NOTIFIED');
  if(event.type==='crime')feed('CIVIC ALERT // '+(event.reason||'CRIME REPORTED'));
}

async function init(){
  try {
    renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.info.autoReset=false;
    $('world').appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight('#679db9','#26394d',.95));
    const moon=new THREE.DirectionalLight('#73b5df',1.15);moon.position.set(-45,110,-80);scene.add(moon);
    const fill=new THREE.DirectionalLight('#bd437e',.23);fill.position.set(50,18,10);scene.add(fill);
    const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
    scene.environment=pmrem.fromScene(room,.04).texture;scene.environmentIntensity=.25;room.dispose();pmrem.dispose();
    city=createCity(scene);
    cityLife=createCityLife(scene,city,{getPlayerPosition:()=>position,getVehicleBlockers:()=>[{id:'VEHICLE-PLAYER',x:carPosition.x,z:carPosition.z,yaw:carYaw,halfWidth:placements.interceptor.sx/2,halfLength:placements.interceptor.sz/2},...(simulation?.streetPhysics.getColliders().filter(c=>c.kind==='vehicle')||[])]});
    atmosphere=createAtmosphere(scene,renderer,city.bounds,{groundHeightAt:city.groundHeightAt});
    $('load-status').textContent='City online. Loading Blender assets…';
    const loader=new GLTFLoader();
    const rawAssets=new Set(['mercenary','pulse-carbine','ion-bolt','muzzle-flash','impact-shards']);
    const assets=Object.fromEntries(await Promise.all(['interceptor','drone','crate','kiosk','mercenary','av',...Array.from(rawAssets).filter(n=>n!=='mercenary')].map(async name=>{const original=(await loader.loadAsync('/assets/'+name+'.glb')).scene;return [name,rawAssets.has(name)?original:batchVoxelAsset(original,name)]})));
    car=assets.interceptor.clone(true);car.name='Yurei interceptor';car.position.copy(carPosition);scene.add(car);
    carDamage=createVehicleDamage(car);
    const carGlow=new THREE.PointLight('#36fcff',5,7,2);carGlow.position.set(0,.45,0);car.add(carGlow);
    for(const x of [-.85,.85]){const headlight=new THREE.SpotLight('#a9faff',28,28,Math.PI/8,.7,1.5);headlight.position.set(x,.8,-2.2);headlight.target.position.set(x,.1,-20);car.add(headlight,headlight.target)}
    avatar=assets.mercenary.clone(true);avatar.position.set(placements.mercenary.x,placements.mercenary.y,placements.mercenary.z);avatar.scale.setScalar(placements.mercenary.scale);scene.add(avatar);
    av=assets.av.clone(true);av.position.set(placements.patrolAV.x,placements.patrolAV.y,placements.patrolAV.z);av.scale.setScalar(placements.patrolAV.scale);av.rotation.y=placements.patrolAV.ry;scene.add(av);
    const avLamp=new THREE.SpotLight('#afd5ff',90,45,Math.PI/9,.8,1.4);avLamp.position.set(0,-.6,-2);avLamp.target.position.set(-4,-25,-9);av.add(avLamp,avLamp.target);
    const beamMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;void main(){float a=pow(vUv.y,2.)*.07;gl_FragColor=vec4(.38,.62,1.,a);}' });
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.38,5,24,16,1,true),beamMat);beam.position.set(0,-12,-2);av.add(beam);
    const parkedPlacement=placements.parkedCar,parked=assets.interceptor.clone(true);parked.position.set(parkedPlacement.x,parkedPlacement.y,parkedPlacement.z);parked.rotation.y=parkedPlacement.ry;scene.add(parked);
    const parkedDamage=createVehicleDamage(parked);
    for(const key of ['kioskWest','kioskEast']){const p=placements[key],shop=assets.kiosk.clone(true);shop.position.set(p.x,p.y,p.z);shop.rotation.y=p.ry;scene.add(shop)}
    simulation=createSimulation({scene,camera,colliders:city.colliders,streetColliders:city.streetColliders,groundSurfaces:city.groundSurfaces,dynamicProps:city.dynamicProps,groundHeightAt:city.groundHeightAt,bounds:city.bounds,patrolRoutes:city.patrolRoutes,civilians:city.civilians,assets,onEvent,getExternalSolids:()=>serviceWorld?.getColliders()||[]});
    simulation.streetPhysics.addObject({...parkedPlacement,visual:parked,mass:1250,kind:'vehicle',onImpact:({point,speed})=>parkedDamage.hit(point,speed),onReset:()=>parkedDamage.reset()});
    cityLife.attachPhysics({world:simulation.world,material:simulation.physicsMaterial,groundHeightAt:city.groundHeightAt});
    playerMovement=createPlayerMovement({position,bounds:city.bounds,groundHeightAt:city.groundHeightAt,
      getColliders:(x,z,radius)=>[...city.getCollidersAt(x,z,radius),...city.groundSurfaces,...simulation.getSolidProps(),...cityLife.getTrafficColliders(),...city.civilians.getColliders(),
        {id:'VEHICLE-PLAYER',x:carPosition.x,y:carPosition.y+.68,z:carPosition.z,sx:2.8,sy:1.28,sz:5.2,ry:carYaw}]});
    motion=playerMovement.getState();
    carBody=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC,material:simulation.physicsMaterial});
    carBody.addShape(new CANNON.Box(new CANNON.Vec3(1.4,.64,2.60)));
    carBody.position.set(carPosition.x,carPosition.y+.68,carPosition.z);simulation.world.addBody(carBody);
    carBody.quaternion.setFromEuler(0,carYaw,0);
    poseController=getKinematicPoseController(simulation.world);
    poseController.setTarget(carBody,{position:carBody.position,quaternion:carBody.quaternion});
    weaponRig=createWeaponRig({source:assets['pulse-carbine'],flashSource:assets['muzzle-flash'],camera,avatar});weapon=weaponRig.view;
    weaponFX=createWeaponVFX({scene,boltSource:assets['ion-bolt'],shardsSource:assets['impact-shards']});
    cityShadows=createCityShadows({scene,renderer,moon,city});
    for(const actor of [car,parked,avatar,av,city.root.getObjectByName('Animated citizens / segmented voxel coats and umbrellas')])cityShadows.addCaster(actor);
    composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
    const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.5,.42,1.0);composer.addPass(bloom);composer.addPass(new OutputPass());
    services=createCityServices({layout:city.serviceSource,groundHeightAt:city.groundHeightAt,
      getColliders:(x,z,radius)=>[...city.getCollidersAt(x,z,radius),...simulation.getSolidProps(),...cityLife.getTrafficColliders()]});
    serviceSites=services.list();
    serviceWorld=createServiceWorld({scene,source:city.serviceSource,sites:serviceSites,recipes:city.serviceFixtures});
    serviceWorld.attachPhysics({world:simulation.world,material:simulation.physicsMaterial});
    cityShadows.addCaster(serviceWorld.root);
    footContact=createFootContact({avatar,
      supportSurfaces:collectFootSupportSurfaces({groundSurfaces:city.groundSurfaces,boxes:city.serviceSource.boxes}),
      getColliders:(x,z,radius)=>[...city.getCollidersAt(x,z,radius),...simulation.getSolidProps(),...cityLife.getTrafficColliders()]});
    city.civilians.setObstacleProvider(()=>[...simulation.getSolidProps(),...cityLife.getTrafficColliders(),
      {id:'VEHICLE-PLAYER',x:carPosition.x,y:carPosition.y+.68,z:carPosition.z,sx:2.8,sy:1.28,sz:5.2,ry:carYaw}]);
    serviceInterface=createServiceInterface({parent:$('hud')});
    ready=true;$('start-btn').disabled=false;$('start-label').textContent='ENTER THE DISTRICT';$('load-status').textContent='City online · Free exploration';
    setupCityMap();
    updateHUD();renderer.setAnimationLoop(animate);
    window.__neon={snapshot:()=>({ready,mode,position:position.toArray(),health,energy,ammo,holstered,thirdPerson,photoMode,carSpeed,inVehicle:player.inVehicle,elapsed,city:{bounds:city.bounds,district:districtAt(position)?.name,roadSegments:city.roads?.length||1,layout:city.layoutStats},life:{...cityLife.stats,traffic:cityLife.getTrafficState()},state:simulation.getState(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,averageFPS:Math.round(1/(trackedFrames.reduce((a,b)=>a+b,0)/Math.max(1,trackedFrames.length)))} )};
    if(new URLSearchParams(location.search).has('test')){
      window.__neon.test={teleport(x,z){position.set(x,city.groundHeightAt(x,z)+1.75,z);motion=playerMovement.reset();camera.position.copy(position)},getMovement:()=>playerMovement.getState(),aimAt(x,y,z){const target=new THREE.Vector3(x,y,z).sub(position).normalize();lookYaw=Math.atan2(-target.x,-target.z);lookPitch=Math.asin(target.y);updateCamera(0,totalTime)},
        placeCar(x,z,yaw=0){if(!Number.isFinite(x+z+yaw)||collides(x,z,1.45,1))return false;carPosition.set(x,city.groundHeightAt(x,z)+.008,z);carYaw=yaw;carSpeed=0;carBody.position.set(x,carPosition.y+.68,z);carBody.quaternion.setFromEuler(0,yaw,0);poseController.setTarget(carBody,{position:carBody.position,quaternion:carBody.quaternion});if(player.inVehicle){position.copy(carPosition);position.y+=1.75}updateCamera(0,totalTime);return true},
        getCar:()=>({x:carPosition.x,y:carPosition.y,z:carPosition.z,yaw:carYaw,speed:carSpeed,...carDamage.getState()}),getWeapon:()=>({rig:weaponRig.getState(),effects:weaponFX.getState()}),getShadows:()=>cityShadows.getState(),footContact,renderFootContactFrame(enabled){footContact.setEnabled(enabled);composer.render(0);return footContact.getState();},getAudio:()=>audio.getState(),getCameraBoom:()=>({...cameraBoomState}),getServices:()=>({...services.getState(),sites:services.list(),candidate:serviceCandidate,neuralBoost:{...neuralBoost},interface:serviceInterface.getState(),world:serviceWorld.getState()}),damage,shoot:fire,emp:useEMP,interact,reload,start,pause,reset:restart,simulation,scene,camera,city,cityLife};
    }
  }catch(error){console.error(error);$('start-label').textContent='CITY CONNECTION FAILED';$('load-status').textContent='Could not initialize the city. Check WebGL support and reload.';toast('Unable to initialize: '+error.message,15000)}
}

function lockPointer(){
  try{const result=renderer.domElement.requestPointerLock();result?.catch(()=>toast('Right-drag to look · WASD to move',5000))}catch{toast('Right-drag to look · WASD to move',5000)}
}
function start(){
  if(!ready)return;
  $('menu').classList.add('hidden');$('hud').classList.remove('hidden');document.body.classList.add('playing');mode='playing';
  if(firstRun){firstRun=false;toast('Welcome to Kasumi. Explore freely. H to draw · V for third person · E to drive.',5000)}
  weapon.visible=!player.inVehicle&&!holstered&&!thirdPerson;keys.clear();lockPointer();
}
function pause(){
  if(mode!=='playing')return;cancelService('Service paused');mode='paused';document.exitPointerLock?.();keys.clear();carSpeed=0;audio.motor(0,false);
  $('hud').classList.add('hidden');$('menu').classList.remove('hidden');document.body.classList.remove('playing','photo-mode');photoMode=false;$('start-label').textContent='RETURN TO THE CITY';weapon.visible=false;
}
function restart(){
  footContact?.reset();
  services?.reset();serviceInterface?.reset();serviceCandidate=serviceResult=null;serviceResultUntil=damageVersion=0;neuralBoost={remaining:0,regenMultiplier:1};
  serviceWorldEvents.length=0;serviceWorld?.reset();
  $('result-dialog').close();weaponRig.reset();weaponFX.reset();carDamage.reset();lastCarImpact=-10;health=100;energy=100;ammo=24;empCooldown=dashCooldown=shotCooldown=reloadTime=elapsed=0;
  // Restore physical obstacles before resolving civilian spawn clearances.
  // Resolving against the car's old parking place would leave an unnecessary
  // pedestrian displacement after every restart.
  position.set(1.2,1.75,26.8);carPosition.copy(carStart);carSpeed=lookYaw=bob=walkBlend=dashTime=0;carYaw=-.2;
  carBody.position.set(carPosition.x,carPosition.y+.68,carPosition.z);carBody.quaternion.setFromEuler(0,carYaw,0);carBody.velocity.setZero();carBody.angularVelocity.setZero();carBody.aabbNeedsUpdate=true;
  poseController.setTarget(carBody,{position:carBody.position,quaternion:carBody.quaternion});
  cityLife.reset();simulation.reset();motion=playerMovement.reset();lookPitch=.30;player.inVehicle=false;holstered=true;photoMode=false;document.body.classList.remove('photo-mode');firstRun=true;$('kill-feed').replaceChildren();updateHUD();start();
}
function finish(){
  if(mode==='ended')return;cancelService('Neural link lost');mode='ended';document.exitPointerLock?.();keys.clear();audio.motor(0,false);weapon.visible=false;
  document.body.classList.remove('photo-mode');photoMode=false;
  $('result-eyebrow').textContent='NEURAL LINK LOST';
  $('result-title').textContent='Flatlined in Kasumi.';
  $('result-copy').textContent='Your backup is intact. Reconnect to the city.';
  $('result-kills').textContent=simulation.getState().kills;$('result-time').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(Math.floor(elapsed%60)).padStart(2,'0');
  $('result-dialog').showModal();
}
function fire(){
  if(mode!=='playing'||player.inVehicle||shotCooldown>0||reloadTime>0)return;
  cancelService('Weapon drawn');
  if(holstered){holstered=false;shotCooldown=.25;keys.delete('Mouse0');toast('WEAPON DRAWN // CLICK TO FIRE');return}
  if(ammo<=0){reload();return}ammo--;shotCooldown=.14;
  // Synchronize the visible pose before sampling the Blender muzzle socket.
  // Recoil is an impulse for subsequent frames, so this shot leaves that pose.
  updateCamera(0,totalTime);camera.updateWorldMatrix(true,true);
  camera.getWorldDirection(forward);const origin=weaponRig.getMuzzle();
  const result=simulation.shoot(camera.getWorldPosition(new THREE.Vector3()),forward.clone(),{muzzleOrigin:origin});
  weaponRig.fire();audio.shot();return result;
}
function reload(){if(mode!=='playing'||player.inVehicle||holstered||ammo===24||reloadTime>0)return;reloadTime=RELOAD_DURATION;audio.reload();toast('RELOADING // PULSE CARBINE',RELOAD_DURATION*1000)}
function useEMP(){if(mode!=='playing'||empCooldown>0)return;if(energy<40){toast('INSUFFICIENT NEURAL CAPACITY');return}cancelService('Neural discharge interrupted service');energy-=40;empCooldown=10;simulation.emp(position.clone());audio.emp();toast('EMP DISCHARGED // NEURAL DISRUPTION')}
function dash(){if(mode!=='playing'||player.inVehicle||dashCooldown>0||energy<20)return;cancelService('Moved away from terminal');energy-=20;dashCooldown=2.5;dashTime=.22;toast('KINETIC BURST',600)}

function serviceContext(){
  serviceForward.set(-Math.sin(lookYaw)*Math.cos(lookPitch),Math.sin(lookPitch),-Math.cos(lookYaw)*Math.cos(lookPitch));
  return {position,forward:serviceForward,inVehicle:player.inVehicle,vehiclePosition:carPosition,vehicleYaw:carYaw,vehicleSpeed:carSpeed,
    health,energy,carIntegrity:carDamage?.getState().integrity??100,damageVersion,alive:mode==='playing'&&health>0,
    moving:!player.inVehicle&&(motion.speed>.18||['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some(key=>keys.has(key))),
    driving:player.inVehicle,neuralBoostRemaining:neuralBoost.remaining};
}
function updateServices(dt){
  if(!services)return;
  const context=serviceContext(),state=services.update(dt,context);
  serviceWorldEvents.push(...state.events||[]);
  for(const event of state.events||[]){
    if(event.type==='cancelled'){
      serviceResult={id:event.id,title:'Service interrupted',message:event.reason||'Service cancelled',success:false};serviceResultUntil=totalTime+3;continue;
    }
    if(event.type!=='completed')continue;
    const outcome=event.outcome||{};
    if(outcome.healthDelta)health=Math.min(100,health+outcome.healthDelta);
    if(Number.isFinite(outcome.healthRestore))health=Math.min(100,outcome.healthRestore);
    if(outcome.energyDelta)energy=Math.min(100,energy+outcome.energyDelta);
    if(outcome.neuralBoost)neuralBoost={remaining:outcome.neuralBoost.duration,regenMultiplier:outcome.neuralBoost.regenerationMultiplier};
    if(outcome.repairVehicle)carDamage.reset();
    const site=serviceSites.find(item=>item.id===event.id);
    const message=outcome.repairVehicle?'Bodywork and lighting restored.':outcome.waypoint?'Destination marked on your map.':outcome.neuralBoost?'Meal served · Neural recovery +30% for 45s.':outcome.energyDelta?'Neural recharge complete.':'Medical treatment complete.';
    serviceResult={id:event.id,type:site?.type,title:site?.label||'Service complete',message,success:true};serviceResultUntil=totalTime+4;
    audio.hack();
  }
  serviceCandidate=mode==='playing'&&!player.inVehicle?services.findInteractable(serviceContext()):null;
}
function interact(){
  if(mode!=='playing')return;
  if(!player.inVehicle&&services){
    if(services.getState().active){cancelService('Service cancelled');return;}
    const candidate=services.findInteractable(serviceContext());
    if(candidate){
      const result=services.begin(candidate.id,serviceContext());
      if(result.started){holstered=true;keys.delete('Mouse0');serviceResult=null;}
      else toast(result.reason||candidate.reason||'Service unavailable');
      return;
    }
  }
  if(player.inVehicle){
    const offsets=[[3,0],[-3,0],[0,4],[0,-4]];
    let exit=null;
    for(const [dx,dz] of offsets){const x=carPosition.x+dx*Math.cos(carYaw)+dz*Math.sin(carYaw),z=carPosition.z-dx*Math.sin(carYaw)+dz*Math.cos(carYaw),y=city.groundHeightAt(x,z)+1.75;if(!collides(x,z,.45,y)){exit=new THREE.Vector3(x,y,z);break}}
    if(!exit){toast('EXIT BLOCKED');return}position.copy(exit);player.inVehicle=false;carSpeed=0;motion=playerMovement.reset();walkBlend=0;lookYaw=carYaw;lookPitch=.12;toast('INTERCEPTOR // DISCONNECTED');return;
  }
  if(position.distanceTo(carPosition)<5){player.inVehicle=true;weapon.visible=false;carSpeed=0;lookYaw=carYaw;lookPitch=0;toast('INTERCEPTOR ONLINE // WASD DRIVE · E EXIT');return}
  toast('Explore the district. Your interceptor is marked amber on the map.');
}
function collides(x,z,radius,y,staticOnly=false){
  if(x<city.bounds.minX+radius||x>city.bounds.maxX-radius||z<city.bounds.minZ+radius||z>city.bounds.maxZ-radius)return true;
  const driving=radius>1;
  const props=staticOnly?[]:[...(simulation?.getSolidProps()||[]).filter(c=>!driving||!c.dynamic),...(cityLife?.getTrafficColliders()||[]),...(!driving?(city.civilians.getColliders?.()||[]):[])];
  for(const c of [...city.getCollidersAt(x,z,radius),...props]){
    // Tires and footsteps clear ordinary curbs; the surface sampler raises the actor.
    if(c.y+c.sy/2<=city.groundHeightAt(x,z)+.30)continue;
    if(y-(driving?.9:1.68)>c.y+c.sy/2||y+.2<c.y-c.sy/2)continue;
    const yaw=c.ry||0,cs=Math.cos(yaw),sn=Math.sin(yaw),dx=x-c.x,dz=z-c.z;
    const lx=dx*cs-dz*sn,lz=dx*sn+dz*cs;
    const nx=Math.max(-c.sx/2,Math.min(lx,c.sx/2)),nz=Math.max(-c.sz/2,Math.min(lz,c.sz/2));
    if((lx-nx)**2+(lz-nz)**2<radius*radius)return true;
  }
  return false;
}
function carImpact(point,speed){if(elapsed-lastCarImpact<.45||Math.abs(speed)<3)return;lastCarImpact=elapsed;carDamage.hit(point,speed);toast('BODYWORK DAMAGED // '+carDamage.getState().integrity+'% INTEGRITY',1300)}
function movePlayer(dt){
  if(player.inVehicle){
    const throttle=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
    const steer=(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')?1:0);
    carSpeed+=throttle*15*dt;carSpeed*=Math.exp(-(keys.has('Space')?4.5:throttle?.18:1.1)*dt);carSpeed=THREE.MathUtils.clamp(carSpeed,-11,32);
    carYaw+=steer*dt*1.25*Math.min(Math.abs(carSpeed)/6,1)*Math.sign(carSpeed);
    const bumper=carPosition.clone().add(new THREE.Vector3(-Math.sin(carYaw),0,-Math.cos(carYaw)).multiplyScalar(Math.sign(carSpeed)*1.9));
    simulation.ram(bumper,carSpeed);
    const distance=carSpeed*dt,steps=Math.max(1,Math.ceil(Math.abs(distance)/.3));
    for(let i=0;i<steps;i++){
      const nx=carPosition.x-Math.sin(carYaw)*distance/steps,nz=carPosition.z-Math.cos(carYaw)*distance/steps;
      if(!collides(nx,nz,1.45,1,true)){
        const impacts=cityLife.ram(carPosition,new THREE.Vector3(nx,carPosition.y,nz),{yaw:carYaw,speed:carSpeed});
        if(impacts.length){carImpact(impacts[0].point||bumper,carSpeed);simulation.reportCrime('VEHICULAR PROPERTY DAMAGE',1,carPosition);carSpeed*=.65;}
      }
      if(!collides(nx,nz,1.45,1)){
        const previous=carPosition.clone();carPosition.x=nx;carPosition.z=nz;
        simulation.ramCivilians(previous,carPosition,carYaw,carSpeed);
        const streetHits=simulation.ramStreet(previous,carPosition,carYaw,carSpeed);
        if(streetHits.some(hit=>hit.kind==='vehicle')){carImpact(streetHits.find(hit=>hit.kind==='vehicle').point,carSpeed);carSpeed*=.5;break;}
      }else{carImpact(bumper,carSpeed);if(Math.abs(carSpeed)>12)damage(Math.min(8,Math.abs(carSpeed)*.2));carSpeed*=-.24;break}
    }
    carPosition.y=city.groundHeightAt(carPosition.x,carPosition.z)+.008;
    simulation.ram(carPosition,carSpeed);position.copy(carPosition);position.y+=1.75;audio.motor(carSpeed,true);walkBlend=0;
  }else{
    const f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),s=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
    motion=playerMovement.update(dt,{forward:f,strafe:s,yaw:lookYaw,sprint:keys.has('ShiftLeft')||keys.has('ShiftRight'),dash:dashTime>0});
    if(motion.grounded)bob+=motion.distanceMoved*1.9;
    walkBlend=THREE.MathUtils.damp(walkBlend,motion.grounded?Math.min(1,motion.speed/5.4):0,14,dt);
    audio.motor(0,false);
  }
}
function chaseCamera(anchor,desired,dt,smoothing){
  const getColliders=(x,z,radius)=>[...city.getCollidersAt(x,z,radius),...city.groundSurfaces,...simulation.getSolidProps(),...cityLife.getTrafficColliders()];
  const target=resolveCameraBoom({anchor,desired,getColliders,radius:.23});
  const oldDistance=camera.position.distanceTo(anchor),distance=target.distanceTo(anchor);
  const snap=dt===0||oldDistance>18||distance<oldDistance-.03;
  const candidate=snap?target:camera.position.clone().lerp(target,1-Math.exp(-smoothing*dt));
  // Inward recovery is an immediate clear-boom snap. Sweeping from the old
  // camera here can pin it against a tiny trim piece long after the player left.
  // Only the eased outward movement needs the inter-frame travel constraint.
  const solved=resolveCameraBoom({anchor,desired:candidate,getColliders,radius:.23,previous:!snap&&dt>0&&oldDistance<18?camera.position:undefined});
  camera.position.copy(solved);cameraBoomState={active:true,anchor:anchor.toArray(),desired:desired.toArray(),position:solved.toArray(),obstructed:solved.distanceTo(desired)>.08,radius:.23};
}
function updateCamera(dt,time){
  cameraBoomState.active=false;
  if(mode==='menu'){
    camera.position.set(-.5+Math.sin(time*.03)*.18,1.2+Math.sin(time*.08)*.025,32);
    camera.lookAt(-.5,42,-100);
  }else if(mode==='playing'||mode==='paused'){
    if(player.inVehicle){
      tempVec.set(carPosition.x+Math.sin(carYaw)*8,carPosition.y+4.5,carPosition.z+Math.cos(carYaw)*8);
      chaseCamera(carPosition.clone().add(new THREE.Vector3(0,1.6,0)),tempVec,dt,8);camera.lookAt(carPosition.x-Math.sin(carYaw)*7,carPosition.y+1.6,carPosition.z-Math.cos(carYaw)*7);
    }else if(thirdPerson){
      tempVec.set(position.x+Math.sin(lookYaw)*5.2+Math.cos(lookYaw)*1.4,position.y+.3,position.z+Math.cos(lookYaw)*5.2-Math.sin(lookYaw)*1.4);
      chaseCamera(position,tempVec,dt,14);camera.rotation.set(lookPitch,lookYaw,0,'YXZ');
    }else{
      camera.position.copy(position);camera.position.y+=Math.sin(bob)*.028*walkBlend;
      camera.rotation.set(lookPitch,lookYaw,0,'YXZ');
    }
  }
  camera.fov=THREE.MathUtils.lerp(camera.fov,player.inVehicle?72:dashTime>0?80:66,Math.min(1,dt*8));camera.updateProjectionMatrix();
  if(car){car.position.copy(carPosition);car.rotation.y=carYaw}
  if(avatar){
    avatar.visible=(mode==='menu')||(thirdPerson&&!player.inVehicle);
    if(mode==='menu'){avatar.position.set(1.2,city.groundHeightAt(1.2,26.8),26.8);avatar.rotation.y=0}else{avatar.position.set(position.x,position.y-1.75,position.z);avatar.rotation.y=lookYaw}
    const moving=mode==='playing'&&!player.inVehicle&&motion.grounded&&motion.speed>.12;
    for(const [part,multiplier] of [['left_leg',1],['right_leg',-1],['left_arm',-.7],['right_arm',.7]]){const joint=avatar.getObjectByName(part);if(joint)joint.rotation.x=part.endsWith('arm')&&mode==='playing'&&!holstered?1.25+lookPitch+(moving?Math.sin(bob)*.035:0):moving?Math.sin(bob)*.42*multiplier:Math.sin(time*1.3)*.01}
  }
  if(av){av.position.set(14+Math.sin(time*.12)*1.6,33+Math.sin(time*.34)*.35,-6+Math.sin(time*.08)*2);av.rotation.z=Math.sin(time*.18)*.02}
  weaponRig?.update(mode==='playing'?dt:0,{time,bob,moving:motion.grounded&&motion.speed>.12,lookYaw,lookPitch,drawn:!holstered,active:mode==='playing'&&!player.inVehicle,thirdPerson,reloadTime});
  footContact?.update({grounded:mode==='menu'||motion.grounded,inVehicle:player.inVehicle,active:mode!=='dead'});
}
function updateHUD(){
  if(!simulation)return;
  const state=simulation.getState();
  $('health-text').textContent=Math.ceil(health);$('health-bar').style.width=health+'%';$('health-bar').style.background=health<30?'#ff507b':'var(--lime)';
  $('energy-text').textContent=Math.floor(energy)+'%';$('energy-bar').style.width=energy+'%';$('ammo').textContent=reloadTime>0?'--':String(ammo).padStart(2,'0');
  const wanted=state.wantedLevel||0;
  $('security-state').textContent=state.securityState||'PATROL';$('wanted-stars').textContent=Array.from({length:3},(_,i)=>i<wanted?'◆':'◇').join(' ');$('wanted-stars').setAttribute('aria-label','Wanted level '+wanted);
  $('crime-reason').textContent=wanted?(state.securityState==='SEARCHING'?'Evade patrols · '+Math.ceil(state.searchRemaining||0)+'s':state.crimeReason||'Civic alert'):'No active alert';
  $('heat-bar').style.width=(state.heat||0)+'%';$('security-panel').classList.toggle('wanted',wanted>0);
  $('weapon-name').textContent=holstered?'WEAPON HOLSTERED // H TO DRAW':'M-09 // PULSE CARBINE';
  [['emp',empCooldown],['dash',dashCooldown]].forEach(([name,cooldown])=>{$(name+'-status').textContent=cooldown>0?cooldown.toFixed(1)+'s':'READY';$(name+'-btn').classList.toggle('cooldown',cooldown>0)});
  $('vehicle-hud').classList.toggle('hidden',!player.inVehicle);$('crosshair').classList.toggle('hidden',player.inVehicle||holstered);$('speed').textContent=String(Math.round(Math.abs(carSpeed)*3.6)).padStart(3,'0');
  $('vehicle-hud').querySelector('p').textContent='WASD DRIVE · SPACE HANDBRAKE · E EXIT // BODY '+carDamage.getState().integrity+'%';
  serviceInterface?.update({candidate:serviceCandidate,active:services?.getState().active,result:totalTime<serviceResultUntil?serviceResult:null,
    waypoint:services?.getState().waypoint,position,inVehicle:player.inVehicle,visible:mode==='playing',neuralBoost,parkingGuide:getParkingGuide()});
  const prompt=player.inVehicle?'EXIT INTERCEPTOR':serviceInterface?.getState().cardVisible?'':position.distanceTo(carPosition)<5?'DRIVE YŪREI INTERCEPTOR':state.interactPrompt;
  $('interaction').classList.toggle('hidden',!prompt);if(prompt)$('interaction').querySelector('span').textContent=prompt.replace(/^E\s*\/\/\s*/,'');
  $('position-label').textContent=Math.abs(Math.round(position.z))+' M / '+(position.z<0?'NORTH':'SOUTH');
  const district=districtAt(position)?.name||'Kasumi Ward';
  $('current-district').textContent=district;$('roam-district').textContent=district;$('minimap-district').textContent=district.toUpperCase();
  drawMap(state);
}
function drawMap(state){
  const w=220,h=190,scale=player.inVehicle?.55:.82,cx=w/2,cy=h*.7;
  const mx=x=>cx+(x-position.x)*scale,mz=z=>cy+(z-position.z)*scale;
  map.clearRect(0,0,w,h);map.fillStyle='#05151e';map.fillRect(0,0,w,h);
  map.strokeStyle='#24414966';map.lineWidth=.5;
  for(let i=0;i<w;i+=22){map.beginPath();map.moveTo(i,0);map.lineTo(i,h);map.stroke()}
  for(let i=0;i<h;i+=22){map.beginPath();map.moveTo(0,i);map.lineTo(w,i);map.stroke()}
  for(const c of city.colliders){map.fillStyle='#254553';map.fillRect(mx(c.x-c.sx/2),mz(c.z-c.sz/2),c.sx*scale,c.sz*scale)}
  if(city.roads)for(const road of city.roads){map.fillStyle='#325969';map.fillRect(mx(road.x-road.sx/2),mz(road.z-road.sz/2),road.sx*scale,road.sz*scale)}
  map.strokeStyle='#4d77776b';map.setLineDash([3,5]);map.beginPath();map.moveTo(mx(0),0);map.lineTo(mx(0),h);map.stroke();map.setLineDash([]);
  for(const drone of state.remainingTargets||[]){map.fillStyle=drone.hostile?'#ff5489':'#5fc9dd';map.beginPath();map.arc(mx(drone.x),mz(drone.z),2.5,0,Math.PI*2);map.fill()}
  for(const vehicle of cityLife?.getTrafficState()||[]){map.fillStyle='#7097a2';map.fillRect(mx(vehicle.x)-1.5,mz(vehicle.z)-1.5,3,3)}
  drawServiceMarkers(map,mx,mz,false);
  map.fillStyle='#ffe4aa';map.fillRect(mx(carPosition.x)-2,mz(carPosition.z)-4,4,8);
  map.save();map.translate(cx,cy);map.rotate(-(player.inVehicle?carYaw:lookYaw));map.fillStyle='#d7ff55';map.shadowColor='#d7ff55';map.shadowBlur=10;map.beginPath();map.moveTo(0,-6);map.lineTo(4.5,5);map.lineTo(0,2.5);map.lineTo(-4.5,5);map.closePath();map.fill();map.restore();
}
function districtAt(p){return city?.districts?.reduce((best,d)=>!best||Math.hypot(d.x-p.x,d.z-p.z)<Math.hypot(best.x-p.x,best.z-p.z)?d:best,null)}
// Project a parking aid into the HUD. It is a navigation overlay over the real
// street surface; no new floating geometry or physical collision is introduced.
const guideRay=new THREE.Ray(),guideBox=new THREE.Box3(),guideHit=new THREE.Vector3(),guideOrigin=new THREE.Vector3(),guideDirection=new THREE.Vector3();
function getParkingGuide(){
  if(mode!=='playing'||!player.inVehicle)return null;
  const site=serviceSites.filter(s=>s.parking).reduce((best,s)=>!best||Math.hypot(s.parking.x-carPosition.x,s.parking.z-carPosition.z)<Math.hypot(best.parking.x-carPosition.x,best.parking.z-carPosition.z)?s:best,null);
  if(!site)return null;
  const p=site.parking,distance=Math.hypot(p.x-carPosition.x,p.z-carPosition.z);if(distance>25)return null;
  const target=new THREE.Vector3(p.x,city.groundHeightAt(p.x,p.z)+.08,p.z),origin=camera.position,length=origin.distanceTo(target);
  for(const b of city.getCollidersAt((origin.x+target.x)/2,(origin.z+target.z)/2,length/2+.2)){
    const cs=Math.cos(b.ry||0),sn=Math.sin(b.ry||0),dx=origin.x-b.x,dz=origin.z-b.z;
    guideOrigin.set(dx*cs-dz*sn,origin.y-b.y,dx*sn+dz*cs);
    const endX=target.x-b.x,endZ=target.z-b.z;
    guideDirection.set(endX*cs-endZ*sn,target.y-b.y,endX*sn+endZ*cs).sub(guideOrigin).normalize();guideRay.set(guideOrigin,guideDirection);
    guideBox.min.set(-b.sx/2,-b.sy/2,-b.sz/2);guideBox.max.set(b.sx/2,b.sy/2,b.sz/2);
    if(guideBox.containsPoint(guideOrigin)||guideRay.intersectBox(guideBox,guideHit)&&guideOrigin.distanceTo(guideHit)<length-.12)return null;
  }
  const project=v=>{const n=v.clone().project(camera);return n.z< -1||n.z>1?null:{x:(n.x*.5+.5)*innerWidth,y:(.5-n.y*.5)*innerHeight};};
  const cs=Math.cos(p.yaw),sn=Math.sin(p.yaw),screenCorners=[];
  for(const [x,z] of [[-1.75,-3],[1.75,-3],[1.75,3],[-1.75,3]]){
    const wx=p.x+x*cs+z*sn,wz=p.z-x*sn+z*cs,screen=project(new THREE.Vector3(wx,city.groundHeightAt(wx,wz)+.085,wz));if(!screen)return null;screenCorners.push(screen);
  }
  const screenLabel=project(target.clone().add(new THREE.Vector3(0,.1,0)));if(!screenLabel)return null;
  return {label:'SERVICE APRON',distance,screenCorners,screenLabel,width:innerWidth,height:innerHeight,
    aligned:distance<=p.positionTolerance&&Math.abs(Math.sin(carYaw-p.yaw))<=Math.sin(p.yawTolerance)&&Math.abs(carSpeed)<=.15};
}
function drawServiceMarkers(ctx,x,z,full){
  const waypoint=services?.getState().waypoint;
  for(const site of serviceSites){
    const target=site.position||site.target||site.terminal||site;
    if(!Number.isFinite(target.x)||!Number.isFinite(target.z))continue;
    const sx=x(target.x),sz=z(target.z);ctx.fillStyle=site.color||'#91d5b9';
    ctx.strokeStyle='#06222b';ctx.lineWidth=1;ctx.beginPath();ctx.arc(sx,sz,full?3:2,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  if(waypoint&&Number.isFinite(waypoint.x+waypoint.z)){
    const sx=x(waypoint.x),sz=z(waypoint.z);ctx.strokeStyle='#fff0a8';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(sx,sz-7);ctx.lineTo(sx+6,sz);ctx.lineTo(sx,sz+7);ctx.lineTo(sx-6,sz);ctx.closePath();ctx.stroke();
    if(full){ctx.textAlign='center';ctx.font='bold 10px monospace';ctx.fillStyle='#fff0a8';ctx.fillText(waypoint.label,sx,sz-13);}
  }
}
function setupCityMap(){
  const b=city.bounds,w=Math.round(b.maxX-b.minX),h=Math.round(b.maxZ-b.minZ);
  $('city-scale').textContent=w+' × '+h+' METERS / '+(city.districts?.length||1)+' DISTRICTS';
  $('district-list').replaceChildren();
  for(const district of city.districts||[{name:'KASUMI WARD',x:0,z:0}]){const item=document.createElement('div');item.className='map-district';item.innerHTML='<i></i><span></span>';
    item.querySelector('span').textContent=district.name;$('district-list').append(item)}
}
function renderCityMap(){
  const canvas=$('city-map'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,b=city.bounds;
  const scale=Math.min((w-42)/(b.maxX-b.minX),(h-42)/(b.maxZ-b.minZ)),centerX=(b.minX+b.maxX)/2,centerZ=(b.minZ+b.maxZ)/2;
  const x=v=>w/2+(v-centerX)*scale,z=v=>h/2+(v-centerZ)*scale;
  ctx.fillStyle='#041019';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#1d354133';ctx.lineWidth=1;
  for(let i=-700;i<800;i+=50){ctx.beginPath();ctx.moveTo(x(i),0);ctx.lineTo(x(i),h);ctx.stroke();ctx.beginPath();ctx.moveTo(0,z(i));ctx.lineTo(w,z(i));ctx.stroke()}
  for(const c of city.colliders){ctx.fillStyle='#223b4b';ctx.fillRect(x(c.x-c.sx/2),z(c.z-c.sz/2),c.sx*scale,c.sz*scale)}
  for(const road of city.roads||[]){ctx.fillStyle='#3c6977';ctx.fillRect(x(road.x-road.sx/2),z(road.z-road.sz/2),road.sx*scale,road.sz*scale)}
  for(const d of city.districts||[]){ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.fillStyle='#86bed0';ctx.fillText(d.name,x(d.x),z(d.z));}
  const state=simulation.getState();for(const d of state.remainingTargets){ctx.fillStyle=d.hostile?'#ff557e':'#58c7db';ctx.beginPath();ctx.arc(x(d.x),z(d.z),3,0,Math.PI*2);ctx.fill()}
  drawServiceMarkers(ctx,x,z,true);
  ctx.fillStyle='#ffc78f';ctx.fillRect(x(carPosition.x)-3,z(carPosition.z)-5,6,10);
  ctx.strokeStyle='#d7ff55';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x(position.x),z(position.z),10,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#d7ff55';ctx.beginPath();ctx.arc(x(position.x),z(position.z),4,0,Math.PI*2);ctx.fill();
  ctx.textAlign='left';ctx.font='10px monospace';ctx.fillStyle='#84a0ad';ctx.fillText('N ↑',18,24);ctx.fillText('100 M',w-110,h-20);ctx.strokeStyle='#84a0ad';ctx.beginPath();ctx.moveTo(w-110,h-36);ctx.lineTo(w-110+100*scale,h-36);ctx.stroke();
}
function openCityMap(){if(!ready||$('city-map-dialog').open)return;mapWasPlaying=mode==='playing';if(mapWasPlaying)pause();renderCityMap();$('city-map-dialog').showModal()}
function closeCityMap(){const resume=mapWasPlaying;mapWasPlaying=false;$('city-map-dialog').close();if(resume)start()}
let last=0,hudTimer=0;
function animate(timestamp){
  lastFrameSeconds=(timestamp-last)/1000||.016;const dt=Math.min(lastFrameSeconds,.1);last=timestamp;totalTime+=dt;
  trackedFrames.push(lastFrameSeconds);if(trackedFrames.length>120)trackedFrames.shift();
  if(mode==='playing'){
    neuralBoost.remaining=Math.max(0,neuralBoost.remaining-dt);
    elapsed+=dt;energy=Math.min(100,energy+dt*7*(neuralBoost.remaining>0?neuralBoost.regenMultiplier:1));empCooldown=Math.max(0,empCooldown-dt);dashCooldown=Math.max(0,dashCooldown-dt);dashTime=Math.max(0,dashTime-dt);shotCooldown=Math.max(0,shotCooldown-dt);
    if(reloadTime>0){reloadTime-=dt;if(reloadTime<=0){ammo=24;audio.reload()}}
    carStepStart.copy(carPosition);const previousCarYaw=carYaw;
    movePlayer(dt);
    // Supply accepted movement to contacts without a second integration beyond
    // that pose, including every internal physics substep on a slow frame.
    carBody.position.set(carPosition.x,carPosition.y+.68,carPosition.z);carBody.quaternion.setFromEuler(0,carYaw,0);
    carBody.velocity.set((carPosition.x-carStepStart.x)/dt,(carPosition.y-carStepStart.y)/dt,(carPosition.z-carStepStart.z)/dt);
    carBody.angularVelocity.set(0,Math.atan2(Math.sin(carYaw-previousCarYaw),Math.cos(carYaw-previousCarYaw))/dt,0);carBody.aabbNeedsUpdate=true;
    poseController.setTarget(carBody,{position:carBody.position,quaternion:carBody.quaternion,velocity:carBody.velocity,angularVelocity:carBody.angularVelocity});
    serviceWorld.update(dt,{...services.getState(),events:serviceWorldEvents.splice(0),playing:true,position,vehicle:{x:carPosition.x,y:carPosition.y,z:carPosition.z,yaw:carYaw}});
    simulation.update(dt,totalTime,player);
    serviceWorld.afterPhysics();
    cityLife.afterPhysics();
    poseController.clearContactHints(carBody);
    updateServices(dt);
  }
  if(mode!=='playing'){
    serviceWorld.update(dt,{...services.getState(),events:serviceWorldEvents.splice(0),playing:false,position,vehicle:{x:carPosition.x,y:carPosition.y,z:carPosition.z,yaw:carYaw}});
    serviceWorld.afterPhysics();
    cityLife.afterPhysics();
  }
  // The opening screen is an animated camera over the same playable city.
  if(mode==='playing'||mode==='menu'){city.update(dt,totalTime,position);cityLife.update(dt,totalTime,position);atmosphere.update(dt,totalTime,position)}
  updateCamera(dt,totalTime);
  camera.getWorldDirection(soundDirection);
  audio.update(dt,{position:camera.position,yaw:Math.atan2(-soundDirection.x,-soundDirection.z),pitch:Math.asin(soundDirection.y),playing:mode==='playing',inVehicle:player.inVehicle,
    grounded:motion.grounded,speed:player.inVehicle?carSpeed:motion.speed,distanceMoved:mode==='playing'&&!player.inVehicle?motion.distanceMoved:0,groundY:motion.groundY,
    traffic:cityLife.getTrafficState(),emitters:city.audioEmitters,district:districtAt(position)?.name});
  if(mode==='playing'){weaponFX.update(dt);if(keys.has('Mouse0'))fire();}
  hudTimer+=dt;if(hudTimer>.075){hudTimer=0;updateHUD()}
  const minutes=48+Math.floor(totalTime/60);$('clock').textContent=String((23+Math.floor(minutes/60))%24).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
  cityShadows.update(position);renderer.info.reset();composer.render();
}

window.addEventListener('keydown',event=>{
  if(event.code==='KeyM'&&$('city-map-dialog').open){if(!event.repeat)closeCityMap();return}
  if(mode!=='playing'&&event.target instanceof HTMLButtonElement&&['Space','Enter'].includes(event.code))return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(event.code))event.preventDefault();
  if(mode!=='playing')return;
  keys.add(event.code);if(event.repeat)return;
  if(event.code==='Escape'){pause();return}
  if(event.code==='KeyE')interact();if(event.code==='KeyQ')useEMP();if(event.code==='KeyR')reload();
  if(event.code==='KeyH'){holstered=!holstered;keys.delete('Mouse0');if(!holstered)cancelService('Weapon drawn')}
  if(event.code==='KeyV'){thirdPerson=!thirdPerson;toast(thirdPerson?'THIRD PERSON':'FIRST PERSON',1000)}
  if(event.code==='KeyP'){photoMode=!photoMode;document.body.classList.toggle('photo-mode',photoMode)}
  if(event.code==='KeyM')openCityMap();
  if(event.code==='Space'&&!player.inVehicle)playerMovement.jump();
  if(event.code==='ShiftLeft'||event.code==='ShiftRight'){if(totalTime-lastShift<.3)dash();lastShift=totalTime}
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{keys.clear();if(mode==='playing')pause()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause()});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&mode==='playing'&&!document.querySelector('dialog[open]'))pause()});
window.addEventListener('mousemove',event=>{if(mode==='playing'&&!player.inVehicle&&(document.pointerLockElement||dragging)){lookYaw-=event.movementX*.0022;lookPitch=THREE.MathUtils.clamp(lookPitch-event.movementY*.0022,-1.35,1.35)}});
window.addEventListener('mousedown',event=>{if(mode!=='playing'||event.target.closest('button,dialog'))return;if(event.button===2)dragging=true;if(event.button===0){keys.add('Mouse0');fire()}});
window.addEventListener('mouseup',()=>{keys.delete('Mouse0');dragging=false});
window.addEventListener('contextmenu',event=>event.preventDefault());
window.addEventListener('resize',()=>{if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer?.setSize(innerWidth,innerHeight)});
$('start-btn').addEventListener('click',start);$('restart-btn').addEventListener('click',restart);
$('map-btn').addEventListener('click',openCityMap);$('map-return-btn').addEventListener('click',closeCityMap);
$('brand').addEventListener('click',event=>{event.preventDefault();pause()});$('menu-btn').addEventListener('click',()=>mode==='playing'?pause():ready&&start());
$('sound-btn').addEventListener('click',async()=>{const enabled=await audio.toggle();$('sound-state').textContent=enabled?'ON':'OFF';$('sound-btn').setAttribute('aria-label',enabled?'Mute sound':'Enable sound')});
function openDialog(id){if(mode==='playing')pause();$(id).showModal()}
$('concept-btn').addEventListener('click',()=>openDialog('concept-dialog'));
$('controls-btn').addEventListener('click',()=>openDialog('help-dialog'));$('help-btn').addEventListener('click',()=>openDialog('help-dialog'));
$('help-play').addEventListener('click',()=>$('help-dialog').close());
document.querySelectorAll('.close-modal').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').id==='city-map-dialog'?closeCityMap():button.closest('dialog').close()));
$('city-map-dialog').addEventListener('cancel',event=>{event.preventDefault();closeCityMap()});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close()}}));
$('emp-btn').addEventListener('click',useEMP);$('dash-btn').addEventListener('click',dash);
init();
