import * as THREE from 'three';
import { createCivilianRagdoll } from './civilian-ragdoll.js';
import { createCivilianMotion } from './civilian-motion.js';
import { createCivilianNavigation, civilianBodyRadius } from './civilian-navigation.js';

const UNIT_BOX = new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5));
const clamp = THREE.MathUtils.clamp;

function boundsFromMatrix(box,matrix) {
  const e=matrix.elements,rx=(Math.abs(e[0])+Math.abs(e[4])+Math.abs(e[8]))/2,ry=(Math.abs(e[1])+Math.abs(e[5])+Math.abs(e[9]))/2,rz=(Math.abs(e[2])+Math.abs(e[6])+Math.abs(e[10]))/2;
  box.min.set(e[12]-rx,e[13]-ry,e[14]-rz);box.max.set(e[12]+rx,e[13]+ry,e[14]+rz);return box;
}

/** Voxel body hit tests, civilian movement, and grounded persistent fall poses. */
export function createCivilianSystem({people,mesh,colliders=[],groundHeightAt=()=>.057,bounds}) {
  let elapsed=0;
  let physics=null;
  const physicalDeaths=[];
  const bodyTransform=new THREE.Matrix4(),bodyPosition=new THREE.Vector3(),bodyQuaternion=new THREE.Quaternion(),unitScale=new THREE.Vector3(1,1,1);
  const matrix=new THREE.Matrix4(),rotation=new THREE.Matrix4(),yawMatrix=new THREE.Matrix4();
  const pose=new THREE.Object3D(),color=new THREE.Color(),partBox=new THREE.Box3();
  const inverse=new THREE.Matrix4(),ray=new THREE.Ray(),localRay=new THREE.Ray();
  const intersection=new THREE.Vector3(),worldHit=new THREE.Vector3();
  const navigation=createCivilianNavigation({colliders,groundHeightAt,bounds});
  let spawnAudit=[];
  let instance=0;
  for(let i=0;i<people.length;i++) {
    const p=people[i];p.id=`CIV-${String(i+1).padStart(3,'0')}`;
    p.spawn={x:p.x,z:p.z,speed:p.speed};p.health=100;p.alive=true;p.fleeUntil=0;p.fleeX=0;p.fleeZ=0;
    p.groundY=groundHeightAt(p.x,p.z);p.yaw=p.speed<0?Math.PI:0;p.stride=0;
    p.lastVehicleImpact=-Infinity;p.vehicleContact=false;p.vehicleHitLocked=false;p.fall=null;p.bodyBox=new THREE.Box3();
    p.instanceStart=instance;
    p.parts=p.pieces.map(piece=>({piece,index:instance++,matrix:new THREE.Matrix4()}));
    p.crowdRadius=civilianBodyRadius(p.pieces,p.scale);
    p.gait=createCivilianMotion({scale:p.scale,phase:p.phase,groundHeightAt,umbrella:p.pieces.some(piece=>piece.umbrella)});
    for(const part of p.parts)mesh.setColorAt(part.index,color.set(part.piece.c));
  }
  mesh.instanceColor.needsUpdate=true;
  const byId=new Map(people.map(p=>[p.id,p]));

  function localPart(p,part,stride=p.stride) {
    const piece=part.piece;
    const leg=piece.motion===1?1:piece.motion===2?-1:0,arm=piece.motion===3?-1:piece.motion===4?1:0;
    const sway=(leg||arm)*stride;
    pose.position.set(piece.x*p.scale,(piece.y-.145+(leg?Math.max(0,-sway)*.035:0))*p.scale,(piece.z+leg*stride*.085+arm*stride*.045)*p.scale);
    pose.scale.set(piece.sx*p.scale,piece.sy*p.scale,piece.sz*p.scale);
    pose.rotation.set((leg*.11+arm*.16)*stride,0,0);pose.updateMatrix();
    return pose.matrix;
  }

  function renderAlive(p) {
    p.bodyBox.makeEmpty();
    for(const part of p.parts) {
      p.gait.writePartMatrix(part.piece,part.matrix);
      mesh.setMatrixAt(part.index,part.matrix);
      if(!part.piece.umbrella)p.bodyBox.union(boundsFromMatrix(partBox,part.matrix));
    }
  }

  // Body and dropped umbrella settle independently. A canopy cannot hold a
  // horizontal torso in midair; each rigid voxel assembly touches pavement.
  function fallenPose(p,progress,targetYaw,write=true) {
    const eased=progress*progress*(3-2*progress);
    const yaw=p.fall.startYaw+Math.atan2(Math.sin(targetYaw-p.fall.startYaw),Math.cos(targetYaw-p.fall.startYaw))*eased;
    yawMatrix.makeRotationY(yaw);rotation.makeRotationX(eased*Math.PI/2);matrix.multiplyMatrices(yawMatrix,rotation);
    let bodyMin=Infinity,umbrellaMin=Infinity;
    const bodyBounds=new THREE.Box3(),umbrellaBounds=new THREE.Box3();
    for(const part of p.parts) {
      part.matrix.multiplyMatrices(matrix,localPart(p,part,p.fall.stride*(1-eased)));
      const e=part.matrix.elements;e[12]+=p.x;e[14]+=p.z;
      if(part.piece.umbrella){e[12]+=(Math.sin(yaw)*.4+Math.cos(yaw)*.23)*eased;e[14]+=(Math.cos(yaw)*.4-Math.sin(yaw)*.23)*eased;}
      boundsFromMatrix(partBox,part.matrix);
      if(part.piece.umbrella){umbrellaMin=Math.min(umbrellaMin,partBox.min.y);umbrellaBounds.union(partBox);}
      else {bodyMin=Math.min(bodyMin,partBox.min.y);bodyBounds.union(partBox);}
    }
    const floorFor=b=>b.isEmpty()?p.groundY:Math.max(groundHeightAt((b.min.x+b.max.x)/2,(b.min.z+b.max.z)/2),groundHeightAt(b.min.x,b.min.z),groundHeightAt(b.max.x,b.max.z),groundHeightAt(b.min.x,b.max.z),groundHeightAt(b.max.x,b.min.z));
    const bodyLift=floorFor(bodyBounds)-bodyMin,umbrellaLift=Number.isFinite(umbrellaMin)?bodyLift+(floorFor(umbrellaBounds)-umbrellaMin-bodyLift)*eased:0;
    bodyBounds.translate(new THREE.Vector3(0,bodyLift,0));
    for(const part of p.parts) {
      part.matrix.elements[13]+=part.piece.umbrella?umbrellaLift:bodyLift;
      if(write)mesh.setMatrixAt(part.index,part.matrix);
    }
    if(write)p.bodyBox.copy(bodyBounds);
    return bodyBounds;
  }

  function startFall(p,direction) {
    p.fall={time:0,duration:.78,startYaw:p.yaw,yaw:p.yaw,stride:p.stride};
    // Try the walking direction first on narrow sidewalks, then alternate
    // directions. The root stays at the impact position throughout the fall.
    const impulseYaw=direction&&Math.hypot(direction.x||0,direction.z||0)>.01?Math.atan2(direction.x,direction.z):p.yaw;
    const candidates=[p.yaw,p.yaw+Math.PI,impulseYaw,p.yaw+Math.PI/2,p.yaw-Math.PI/2];
    for(const candidate of candidates) {
      const finalBox=fallenPose(p,1,candidate,false);
      if(!navigation.boxBlocked(finalBox)){p.fall.yaw=candidate;break;}
    }
    fallenPose(p,0,p.fall.yaw);mesh.instanceMatrix.needsUpdate=true;
  }

  function attachPhysics({world,material,groundHeightAt:sampleGround=groundHeightAt}) {
    if(physics?.world===world)return;
    if(physicalDeaths.length)throw new Error('Attach civilian physics before any physical deaths');
    physics={world,material,groundHeightAt:sampleGround};
  }

  function renderRigidRecord(record,write=true) {
    const b=record.body;
    bodyPosition.set(b.position.x,b.position.y,b.position.z);bodyQuaternion.set(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w);
    bodyTransform.compose(bodyPosition,bodyQuaternion,unitScale);
    const result=new THREE.Box3();
    for(const member of record.members){
      member.part.matrix.multiplyMatrices(bodyTransform,member.local);
      result.union(partBox.copy(UNIT_BOX).applyMatrix4(member.part.matrix));
      if(write)mesh.setMatrixAt(member.part.index,member.part.matrix);
    }return result;
  }

  function startPhysicalDeath(p,direction,cause,speed) {
    const active=physicalDeaths.filter(person=>person.physical.ragdoll.articulated);
    while(active.length>=24){
      const settled=active.findIndex(person=>person.physical.ragdoll.getState().sleeping);
      active.splice(settled<0?0:settled,1)[0].physical.ragdoll.simplify();
    }
    const occupied=new Set(active.map(person=>person.physical.ragdoll.collisionGroup));let slot=0;while(occupied.has(1<<(slot+2)))slot++;
    const gait=p.gait.getState();
    const ragdoll=createCivilianRagdoll({world:physics.world,material:physics.material,parts:p.parts,yaw:p.yaw,scale:p.scale,id:p.id,
      direction,cause,speed,collisionGroup:1<<(slot+2),groundHeightAt:physics.groundHeightAt,jointPositions:gait.jointPositions,segmentOrientations:gait.segmentOrientations});
    p.physical={ragdoll,records:ragdoll.records,age:0};p.fall={time:0,duration:.78};physicalDeaths.push(p);
  }

  function updatePhysicalDeath(p,step) {
    p.physical.age+=step;p.fall.time=Math.min(p.fall.duration,p.fall.time+step);
    p.physical.ragdoll.update(step);
    // Sleeping poses stay in the instance buffer until any limb or umbrella
    // wakes. Persistent bodies should not repeat 86 matrix products every frame.
    const sleeping=p.physical.records.every(record=>record.body.sleepState===2);
    if(sleeping&&p.physical.renderedSleeping)return;
    p.physical.renderedSleeping=sleeping;p.bodyBox.makeEmpty();
    for(const record of p.physical.records){
      const bounds=renderRigidRecord(record);
      if(!record.umbrella)p.bodyBox.union(bounds);
    }
    const state=p.physical.ragdoll.getState();p.x=state.position.x;p.z=state.position.z;p.groundY=physics.groundHeightAt(p.x,p.z);
  }

  function frighten(source,direction) {
    for(const witness of people) {
      if(!witness.alive||Math.hypot(witness.x-source.x,witness.z-source.z)>17)continue;
      let dx=witness.x-source.x,dz=witness.z-source.z;
      if(Math.hypot(dx,dz)<.3){dx=direction?.x||0;dz=direction?.z||Math.sign(witness.speed)||1;}
      const length=Math.hypot(dx,dz)||1;
      witness.fleeX=dx/length;witness.fleeZ=dz/length;witness.fleeUntil=elapsed+5.5;
    }
  }

  function damage(id,amount,{direction,cause='gun',speed=0}={}) {
    const p=byId.get(id);
    if(!p?.alive||!Number.isFinite(amount)||amount<=0)return {hit:false,killed:false};
    p.health=Math.max(0,p.health-amount);p.lastCause=cause;p.lastImpactSpeed=speed;
    const killed=p.health===0;
    frighten(p,direction);
    if(killed){p.alive=false;p.fleeUntil=0;if(physics)startPhysicalDeath(p,direction,cause,speed);else startFall(p,direction);}
    return {hit:true,killed};
  }

  function raycast(origin,direction,maxDistance=200) {
    if(!Number.isFinite(maxDistance)||maxDistance<=0)return null;
    ray.set(origin,direction);let nearest=null,best=maxDistance;
    for(const p of people) {
      if((!p.alive&&!p.physical)||!ray.intersectsBox(p.bodyBox))continue;
      for(const part of p.parts) {
        if(part.piece.umbrella)continue;
        inverse.copy(part.matrix).invert();localRay.copy(ray).applyMatrix4(inverse);
        if(!localRay.intersectBox(UNIT_BOX,intersection))continue;
        worldHit.copy(intersection).applyMatrix4(part.matrix);
        const distance=origin.distanceTo(worldHit);
        if(distance<best){best=distance;nearest={id:p.id,distance,point:worldHit.clone(),corpse:!p.alive};}
      }
    }
    return nearest;
  }

  function impulse(id,direction,point,strength=45){
    return byId.get(id)?.physical?.ragdoll.impulse(direction,point,strength)??false;
  }

  function vehicleImpact(from,to,{yaw=0,speed=0,halfWidth=1.45,halfLength=2.64}={}) {
    const magnitude=Math.abs(speed),c=Math.cos(yaw),s=Math.sin(yaw),results=[];
    if(![from.x,from.z,to.x,to.z,yaw,magnitude,halfWidth,halfLength].every(Number.isFinite))return results;
    for(const p of people) {
      if(!p.alive)continue;
      let contact=false,entry=null;
      // The four slab axes include the vehicle's side/end axes and the body's
      // voxel axes. This is a swept OBB test, not a broad circle approximation.
      for(const part of p.parts) {
        if(part.piece.umbrella)continue;
        boundsFromMatrix(partBox,part.matrix);
        const vehicleFloor=Math.min(from.y||p.groundY,to.y||p.groundY);
        if(partBox.min.y>vehicleFloor+1.55||partBox.max.y<vehicleFloor-.15)continue;
        const e=part.matrix.elements,px=e[12],pz=e[14];
        let enter=0,leave=1,partContact=true;
        for(const [ax,az] of [[c,-s],[s,c],[e[0],e[2]],[e[8],e[10]]]) {
          if(Math.hypot(ax,az)<1e-9)continue;
          const extent=(Math.abs(ax*e[0]+az*e[2])+Math.abs(ax*e[4]+az*e[6])+Math.abs(ax*e[8]+az*e[10]))/2+halfWidth*Math.abs(ax*c-az*s)+halfLength*Math.abs(ax*s+az*c);
          const a=(from.x-px)*ax+(from.z-pz)*az,b=(to.x-px)*ax+(to.z-pz)*az,d=b-a;
          if(Math.abs(b)>extent)partContact=false;
          if(Math.abs(d)<1e-10){if(Math.abs(a)>extent){enter=2;break;}continue;}
          const t1=(-extent-a)/d,t2=(extent-a)/d;
          enter=Math.max(enter,Math.min(t1,t2));leave=Math.min(leave,Math.max(t1,t2));
          if(enter>leave)break;
        }
        if(partContact&&enter<=leave)contact=true;
        if(enter<=leave&&(entry===null||enter<entry))entry=enter;
      }
      const locked=p.vehicleHitLocked;p.vehicleContact=contact;if(!contact)p.vehicleHitLocked=false;
      if(entry===null||magnitude<4||locked||elapsed-p.lastVehicleImpact<1.2)continue;
      p.lastVehicleImpact=elapsed;
      p.vehicleHitLocked=contact;
      const amount=magnitude>=9?100:Math.round(30+(magnitude-4)*12);
      const direction=new THREE.Vector3(to.x-from.x,0,to.z-from.z).normalize();
      const outcome=damage(p.id,amount,{direction,cause:'vehicle',speed:magnitude});
      if(outcome.hit)results.push({id:p.id,damage:amount,killed:outcome.killed,point:new THREE.Vector3(p.x,p.groundY+.7*p.scale,p.z)});
    }
    return results;
  }

  function update(dt,time,playerPosition) {
    navigation.beginFrame();
    elapsed+=Math.max(0,dt);
    const step=Math.min(.1,Math.max(0,dt));
    for(const p of people){
      if(!p.alive)continue;
      const fleeing=p.fleeUntil>elapsed,paused=!fleeing&&playerPosition&&Math.hypot(p.x-playerPosition.x,p.z-playerPosition.z)<1.7,factor=p.health<100?.78:1;
      // Reverse route intent once at an endpoint. The gait may still coast
      // outward while braking; that residual motion must not flip intent again.
      if(!fleeing&&((p.speed>0&&p.z>=p.maxZ-1e-7)||(p.speed<0&&p.z<=p.minZ+1e-7))){p.speed*=-1;p.turnCooldown=1;}
      p.intentVX=(fleeing?p.fleeX*2.6:0)*factor;p.intentVZ=(fleeing?p.fleeZ*2.6:paused?0:p.speed)*factor;
    }
    navigation.beginCrowd(people);
    for(const p of people) {
      if(!p.alive) {
        if(p.physical)updatePhysicalDeath(p,step);
        else if(p.fall.time<p.fall.duration){p.fall.time=Math.min(p.fall.duration,p.fall.time+step);fallenPose(p,p.fall.time/p.fall.duration,p.fall.yaw);}
        continue;
      }
      const fleeing=p.fleeUntil>elapsed,paused=!fleeing&&playerPosition&&Math.hypot(p.x-playerPosition.x,p.z-playerPosition.z)<1.7;
      const crowd=navigation.steerCrowd(p,p.intentVX,p.intentVZ);p.crowdMode=crowd.mode;
      p.crowdTurnCooldown=Math.max(0,(p.crowdTurnCooldown||0)-step);
      if(crowd.mode==='reverse'&&p.crowdTurnCooldown===0){if(fleeing){p.fleeX*=-1;p.fleeZ*=-1;}else p.speed*=-1;p.crowdTurnCooldown=1;}
      const plan=p.gait.plan(step,{vx:crowd.vx,vz:crowd.vz,fleeing}),routeDZ=fleeing?plan.dz:clamp(p.z+plan.dz,p.minZ,p.maxZ)-p.z;
      const movement=navigation.move(p,plan.dx,routeDZ),moved=movement.distance>1e-8;
      p.acceptedVX=step?movement.dx/step:0;p.acceptedVZ=step?movement.dz/step:0;
      p.turnCooldown=Math.max(0,(p.turnCooldown||0)-step);
      const intent=Math.hypot(plan.dx,routeDZ);
      if(!fleeing&&!paused&&crowd.mode==='walk'&&intent>.0005&&movement.distance<intent*.15&&p.turnCooldown===0){p.speed*=-1;p.turnCooldown=1;}
      // Blocked witnesses follow their clear sidewalk instead of clipping walls.
      if(fleeing&&crowd.mode==='walk'&&!moved&&intent>.0005&&p.turnCooldown===0){
        const sign=Math.sign(p.speed)||1,r=.44*p.scale,h=1.85*p.scale;
        const directions=[[0,sign],[0,-sign],[1,0],[-1,0]];
        const clear=directions.find(([x,z])=>!navigation.blocked(p.x+x*.35,p.z+z*.35,r,h));
        p.fleeX=clear?.[0]||0;p.fleeZ=clear?.[1]||0;p.turnCooldown=.5;
      }
      p.groundY=groundHeightAt(p.x,p.z);const gait=p.gait.update(step,{x:p.x,z:p.z,groundY:p.groundY,fleeing});p.yaw=gait.yaw;p.stride=Math.sin(gait.phase*Math.PI*2)*gait.blend;
      renderAlive(p);
    }
    mesh.instanceMatrix.needsUpdate=true;
  }

  function resolveSpawns(){
    const occupied=[];
    for(const p of people){
      if(!p.alive)continue;
      const before={x:p.x,z:p.z},result=navigation.resolveSpawn(p,occupied);
      p.x=result.x;p.z=result.z;occupied.push({x:p.x,z:p.z,radius:p.crowdRadius});
      if(result.distance>0||!result.resolved)spawnAudit.push({id:p.id,before,x:p.x,z:p.z,distance:result.distance,resolved:result.resolved,bodyRadius:p.crowdRadius});
      p.groundY=groundHeightAt(p.x,p.z);p.gait.reset({x:p.x,z:p.z,yaw:p.yaw,groundY:p.groundY});renderAlive(p);
    }
    mesh.instanceMatrix.needsUpdate=true;
  }
  function refreshObstacles({resolveSpawns:resolve=false}={}){navigation.beginFrame();if(resolve)resolveSpawns();}
  function setObstacleProvider(callback,{resolveSpawns:resolve=true}={}){navigation.setObstacleProvider(callback);if(resolve)resolveSpawns();}
  function reset() {
    elapsed=0;spawnAudit=[];navigation.beginFrame();
    for(const person of physicalDeaths)person.physical.ragdoll.dispose();
    physicalDeaths.length=0;
    for(const p of people) {
      Object.assign(p,p.spawn,{health:100,alive:true,fall:null,physical:null,fleeUntil:0,fleeX:0,fleeZ:0,lastVehicleImpact:-Infinity,vehicleContact:false,vehicleHitLocked:false,lastCause:null,lastImpactSpeed:0,turnCooldown:0,crowdTurnCooldown:0,acceptedVX:0,acceptedVZ:0,intentVX:0,intentVZ:0,crowdMode:'idle'});
      p.yaw=p.speed<0?Math.PI:0;p.stride=0;
    }
    resolveSpawns();
  }

  function getPeople() {
    return people.map(p=>{const state=p.physical?.ragdoll.getState();return{id:p.id,x:p.x,y:state?state.position.y:p.groundY,z:p.z,groundY:p.groundY,scale:p.scale,yaw:p.yaw,health:p.health,alive:p.alive,injured:p.alive&&p.health<100,fleeing:p.alive&&p.fleeUntil>elapsed,fallProgress:p.fall?p.fall.time/p.fall.duration:0,physical:Boolean(p.physical),physics:state?{...state,velocity:{...state.velocity},position:{...state.position}}:null,instanceStart:p.instanceStart,instanceCount:p.parts.length,vehicleCooldown:Math.max(0,1.2-(elapsed-p.lastVehicleImpact)),cause:p.lastCause||null,aimPoint:{x:p.x,y:p.groundY+1.12*p.scale,z:p.z},bodyBounds:{min:{x:p.bodyBox.min.x,y:p.bodyBox.min.y,z:p.bodyBox.min.z},max:{x:p.bodyBox.max.x,y:p.bodyBox.max.y,z:p.bodyBox.max.z}}};});
  }
  function needsArticulatedSolver(){return physicalDeaths.some(p=>p.physical.ragdoll.articulated&&p.physical.records.some(r=>!r.umbrella&&r.body.sleepState!==2));}
  function getState() {
    const alive=people.filter(p=>p.alive).length;
    return {total:people.length,alive,dead:people.length-alive,injured:people.filter(p=>p.alive&&p.health<100).length,fleeing:people.filter(p=>p.alive&&p.fleeUntil>elapsed).length,physicalCorpses:physicalDeaths.length,activeRagdolls:physicalDeaths.filter(p=>p.physical.ragdoll.articulated).length,simplifiedCorpses:physicalDeaths.filter(p=>p.physical.ragdoll.simplified).length,ragdollJoints:physicalDeaths.reduce((n,p)=>n+(p.physical.ragdoll.articulated?p.physical.ragdoll.joints.length:0),0),activeCorpseBodies:physicalDeaths.reduce((n,p)=>n+p.physical.records.length,0),time:elapsed};
  }
  function getColliders(){
    return people.map(p=>({id:p.id,civilian:true,alive:p.alive,dynamic:Boolean(p.physical),x:(p.bodyBox.min.x+p.bodyBox.max.x)/2,y:(p.bodyBox.min.y+p.bodyBox.max.y)/2,z:(p.bodyBox.min.z+p.bodyBox.max.z)/2,
      sx:p.bodyBox.max.x-p.bodyBox.min.x,sy:p.bodyBox.max.y-p.bodyBox.min.y,sz:p.bodyBox.max.z-p.bodyBox.min.z}));
  }
  reset();
  return {mesh,update,raycast,damage,vehicleImpact,reset,getState,getPeople,getColliders,attachPhysics,impulse,needsArticulatedSolver,setObstacleProvider,refreshObstacles,getNavigationState:()=>({...navigation.getState(),spawnCorrections:spawnAudit})};
}
