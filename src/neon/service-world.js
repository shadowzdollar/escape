import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {evaluateServiceFixture} from './service-fixtures.js';
import {getKinematicPoseController} from './kinematic-pose.js';

/** Presentation and exact box bodies only. Service outcomes remain in main. */
export function createServiceWorld({scene,recipes=[]}={}){
  const list=Array.isArray(recipes)?recipes:recipes.recipes||[],root=new THREE.Group();root.name='Wall-mounted service mechanisms';scene?.add(root);
  const entries=list.map(recipe=>({recipe,phase:'idle',progress:0,closure:0,hold:0,pose:null})),byId=new Map(entries.map(e=>[e.recipe.id,e]));
  const queue=[],seenEvents=new Set(),bodies=[],bindings=[];let physics=null,disposed=false,elapsed=0,lastActive=null,colliders=[];
  const cube=new THREE.BoxGeometry(),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3(),color=new THREE.Color(),axis=new THREE.Vector3(0,1,0);
  const solids=list.flatMap(r=>r.parts.filter(p=>!p.emissive)),lights=list.flatMap(r=>r.parts.filter(p=>p.emissive));
  const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.57,metalness:.46});
  const lightMaterial=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false});
  const mesh=new THREE.InstancedMesh(cube,material,Math.max(1,solids.length)),lightMesh=new THREE.InstancedMesh(cube,lightMaterial,Math.max(1,lights.length));
  mesh.name='Attached service machinery / solid parts';lightMesh.name='Service indicators / mounted luminous surfaces';mesh.count=solids.length;lightMesh.count=lights.length;
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);lightMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=lightMesh.frustumCulled=false;root.add(mesh,lightMesh);
  const index=new Map();solids.forEach((p,i)=>{index.set(p.id,{mesh,index:i});mesh.setColorAt(i,color.set(p.color));});lights.forEach((p,i)=>{index.set(p.id,{mesh:lightMesh,index:i});lightMesh.setColorAt(i,color.set(p.color));});
  const beamGeometry=new THREE.BufferGeometry(),beamPositions=new Float32Array(Math.max(1,list.length)*6),beamColors=new Float32Array(beamPositions.length);
  beamGeometry.setAttribute('position',new THREE.BufferAttribute(beamPositions,3).setUsage(THREE.DynamicDrawUsage));beamGeometry.setAttribute('color',new THREE.BufferAttribute(beamColors,3).setUsage(THREE.DynamicDrawUsage));
  const beamMaterial=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.28,depthWrite:false,toneMapped:false}),beamMesh=new THREE.LineSegments(beamGeometry,beamMaterial);beamMesh.frustumCulled=false;beamMesh.name='Mounted service scanner light';root.add(beamMesh);
  const steamMaterial=new THREE.MeshBasicMaterial({color:'#c9d5d1',transparent:true,opacity:.16,depthWrite:false}),steam=new THREE.InstancedMesh(cube,steamMaterial,36);steam.name='Warm meal vapor / pooled voxels';steam.frustumCulled=false;steam.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(steam);

  function observe(events=[]){for(const event of events){const key=event.eventId||event.type+':'+event.id+':'+elapsed;if(seenEvents.has(key))continue;seenEvents.add(key);queue.push(event);if(seenEvents.size>96)seenEvents.delete(seenEvents.values().next().value);}}
  function close(entry,success){if(!entry)return;entry.phase=success?'success':'cancelled';if(success)entry.progress=1;entry.closure=0;entry.hold=success?(entry.recipe.type==='food'?.75:.15):0;}
  function writePose(entry){
    for(const part of entry.pose.boxes){const binding=index.get(part.id);position.set(part.x,part.y,part.z);quaternion.setFromAxisAngle(axis,part.ry||0);scale.set(part.sx,part.sy,part.sz);matrix.compose(position,quaternion,scale);binding.mesh.setMatrixAt(binding.index,matrix);if(part.emissive)binding.mesh.setColorAt(binding.index,color.set(part.color).multiplyScalar(part.intensity));}
  }
  function update(dt,state={}){
    if(disposed)return;const step=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));if(state.playing!==false)elapsed+=step;
    observe(state.events||[]);const active=state.active;
    const processed=new Set();for(const event of queue.splice(0)){const entry=byId.get(event.id);if(event.type==='completed'||event.type==='cancelled'){close(entry,event.type==='completed');processed.add(event.id);}}
    if(lastActive&&lastActive!==active?.id&&!processed.has(lastActive)){const result=state.result;close(byId.get(lastActive),result?.id===lastActive&&result.success===true);}
    if(active&&state.playing!==false){const entry=byId.get(active.id);if(entry){entry.phase='active';entry.progress=active.progress;entry.closure=0;entry.hold=0;}}
    lastActive=active&&state.playing!==false?active.id:null;
    let beamCount=0,steamCount=0;colliders=[];
    for(const entry of entries){
      if(state.playing===false&&entry.phase==='active')close(entry,false);
      if(entry.phase==='success'||entry.phase==='cancelled'){
        if(entry.hold>0)entry.hold=Math.max(0,entry.hold-step);else entry.closure=Math.min(1,entry.closure+step/.55);
        if(entry.closure>=1){entry.phase=(state.cooldowns?.[entry.recipe.id]||0)>0?'cooldown':'idle';entry.progress=0;}
      }else if(entry.phase!=='active')entry.phase=(state.cooldowns?.[entry.recipe.id]||0)>0?'cooldown':'idle';
      entry.pose=evaluateServiceFixture(entry.recipe,{phase:entry.phase,progress:entry.progress,closure:entry.closure,elapsed,vehicle:state.vehicle,position:state.position});writePose(entry);
      for(const part of entry.pose.boxes)if(part.solid)colliders.push({id:part.id,serviceId:entry.recipe.id,partGroup:part.partGroup,x:part.x,y:part.y,z:part.z,sx:part.sx,sy:part.sy,sz:part.sz,ry:part.ry,serviceFixture:true,dynamic:false,immovable:true,kinematic:part.partGroup!=='fixed'});
      for(const effect of entry.pose.effects){
        if(effect.kind==='beam'&&beamCount<list.length){const offset=beamCount*6;beamPositions.set([effect.from.x,effect.from.y,effect.from.z,effect.to.x,effect.to.y,effect.to.z],offset);color.set(effect.color);beamColors.set([color.r,color.g,color.b,color.r,color.g,color.b],offset);beamCount++;}
        if(effect.kind==='steam')for(let i=0;i<12&&steamCount<36;i++){const life=(elapsed*.72+i/12)%1,angle=i*2.399;position.set(effect.origin.x+Math.sin(angle+elapsed*.2)*(.035+life*.06),effect.origin.y+life*.38,effect.origin.z+Math.cos(angle)*(.035+life*.05));quaternion.identity();scale.setScalar((.025+life*.035)*(1-life*.7));matrix.compose(position,quaternion,scale);steam.setMatrixAt(steamCount++,matrix);}
      }
    }
    beamGeometry.setDrawRange(0,beamCount*2);beamGeometry.attributes.position.needsUpdate=true;beamGeometry.attributes.color.needsUpdate=true;steam.count=steamCount;steam.instanceMatrix.needsUpdate=true;
    mesh.instanceMatrix.needsUpdate=true;lightMesh.instanceMatrix.needsUpdate=true;if(lightMesh.instanceColor)lightMesh.instanceColor.needsUpdate=true;
    for(const binding of bindings){const transform=binding.entry.pose.groups.find(g=>g.id===binding.group);if(!transform)continue;const b=binding.body;
      binding.contactVelocity.set(step?(transform.x-b.position.x)/step:0,step?(transform.y-b.position.y)/step:0,step?(transform.z-b.position.z)/step:0);binding.rotation.setFromEuler(0,transform.ry,0);physics.controller.setTarget(b,{position:transform,quaternion:binding.rotation,velocity:binding.contactVelocity});binding.target=transform;}
  }
  function attachPhysics({world,material:physicalMaterial}={}){
    if(disposed||!world)return;if(physics?.world===world)return;if(physics)throw new Error('Service fixtures already belong to a physics world');physics={world,controller:getKinematicPoseController(world)};
    for(const entry of entries){const groups=new Map();for(const part of entry.recipe.parts.filter(p=>p.solid)){if(!groups.has(part.partGroup))groups.set(part.partGroup,[]);groups.get(part.partGroup).push(part);}
      for(const [group,parts] of groups){const body=new CANNON.Body({mass:0,type:group==='fixed'?CANNON.Body.STATIC:CANNON.Body.KINEMATIC,material:physicalMaterial,collisionFilterGroup:2,collisionFilterMask:~2});body.position.set(entry.recipe.origin.x,entry.recipe.origin.y,entry.recipe.origin.z);body.quaternion.setFromEuler(0,entry.recipe.ry,0);
        for(const p of parts)body.addShape(new CANNON.Box(new CANNON.Vec3(p.sx/2,p.sy/2,p.sz/2)),new CANNON.Vec3(p.local.x,p.local.y,p.local.z));
        body.userData={type:'service-fixture',serviceId:entry.recipe.id,partGroup:group};world.addBody(body);bodies.push(body);if(group!=='fixed')bindings.push({entry,group,body,target:null,contactVelocity:new CANNON.Vec3(),rotation:new CANNON.Quaternion()});
      }
    }update(0,{});
  }
  // Kinematic velocity participates in contacts, but Cannon must not leave a
  // second integrated displacement beyond the pose already rendered above.
  function afterPhysics(){for(const {body,contactVelocity} of bindings){physics.controller.clearContactHints(body);contactVelocity.setZero();}}
  function reset(){queue.length=0;seenEvents.clear();lastActive=null;elapsed=0;for(const e of entries){e.phase='idle';e.progress=e.closure=e.hold=0;}update(0,{});afterPhysics();}
  function getState(){return{sites:entries.length,solidParts:colliders.length,physicsBodies:bodies.length,movingBodies:bindings.length,queuedEvents:queue.length,fixtures:entries.map(e=>({id:e.recipe.id,type:e.recipe.type,phase:e.phase,progress:e.progress,closure:e.closure,groups:e.pose?.groups}))};}
  function dispose(){if(disposed)return;disposed=true;for(const body of bodies){physics?.controller.unregister(body);physics?.world.removeBody(body);}root.removeFromParent();mesh.dispose();lightMesh.dispose();steam.dispose();cube.dispose();material.dispose();lightMaterial.dispose();beamGeometry.dispose();beamMaterial.dispose();steamMaterial.dispose();queue.length=0;colliders=[];bodies.length=bindings.length=0;}
  update(0,{});return{root,update,observe,attachPhysics,afterPhysics,getColliders:()=>colliders,getState,reset,dispose};
}
