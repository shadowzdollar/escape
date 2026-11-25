import * as THREE from 'three';
import {batchVoxelAsset} from './voxel-assets.js';

const FORWARD=new THREE.Vector3(0,0,-1),SPEED=240,MAX_SHOTS=18,MAX_BURSTS=16;

/** Short travelling Blender ion bolts and surface chips, with bounded pools. */
export function createWeaponVFX({scene,boltSource,shardsSource}) {
  const root=new THREE.Group();root.name='Blender ion projectile effects';scene.add(root);
  const boltTemplate=batchVoxelAsset(boltSource,'ion-bolt');
  const trailGeometry=new THREE.BoxGeometry(.018,.018,1);
  const trailMaterial=new THREE.MeshBasicMaterial({color:'#3bd6ee',transparent:true,opacity:.4,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const shardTemplates=[];shardsSource.updateMatrixWorld(true);
  shardsSource.traverse(o=>{if(!o.isMesh)return;
    const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);geometry.computeBoundingBox();
    const center=geometry.boundingBox.getCenter(new THREE.Vector3());geometry.translate(-center.x,-center.y,-center.z);
    const color=(Array.isArray(o.material)?o.material[0]:o.material).color;
    const material=new THREE.MeshBasicMaterial({color:color||'#ffe9af',transparent:true,depthWrite:false,toneMapped:false});
    shardTemplates.push({geometry,material});
  });
  // Keep GPU materials alive between shots. Disposing the last material for a
  // short-lived effect deletes its shader program and recompiles on every hit.
  const flightPool=Array.from({length:MAX_SHOTS},()=>{
    const group=new THREE.Group();group.visible=false;root.add(group);
    const bolt=boltTemplate.clone();bolt.material=boltTemplate.material.clone();bolt.material.onBeforeCompile=boltTemplate.material.onBeforeCompile;bolt.material.customProgramCacheKey=boltTemplate.material.customProgramCacheKey;bolt.material.transparent=true;bolt.material.depthWrite=false;bolt.name='Blender stepped ion core';group.add(bolt);
    const trail=new THREE.Mesh(trailGeometry,trailMaterial.clone());trail.name='Ion wake';group.add(trail);
    return {group,bolt,trail,inUse:false};
  });
  const burstPool=Array.from({length:MAX_BURSTS},()=>{
    const group=new THREE.Group();group.visible=false;root.add(group);
    const particles=shardTemplates.slice(0,10).map((template,i)=>{
      const mesh=new THREE.Mesh(template.geometry,template.material.clone());mesh.name='Blender impact chip';group.add(mesh);
      return {mesh,velocity:new THREE.Vector3(),spin:(i%2?1:-1)*(7+i)};
    });
    return {group,particles,inUse:false,age:0,life:.24};
  });
  const flights=[],bursts=[];let serial=0,lastShot=null;
  function releaseFlight(shot){shot.group.visible=false;shot.inUse=false;}
  function releaseBurst(burst){burst.group.visible=false;burst.inUse=false;}
  function impact(shot){
    if(!shot.surface)return;
    while(bursts.length>=MAX_BURSTS)releaseBurst(bursts.shift());
    const burst=burstPool.find(b=>!b.inUse),{group,particles}=burst;burst.inUse=true;burst.age=0;group.visible=true;
    group.name='Angular impact '+shot.id;group.position.copy(shot.end);
    const n=shot.normal.clone().normalize(),tangent=new THREE.Vector3(0,1,0).cross(n);
    if(tangent.lengthSq()<.01)tangent.set(1,0,0);tangent.normalize();const bitangent=n.clone().cross(tangent);
    for(let i=0;i<particles.length;i++){
      const {mesh,velocity}=particles[i];mesh.position.copy(n).multiplyScalar(.015);mesh.scale.setScalar(1);mesh.material.opacity=1;
      const angle=i*2.39996+shot.id*.31,speed=1.4+(i%4)*.65;
      velocity.copy(n).multiplyScalar(1.1+(i%3)*.3).addScaledVector(tangent,Math.cos(angle)*speed).addScaledVector(bitangent,Math.sin(angle)*speed);
      mesh.rotation.set(i*.73,i*.21,i*.44);
    }
    bursts.push(burst);
  }
  function fire(event){
    while(flights.length>=MAX_SHOTS)releaseFlight(flights.shift());
    const origin=event.origin.clone(),end=event.point.clone(),distance=origin.distanceTo(end),direction=distance>1e-6?end.clone().sub(origin).normalize():event.direction.clone();
    const shot=flightPool.find(s=>!s.inUse),{group,bolt,trail}=shot;shot.inUse=true;group.visible=true;
    group.name='Ion bolt '+(++serial);group.position.copy(origin);group.quaternion.setFromUnitVectors(FORWARD,direction);
    // At birth the nose is at the muzzle, and no part extends behind it.
    bolt.scale.z=.001;bolt.visible=false;trail.visible=false;
    const surface=Boolean(event.targetType)&&event.targetType!=='none';
    Object.assign(shot,{id:serial,origin,end,distance,direction,surface,age:0,travel:0,normal:event.normal?.clone()||direction.clone().negate()});
    lastShot={id:serial,origin:origin.toArray(),end:end.toArray(),direction:direction.toArray(),distance,targetType:event.targetType,obstructed:event.obstructed||false};
    if(distance<.03){impact(shot);releaseFlight(shot);}else flights.push(shot);
  }
  function update(dt){
    for(let i=flights.length-1;i>=0;i--){const s=flights[i];s.age+=dt;s.travel=Math.min(s.distance,s.age*SPEED);
      s.group.position.copy(s.origin).addScaledVector(s.direction,s.travel);
      s.bolt.visible=true;s.bolt.scale.z=Math.min(1,s.travel/.8);
      const tail=Math.min(2.1,Math.max(0,s.travel-.65));s.trail.visible=tail>.01;s.trail.scale.z=tail;s.trail.position.z=.65+tail/2;
      s.trail.material.opacity=.33*(1-.16*Math.sin(s.age*90));
      if(s.travel>=s.distance){impact(s);releaseFlight(s);flights.splice(i,1);}
    }
    for(let i=bursts.length-1;i>=0;i--){const b=bursts[i];b.age+=dt;
      for(const p of b.particles){p.velocity.y-=dt*4.5;p.mesh.position.addScaledVector(p.velocity,dt);p.mesh.rotation.x+=dt*p.spin;p.mesh.rotation.z+=dt*p.spin*.4;p.mesh.material.opacity=Math.max(0,1-b.age/b.life);p.mesh.scale.setScalar(1+b.age*.25);}
      if(b.age>=b.life){releaseBurst(b);bursts.splice(i,1);}
    }
  }
  function reset(){while(flights.length)releaseFlight(flights.pop());while(bursts.length)releaseBurst(bursts.pop());lastShot=null;serial=0;}
  function getState(){return {source:'Blender ion-bolt.glb / impact-shards.glb',speed:SPEED,activeBolts:flights.length,activeImpacts:bursts.length,maxBolts:MAX_SHOTS,maxImpacts:MAX_BURSTS,lastShot,
    bolts:flights.map(s=>({id:s.id,origin:s.origin.toArray(),position:s.group.position.toArray(),end:s.end.toArray(),distance:s.distance,travel:s.travel,age:s.age}))};}
  return {fire,update,reset,getState,root};
}
