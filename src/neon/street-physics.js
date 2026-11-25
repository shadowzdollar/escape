import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/** Movable street furniture sharing the game's rigid-body world. */
export function createStreetPhysics({scene,world,material,props=[],groundHeightAt=()=>0}) {
  const group=new THREE.Group();group.name='Physical street furniture';scene.add(group);
  const geometry=new THREE.BoxGeometry(1,1,1),solid=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.7,metalness:.45});
  const luminous=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:.55,roughness:.5});
  const dummy=new THREE.Object3D(),color=new THREE.Color(),matrix=new THREE.Matrix4(),rotation=new THREE.Matrix4();
  const ray=new THREE.Ray(),point=new THREE.Vector3(),box=new THREE.Box3();
  const actors=[],records={solid:[],glow:[]},meshes={};let elapsed=0,impacts=0,vehicleMaterial=null;
  for(const spec of props) {
    const center=new CANNON.Vec3(spec.x,spec.y,spec.z),body=new CANNON.Body({mass:Math.max(2,spec.mass||14),material,
      linearDamping:.16,angularDamping:.24,allowSleep:true,sleepSpeedLimit:.14,sleepTimeLimit:1.1});
    body.position.copy(center);
    const parts=spec.parts?.length?spec.parts:[{...spec,c:'#455963'}];
    // A few compound boxes retain the bin's walls/lid and produce off-centre
    // torque when a bumper or shot hits. Large voxel decorations use one hull.
    if(parts.length<=24)for(const part of parts){
      body.addShape(new CANNON.Box(new CANNON.Vec3(Math.max(.015,part.sx/2),Math.max(.015,part.sy/2),Math.max(.015,part.sz/2))),
        new CANNON.Vec3(part.x-spec.x,part.y-spec.y,part.z-spec.z),new CANNON.Quaternion().setFromEuler(0,part.ry||0,0));
    }else body.addShape(new CANNON.Box(new CANNON.Vec3(spec.sx/2,spec.sy/2,spec.sz/2)));
    world.addBody(body);body.sleep();
    const actor={id:spec.id,kind:spec.kind||'street-prop',spec,body,spawn:center.clone(),lastRam:-Infinity,hit:false};actors.push(actor);
    for(const part of parts){
      dummy.position.set(part.x-spec.x,part.y-spec.y,part.z-spec.z);dummy.scale.set(part.sx,part.sy,part.sz);dummy.rotation.set(0,part.ry||0,0);dummy.updateMatrix();
      records[part.kind==='glow'?'glow':'solid'].push({actor,local:dummy.matrix.clone(),color:part.c||'#455963'});
    }
  }
  for(const kind of['solid','glow'])if(records[kind].length){
    const mesh=new THREE.InstancedMesh(geometry,kind==='solid'?solid:luminous,records[kind].length);mesh.name='Street furniture / '+kind;mesh.frustumCulled=false;
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    records[kind].forEach((record,i)=>mesh.setColorAt(i,color.set(record.color)));group.add(mesh);meshes[kind]=mesh;
  }
  const bounds=actor=>{actor.body.updateAABB();const a=actor.body.aabb;return box.set(new THREE.Vector3(a.lowerBound.x,a.lowerBound.y,a.lowerBound.z),new THREE.Vector3(a.upperBound.x,a.upperBound.y,a.upperBound.z));};
  function addObject(spec){
    if(!spec.id||!spec.visual)throw new Error('Physical objects need a stable id and visual');
    if(actors.some(actor=>actor.id===spec.id))throw new Error('Duplicate physical object '+spec.id);
    const visual=spec.visual;visual.updateWorldMatrix(true,true);
    const inverse=new THREE.Matrix4().copy(visual.matrixWorld).invert(),localBounds=new THREE.Box3();
    visual.traverse(child=>{if(!child.isMesh)return;child.geometry.computeBoundingBox();
      localBounds.union(child.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,child.matrixWorld)));});
    if(localBounds.isEmpty())localBounds.setFromCenterAndSize(new THREE.Vector3(0,spec.sy/2,0),new THREE.Vector3(spec.sx,spec.sy,spec.sz));
    const scale=visual.getWorldScale(new THREE.Vector3()),size=localBounds.getSize(new THREE.Vector3()).multiply(scale),localCenter=localBounds.getCenter(new THREE.Vector3()).multiply(scale);
    const quaternion=visual.getWorldQuaternion(new THREE.Quaternion()),center=visual.getWorldPosition(new THREE.Vector3()).add(localCenter.clone().applyQuaternion(quaternion));
    if(!vehicleMaterial){vehicleMaterial=new CANNON.Material('rolling vehicle hull');world.addContactMaterial(new CANNON.ContactMaterial(material,vehicleMaterial,{friction:.065,restitution:.13}));}
    const body=new CANNON.Body({mass:spec.mass||1200,material:vehicleMaterial,linearDamping:.23,angularDamping:.44,allowSleep:true,sleepSpeedLimit:.14,sleepTimeLimit:1.1});
    body.addShape(new CANNON.Box(new CANNON.Vec3(size.x/2,size.y/2,size.z/2)));body.position.set(center.x,center.y,center.z);body.quaternion.set(quaternion.x,quaternion.y,quaternion.z,quaternion.w);
    body.userData={id:spec.id,type:spec.kind||'vehicle'};world.addBody(body);body.sleep();
    const actor={id:spec.id,kind:spec.kind||'vehicle',spec:{...spec,sx:size.x,sy:size.y,sz:size.z},body,visual,localCenter,
      spawn:body.position.clone(),spawnQuaternion:body.quaternion.clone(),spawnVisual:visual.matrix.clone(),lastRam:-Infinity,hit:false};
    actors.push(actor);return actor;
  }
  function update(dt=0){
    elapsed+=Math.max(0,dt);
    for(const actor of actors)if(actor.visual){
      const b=actor.body,q=new THREE.Quaternion(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w);
      const origin=new THREE.Vector3(b.position.x,b.position.y,b.position.z).sub(actor.localCenter.clone().applyQuaternion(q));
      matrix.compose(origin,q,actor.visual.getWorldScale(new THREE.Vector3()));
      if(actor.visual.parent)matrix.premultiply(new THREE.Matrix4().copy(actor.visual.parent.matrixWorld).invert());
      matrix.decompose(actor.visual.position,actor.visual.quaternion,actor.visual.scale);
    }
    for(const kind of['solid','glow']){
      if(!meshes[kind])continue;
      records[kind].forEach((record,i)=>{
        const b=record.actor.body;matrix.compose(new THREE.Vector3(b.position.x,b.position.y,b.position.z),new THREE.Quaternion(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w),new THREE.Vector3(1,1,1));
        rotation.multiplyMatrices(matrix,record.local);meshes[kind].setMatrixAt(i,rotation);
      });meshes[kind].instanceMatrix.needsUpdate=true;
    }
  }
  function raycast(origin,direction,maxDistance=110){
    ray.set(origin,direction);let hit=null,nearest=maxDistance;
    for(const actor of actors)if(ray.intersectBox(bounds(actor),point)){
      const distance=origin.distanceTo(point);if(distance<nearest){nearest=distance;hit={id:actor.id,distance,point:point.clone()};}
    }return hit;
  }
  function shoot(id,hitPoint,direction){
    const actor=actors.find(p=>p.id===id);if(!actor)return false;
    const b=actor.body;b.wakeUp();
    const mass=Math.min(24,b.mass);
    b.applyImpulse(new CANNON.Vec3(direction.x*mass*2.5,(direction.y*2.5+.85)*mass,direction.z*mass*2.5),
      new CANNON.Vec3(hitPoint.x-b.position.x,hitPoint.y-b.position.y,hitPoint.z-b.position.z));
    actor.spec.onImpact?.({point:hitPoint.clone(),speed:5,direction:direction.clone(),cause:'gun'});
    actor.hit=true;impacts++;return true;
  }
  function sweptContact(from,to,yaw,target,halfWidth=1.45,halfLength=2.64){
    const a=bounds(target),cx=(a.min.x+a.max.x)/2,cz=(a.min.z+a.max.z)/2,hx=(a.max.x-a.min.x)/2,hz=(a.max.z-a.min.z)/2;
    const floor=Math.min(from.y??groundHeightAt(from.x,from.z),to.y??groundHeightAt(to.x,to.z));
    if(a.min.y>floor+1.55||a.max.y<floor-.15)return false;
    const c=Math.cos(yaw),s=Math.sin(yaw);let enter=0,leave=1;
    for(const[ax,az]of[[1,0],[0,1],[c,-s],[s,c]]){
      const extent=Math.abs(ax)*hx+Math.abs(az)*hz+halfWidth*Math.abs(ax*c-az*s)+halfLength*Math.abs(ax*s+az*c);
      const start=(from.x-cx)*ax+(from.z-cz)*az,delta=(to.x-from.x)*ax+(to.z-from.z)*az;
      if(Math.abs(delta)<1e-9){if(Math.abs(start)>extent)return false;continue;}
      const first=(-extent-start)/delta,last=(extent-start)/delta;enter=Math.max(enter,Math.min(first,last));leave=Math.min(leave,Math.max(first,last));if(enter>leave)return false;
    }return true;
  }
  function ram(from,to,{yaw=0,speed=0,halfWidth=1.45,halfLength=2.64}={}){
    const magnitude=Math.abs(speed),direction=new THREE.Vector3(to.x-from.x,0,to.z-from.z);if(magnitude<1.2||direction.lengthSq()<1e-10)return[];direction.normalize();
    const hits=[];
    for(const actor of actors){
      if(elapsed-actor.lastRam<.45||!sweptContact(from,to,yaw,actor,halfWidth,halfLength))continue;
      const b=actor.body;b.wakeUp();actor.lastRam=elapsed;actor.hit=true;impacts++;
      const vehicle=actor.kind==='vehicle',launch=vehicle?Math.min(12,magnitude*.45):Math.min(20,magnitude*.72),lift=vehicle?Math.min(1.2,.12+magnitude*.025):Math.min(6,.5+magnitude*.18);
      b.applyImpulse(new CANNON.Vec3(direction.x*b.mass*launch,b.mass*lift,direction.z*b.mass*launch),new CANNON.Vec3(0,-Math.min(actor.spec.sy*.3,.45),0));
      const spin=vehicle?Math.min(.7,magnitude*.025):Math.min(9,magnitude*.35);b.angularVelocity.x+=direction.z*spin;b.angularVelocity.z-=direction.x*spin;
      const point=new THREE.Vector3(b.position.x-direction.x*actor.spec.sz*.45,b.position.y,b.position.z-direction.z*actor.spec.sz*.45);
      actor.spec.onImpact?.({point,speed:magnitude,direction:direction.clone(),cause:'vehicle'});
      hits.push({id:actor.id,kind:actor.kind,point,speed:magnitude});
    }return hits;
  }
  function getColliders(){return actors.map(actor=>{const a=bounds(actor),b=actor.body;return{id:actor.id,kind:actor.kind,dynamic:true,x:(a.min.x+a.max.x)/2,y:(a.min.y+a.max.y)/2,z:(a.min.z+a.max.z)/2,sx:a.max.x-a.min.x,sy:a.max.y-a.min.y,sz:a.max.z-a.min.z,yaw:Math.atan2(2*(b.quaternion.w*b.quaternion.y+b.quaternion.x*b.quaternion.z),1-2*(b.quaternion.y*b.quaternion.y+b.quaternion.x*b.quaternion.x)),halfWidth:actor.spec.sx/2,halfLength:actor.spec.sz/2};});}
  function getVehicleBlockers(){return getColliders().filter(actor=>actor.kind==='vehicle');}
  function getState(){return{total:actors.length,moving:actors.filter(a=>a.body.velocity.lengthSquared()>.09).length,impacts,props:actors.map(a=>({id:a.id,kind:a.kind,x:a.body.position.x,y:a.body.position.y,z:a.body.position.z,speed:a.body.velocity.length(),sleeping:a.body.sleepState===CANNON.Body.SLEEPING,hit:a.hit}))};}
  function reset(){elapsed=0;impacts=0;for(const actor of actors){const b=actor.body;b.position.copy(actor.spawn);if(actor.spawnQuaternion)b.quaternion.copy(actor.spawnQuaternion);else b.quaternion.set(0,0,0,1);b.velocity.setZero();b.angularVelocity.setZero();b.force.setZero();b.torque.setZero();b.aabbNeedsUpdate=true;b.sleep();actor.hit=false;actor.lastRam=-Infinity;actor.spec.onReset?.();}update();}
  function dispose(){for(const actor of actors)world.removeBody(actor.body);scene.remove(group);geometry.dispose();solid.dispose();luminous.dispose();}
  update();return{update,raycast,shoot,ram,getColliders,getVehicleBlockers,getState,reset,dispose,addObject};
}
