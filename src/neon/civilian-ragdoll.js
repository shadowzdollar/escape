import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const UNIT=new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5));
const MASS={pelvis:12,torso:24,head:5,upperArmL:2.5,upperArmR:2.5,forearmL:1.5,forearmR:1.5,thighL:6.5,thighR:6.5,shinL:3,shinR:3};
const profiles=new WeakMap();
const cv=v=>new CANNON.Vec3(v.x,v.y,v.z);

function clothMaterial(world,cityMaterial){
  if(profiles.has(world))return profiles.get(world);
  const cloth=new CANNON.Material('civilian cloth and body');
  for(const other of [cloth,cityMaterial].filter(Boolean))world.addContactMaterial(new CANNON.ContactMaterial(cloth,other,{
    friction:.64,restitution:.015,contactEquationStiffness:1e7,contactEquationRelaxation:5,frictionEquationStiffness:1e7,frictionEquationRelaxation:5
  }));
  profiles.set(world,cloth);return cloth;
}

function segment(piece){
  if(piece.umbrella)return'umbrella';
  const side=piece.x<0?'L':'R';
  if(piece.motion===1||piece.motion===2)return(piece.y>.57?'thigh':'shin')+(piece.motion===1?'L':'R');
  if(piece.motion===3||piece.motion===4)return(piece.y>1.15?'upperArm':'forearm')+(piece.motion===3?'L':'R');
  if(Math.abs(piece.x)>=.255&&piece.y>=1.2&&piece.y<1.5)return'upperArm'+side;
  if(piece.y>=1.45)return'head';
  return piece.y<.98?'pelvis':'torso';
}

// Cannon's hinge constrains two angular axes but has no built-in lower/upper
// stop. A one-sided cone equation around an offset reference supplies that stop
// while the hinge preserves the actual elbow/knee bending plane.
class LimitedHinge extends CANNON.HingeConstraint {
  constructor(a,b,options,lower,upper){
    super(a,b,options);
    this.lower=lower;this.upper=upper;
    this.referenceA=new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(1,0,0),(lower+upper)/2).vmult(new CANNON.Vec3(0,1,0));
    this.referenceB=new CANNON.Vec3(0,1,0);
    const limit=new CANNON.RotationalEquation(a,b,{maxForce:options.maxForce});limit.maxAngle=(upper-lower)/2;
    limit.minForce=-options.maxForce;limit.maxForce=0;this.limitEquation=limit;this.equations.push(limit);
  }
  update(){super.update();this.bodyA.vectorToWorldFrame(this.referenceA,this.limitEquation.axisA);this.bodyB.vectorToWorldFrame(this.referenceB,this.limitEquation.axisB);}
}

/** Articulated physical pose captured from the currently rendered voxel parts.
 * Owns bodies/joints, never steps the shared Cannon world or animates live people.
 */
export function createCivilianRagdoll({world,material,parts,yaw=0,scale=1,id,direction={x:0,y:0,z:0},cause='gun',speed=0,
  collisionGroup=4,groundHeightAt=()=>.057,jointPositions,segmentOrientations}) {
  const records=[],joints=[],groups=new Map(),bodyRecords=[],cloth=clothMaterial(world,material);
  const orientation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),inverseOrientation=orientation.clone().invert();
  const rotation=new THREE.Matrix4().makeRotationFromQuaternion(inverseOrientation),tempBox=new THREE.Box3();
  let age=0,quietTime=0,filteredEnergy=0,simplified=false,disposed=false,correctionCount=0;
  let quietPose=null,restDrift=false;
  const horizontalSpeed=cause==='vehicle'?Math.min(21,Math.max(0,Math.abs(speed))*.83):.38;
  const verticalSpeed=cause==='vehicle'?Math.min(1.8,.35+Math.abs(speed)*.055):0;
  const length=Math.hypot(direction.x||0,direction.z||0),dx=length?(direction.x||0)/length:0,dz=length?(direction.z||0)/length:1;
  for(const part of parts){const key=segment(part.piece);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(part);}
  const totalWeight=[...groups.keys()].reduce((sum,key)=>sum+(MASS[key]||0),0)||68;
  // Put the pelvis/root first for backwards-compatible debug consumers.
  const keys=[...groups.keys()].sort((a,b)=>(a==='pelvis'?-2:a==='torso'?-1:0)-(b==='pelvis'?-2:b==='torso'?-1:0));
  for(const key of keys){
    const segmentOrientation=segmentOrientations?.[key]?new THREE.Quaternion().copy(segmentOrientations[key]):orientation;
    rotation.makeRotationFromQuaternion(segmentOrientation.clone().invert());
    const members=groups.get(key),bounds=new THREE.Box3();
    for(const part of members)bounds.union(tempBox.copy(UNIT).applyMatrix4(part.matrix.clone().premultiply(rotation)));
    const localCenter=bounds.getCenter(new THREE.Vector3()),center=localCenter.clone().applyQuaternion(segmentOrientation),size=bounds.getSize(new THREE.Vector3());
    const umbrella=key==='umbrella',mass=umbrella?2.1:68*(MASS[key]||1)/totalWeight;
    const body=new CANNON.Body({mass,material:cloth,linearDamping:umbrella?.22:.12,angularDamping:umbrella?.25:.35,
      allowSleep:true,sleepSpeedLimit:.16,sleepTimeLimit:umbrella?1.7:Infinity,collisionFilterGroup:collisionGroup,collisionFilterMask:~collisionGroup});
    body.position.copy(cv(center));body.quaternion.set(segmentOrientation.x,segmentOrientation.y,segmentOrientation.z,segmentOrientation.w);
    if(umbrella){
      // The pole and canopy stay one dropped object; neither collides with its
      // own person's limbs, so the canopy cannot suspend a corpse in midair.
      const sections=new Map();
      for(const part of members){const name=part.piece.sy>.5?'pole':'canopy';if(!sections.has(name))sections.set(name,new THREE.Box3());sections.get(name).union(tempBox.copy(UNIT).applyMatrix4(part.matrix.clone().premultiply(rotation)));}
      for(const box of sections.values()){const s=box.getSize(new THREE.Vector3()),offset=box.getCenter(new THREE.Vector3()).sub(localCenter);body.addShape(new CANNON.Box(new CANNON.Vec3(Math.max(.02,s.x/2),Math.max(.02,s.y/2),Math.max(.02,s.z/2))),cv(offset));}
    }else if(key.startsWith('shin')){
      // Gait keeps boots level while the calf bends. One enclosing rotated box
      // would project an invisible corner through the road at the handoff.
      const calf=new THREE.Box3(),frame=new THREE.Matrix4().compose(center,segmentOrientation,new THREE.Vector3(1,1,1)).invert();
      for(const part of members){
        if(part.piece.y>=.3){calf.union(tempBox.copy(UNIT).applyMatrix4(part.matrix.clone().premultiply(rotation)));continue;}
        const offset=new THREE.Vector3(),quaternion=new THREE.Quaternion(),dimensions=new THREE.Vector3();part.matrix.clone().premultiply(frame).decompose(offset,quaternion,dimensions);
        body.addShape(new CANNON.Box(new CANNON.Vec3(dimensions.x/2,dimensions.y/2,dimensions.z/2)),cv(offset),new CANNON.Quaternion(quaternion.x,quaternion.y,quaternion.z,quaternion.w));
      }
      if(!calf.isEmpty()){const dimensions=calf.getSize(new THREE.Vector3()),offset=calf.getCenter(new THREE.Vector3()).sub(localCenter);body.addShape(new CANNON.Box(new CANNON.Vec3(dimensions.x/2,dimensions.y/2,dimensions.z/2)),cv(offset));}
    }else body.addShape(new CANNON.Box(new CANNON.Vec3(Math.max(.025,size.x/2),Math.max(.025,size.y/2),Math.max(.025,size.z/2))));
    const transform=new THREE.Matrix4().compose(center,segmentOrientation,new THREE.Vector3(1,1,1)).invert();
    const record={name:key,body,umbrella,frozen:false,members:members.map(part=>({part,local:part.matrix.clone().premultiply(transform)}))};
    body.userData={type:'civilian-ragdoll',civilianId:id,segment:key};
    body.velocity.set(dx*horizontalSpeed,umbrella?verticalSpeed+.35:verticalSpeed,dz*horizontalSpeed);
    body.angularVelocity.set(dz*(umbrella?.8:.45),umbrella?.5:0,-dx*(umbrella?.8:.45));
    records.push(record);if(!umbrella)bodyRecords.push(record);world.addBody(body);
  }
  const byName=new Map(records.map(record=>[record.name,record]));
  const root=byName.get('pelvis')||byName.get('torso')||bodyRecords[0];
  // The source's root transform is reconstructed from its authored part center.
  // This retains current stride translations instead of resetting the figure.
  const reference=parts.find(p=>p.piece.motion===0&&!p.piece.umbrella)||parts.find(p=>!p.piece.umbrella);
  const origin=new THREE.Vector3().setFromMatrixPosition(reference.matrix).sub(new THREE.Vector3(reference.piece.x*scale,(reference.piece.y-.145)*scale,reference.piece.z*scale).applyQuaternion(orientation));
  function joint(name,parentName,childName,position,{angle=.65,twist=.25,hinge}={}){
    const child=byName.get(childName),parent=byName.get(parentName)||root;if(!parent||!child||child===parent)return;
    const captured=jointPositions?.[name];
    const worldPivot=captured?new THREE.Vector3(captured.x,captured.y,captured.z):new THREE.Vector3(position[0]*scale,(position[1]-.145)*scale,position[2]*scale).applyQuaternion(orientation).add(origin);
    const pivotA=parent.body.pointToLocalFrame(cv(worldPivot)),pivotB=child.body.pointToLocalFrame(cv(worldPivot));
    const options={pivotA,pivotB,collideConnected:false,maxForce:5e4,axisA:new CANNON.Vec3(hinge?1:0,hinge?0:1,0),axisB:new CANNON.Vec3(hinge?1:0,hinge?0:1,0),angle,twistAngle:twist};
    const constraint=hinge?new LimitedHinge(parent.body,child.body,options,...hinge):new CANNON.ConeTwistConstraint(parent.body,child.body,options);
    constraint.name=name;constraint.ragdollLimits=hinge?{type:'hinge',lower:hinge[0],upper:hinge[1]}:{type:'cone-twist',cone:angle,twist};
    for(const equation of constraint.equations)equation.setSpookParams(1e7,5,1/60);
    joints.push(constraint);world.addConstraint(constraint);
  }
  joint('waist','pelvis','torso',[0,.97,0],{angle:.35,twist:.3});
  joint('neck','torso','head',[0,1.47,0],{angle:.55,twist:.6});
  for(const [suffix,sign] of [['L',-1],['R',1]]){
    joint('shoulder'+suffix,'torso','upperArm'+suffix,[sign*.235,1.39,0],{angle:1.25,twist:.65});
    joint('elbow'+suffix,'upperArm'+suffix,'forearm'+suffix,[sign*.33,1.145,0],{hinge:[-1.75,.10]});
    joint('hip'+suffix,'pelvis','thigh'+suffix,[sign*.135,.81,0],{angle:1.2,twist:.38});
    joint('knee'+suffix,'thigh'+suffix,'shin'+suffix,[sign*.135,.565,0],{hinge:[-.10,1.65]});
  }
  const relativeSpin=new CANNON.Vec3();
  function dampJoints(){
    if(simplified||disposed)return;
    // Passive viscous resistance at anatomical joints damps dangling limbs.
    // Opposite torques preserve the assembly's shared angular momentum. Apply
    // before integration on each actual fixed physics step, not each render.
    for(const joint of joints){
      const a=joint.bodyA,b=joint.bodyB;if(a.sleepState===CANNON.Body.SLEEPING&&b.sleepState===CANNON.Body.SLEEPING)continue;
      b.angularVelocity.vsub(a.angularVelocity,relativeSpin);
      const coefficient=joint.name.startsWith('hip')||joint.name==='waist'?.075:joint.name==='neck'?.025:.035;
      const magnitude=relativeSpin.length(),factor=magnitude?Math.min(coefficient,.25/magnitude):0;
      a.torque.addScaledVector(factor,relativeSpin,a.torque);b.torque.addScaledVector(-factor,relativeSpin,b.torque);
    }
  }
  world.addEventListener('preStep',dampJoints);
  function wake(){quietTime=0;quietPose=null;filteredEnergy=0;for(const record of records)record.body.wakeUp();}
  const listeners=[];
  function listen(record){
    const listener=event=>{if(event.body.velocity.lengthSquared()>.04||event.body.angularVelocity.lengthSquared()>.09)wake();};
    record.body.addEventListener('collide',listener);listeners.push([record.body,listener]);
  }
  records.forEach(listen);
  function centerOfMass(){const position=new CANNON.Vec3(),velocity=new CANNON.Vec3();let total=0;for(const record of bodyRecords){const mass=record.body.mass||MASS[record.name]||1;total+=mass;position.addScaledVector(mass,record.body.position,position);velocity.addScaledVector(mass,record.body.velocity,velocity);}position.scale(1/total,position);velocity.scale(1/total,velocity);return{position,velocity};}
  function recordBounds(record){const transform=new THREE.Matrix4().compose(new THREE.Vector3(...record.body.position.toArray()),new THREE.Quaternion(...record.body.quaternion.toArray()),new THREE.Vector3(1,1,1)),bounds=new THREE.Box3();for(const member of record.members)bounds.union(tempBox.copy(UNIT).applyMatrix4(new THREE.Matrix4().multiplyMatrices(transform,member.local)));return bounds;}
  function update(dt){
    if(disposed)return;const step=Math.max(0,dt);age+=step;
    const com=centerOfMass(),upLimit=cause==='vehicle'?3.2:6;
    // A position-driven kinematic car has effectively infinite corrective
    // energy. Remove only excess *shared* upward momentum; relative limb motion
    // and joints remain physical. No second collision impulse is injected.
    if(com.velocity.y>upLimit){const excess=com.velocity.y-upLimit;for(const record of bodyRecords)record.body.velocity.y-=excess;correctionCount++;}
    for(const record of records){const b=record.body,speed=b.velocity.length(),spin=b.angularVelocity.length();if(speed>28)b.velocity.scale(28/speed,b.velocity);if(spin>18)b.angularVelocity.scale(18/spin,b.angularVelocity);}
    const awake=bodyRecords.some(r=>r.body.sleepState===CANNON.Body.AWAKE),sleeping=bodyRecords.some(r=>r.body.sleepState===CANNON.Body.SLEEPING);
    if(awake&&sleeping)for(const record of bodyRecords)record.body.wakeUp();
    // Sleep the assembly as a unit. The coarse voxel contacts can produce a
    // brief light-limb angular spike without meaningful motion; per-body Cannon
    // sleep timers otherwise restart forever. Filter mass-weighted energy, but
    // also require actual limb transforms to stay within a small resting window.
    const energy=bodyRecords.reduce((sum,r)=>sum+r.body.mass*(r.body.velocity.lengthSquared()+.08*r.body.angularVelocity.lengthSquared()),0)/68;
    filteredEnergy+=(energy-filteredEnergy)*(1-Math.exp(-step*6));
    const calm=filteredEnergy<.008&&com.velocity.lengthSquared()<.0064&&bodyRecords.every(r=>r.body.velocity.lengthSquared()<.5&&r.body.angularVelocity.lengthSquared()<4);
    if(!quietPose)quietPose=bodyRecords.map(r=>({position:r.body.position.clone(),quaternion:r.body.quaternion.clone()}));
    const drift=bodyRecords.some((r,i)=>{const q=r.body.quaternion,p=quietPose[i].quaternion;return r.body.position.distanceTo(quietPose[i].position)>.035||2*Math.acos(Math.min(1,Math.abs(q.x*p.x+q.y*p.y+q.z*p.z+q.w*p.w)))>.14;});
    restDrift=drift;
    if(!calm||drift){quietTime=Math.max(0,quietTime-step*3);if(!quietTime)quietPose=null;}
    else quietTime=Math.min(2,quietTime+step);
    if(quietTime>1.8)for(const record of bodyRecords)record.body.sleep();
  }
  function removeJoints(){for(const constraint of joints)world.removeConstraint(constraint);}
  function simplify(){
    if(simplified||disposed)return;simplified=true;removeJoints();
    const com=centerOfMass(),wasSleeping=bodyRecords.every(r=>r.body.sleepState===CANNON.Body.SLEEPING);
    const body=new CANNON.Body({mass:68,material:cloth,linearDamping:.12,angularDamping:.35,allowSleep:true,sleepSpeedLimit:.16,sleepTimeLimit:Infinity});
    body.position.copy(com.position);body.velocity.copy(com.velocity);
    const members=[],momentum=new CANNON.Vec3(),offset=new CANNON.Vec3(),relative=new CANNON.Vec3();
    for(const record of bodyRecords){
      const b=record.body,transform=new THREE.Matrix4().compose(new THREE.Vector3(...b.position.toArray()),new THREE.Quaternion(...b.quaternion.toArray()),new THREE.Vector3(1,1,1));
      for(const member of record.members)members.push({part:member.part,local:new THREE.Matrix4().makeTranslation(-com.position.x,-com.position.y,-com.position.z).multiply(transform).multiply(member.local)});
      b.position.vsub(com.position,offset);
      for(let i=0;i<b.shapes.length;i++){const localOffset=b.quaternion.vmult(b.shapeOffsets[i]);localOffset.vadd(offset,localOffset);body.addShape(b.shapes[i],localOffset,b.quaternion.mult(b.shapeOrientations[i]));}
      // Preserve spin and orbital momentum using Cannon's box-inertia proxy.
      // The replacement compound also uses Cannon's approximate AABB inertia.
      const spin=b.quaternion.conjugate().vmult(b.angularVelocity);spin.x*=b.inertia.x;spin.y*=b.inertia.y;spin.z*=b.inertia.z;b.quaternion.vmult(spin,spin);momentum.vadd(spin,momentum);
      b.velocity.vsub(com.velocity,relative);relative.scale(b.mass,relative);offset.cross(relative,relative);momentum.vadd(relative,momentum);
      world.removeBody(b);
      const index=listeners.findIndex(pair=>pair[0]===b);if(index>=0){b.removeEventListener('collide',listeners[index][1]);listeners.splice(index,1);}
    }
    body.angularVelocity.set(momentum.x*body.invInertia.x,momentum.y*body.invInertia.y,momentum.z*body.invInertia.z);
    body.userData={type:'civilian-ragdoll',civilianId:id,segment:'retired-compound'};
    const record={name:'retired-compound',body,umbrella:false,frozen:false,members};
    const umbrellas=records.filter(r=>r.umbrella);for(const r of umbrellas){r.body.collisionFilterGroup=1;r.body.collisionFilterMask=-1;}
    records.splice(0,records.length,record,...umbrellas);bodyRecords.splice(0,bodyRecords.length,record);world.addBody(body);listen(record);
    quietTime=0;quietPose=null;filteredEnergy=0;if(wasSleeping)body.sleep();
  }
  function impulse(direction,point,strength=45){
    if(disposed)return false;let nearest=bodyRecords[0],distance=Infinity;
    for(const record of bodyRecords){const d=recordBounds(record).distanceToPoint(point);if(d<distance){distance=d;nearest=record;}}
    wake();const b=nearest.body,limit=Math.min(Math.max(0,strength),b.mass*2.4),magnitude=Math.hypot(direction.x,direction.y,direction.z)||1;
    b.applyImpulse(new CANNON.Vec3(direction.x/magnitude*limit,direction.y/magnitude*limit,direction.z/magnitude*limit),new CANNON.Vec3(point.x-b.position.x,point.y-b.position.y,point.z-b.position.z));return true;
  }
  function getState(){const com=centerOfMass();let maxJointError=0;if(!simplified)for(const joint of joints)maxJointError=Math.max(maxJointError,joint.bodyA.pointToWorldFrame(joint.pivotA).distanceTo(joint.bodyB.pointToWorldFrame(joint.pivotB)));return{articulated:!simplified,simplified,segments:bodyRecords.length,joints:simplified?0:joints.length,maxJointError,position:com.position,velocity:com.velocity,speed:com.velocity.length(),sleeping:bodyRecords.every(r=>r.body.sleepState===CANNON.Body.SLEEPING),rest:{quietSeconds:quietTime,filteredEnergy,poseStable:!restDrift},frozen:false,correctionCount};}
  function dispose(){if(disposed)return;disposed=true;removeJoints();world.removeEventListener('preStep',dampJoints);for(const [body,listener] of listeners)body.removeEventListener('collide',listener);for(const record of records)world.removeBody(record.body);}
  return{records,joints,collisionGroup,update,simplify,impulse,getState,dispose,get articulated(){return!simplified;},get simplified(){return simplified;}};
}
