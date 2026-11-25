import * as CANNON from 'cannon-es';

const controllers=new WeakMap(),ZERO={x:0,y:0,z:0};
const finiteVector=v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);

/** One controller per world for explicitly accepted, application-driven poses.
 * Cannon sees their real linear/angular velocity while solving contacts, but
 * must not integrate a second displacement past the already accepted pose.
 * Unregistered bodies, including dynamic wrecks, retain normal simulation.
 */
export function getKinematicPoseController(world){
  if(controllers.has(world))return controllers.get(world);
  const records=new Map();let disposed=false;
  function restoreSleepThreshold(record){
    if(record.sleepSpeedLimit===null)return;
    record.body.sleepSpeedLimit=record.sleepSpeedLimit;record.sleepSpeedLimit=null;
  }
  function unregister(body){
    const record=records.get(body);if(!record)return false;
    restoreSleepThreshold(record);return records.delete(body);
  }
  function copyPose(record){
    const body=record.body;body.position.copy(record.position);body.quaternion.copy(record.quaternion);body.aabbNeedsUpdate=true;
  }
  function each(callback){
    for(const [body,record] of records){
      if(body.type!==CANNON.Body.KINEMATIC||body.world!==world){unregister(body);continue;}
      callback(record);
    }
  }
  // cannon-es emits preStep after solving contacts, immediately before body
  // integration. postStep runs after integration, before another internal step.
  function beforeIntegration(){each(({body})=>{body.velocity.setZero();body.angularVelocity.setZero();});}
  function afterIntegration(){each(record=>{copyPose(record);record.body.velocity.copy(record.velocity);record.body.angularVelocity.copy(record.angularVelocity);});}
  function afterRemoval(event){unregister(event.body);}
  world.addEventListener('preStep',beforeIntegration);world.addEventListener('postStep',afterIntegration);
  world.addEventListener('removeBody',afterRemoval);
  function setTarget(body,{position=body.position,quaternion=body.quaternion,velocity=ZERO,angularVelocity=ZERO}={}){
    if(disposed)throw new Error('Kinematic pose controller has been disposed');
    if(body.type!==CANNON.Body.KINEMATIC){unregister(body);return false;}
    if(body.world!==world){unregister(body);throw new Error('Register a kinematic body only after adding it to its world');}
    if(!finiteVector(position)||!finiteVector(velocity)||!finiteVector(angularVelocity)||!finiteVector(quaternion)||!Number.isFinite(quaternion.w))throw new Error('Kinematic target must contain finite pose and velocity values');
    let record=records.get(body);
    if(!record){record={body,position:body.position.clone(),quaternion:body.quaternion.clone(),velocity:new CANNON.Vec3(),angularVelocity:new CANNON.Vec3(),sleepSpeedLimit:null};records.set(body,record);}
    // Callers may already have changed body.position. Compare the last accepted
    // pose, and wake before contacts: Cannon does not automatically wake a fully
    // sleeping kinematic when its application-driven velocity resumes.
    const p=record.position,q=record.quaternion;
    const sameRotation=(q.x===quaternion.x&&q.y===quaternion.y&&q.z===quaternion.z&&q.w===quaternion.w)||(q.x===-quaternion.x&&q.y===-quaternion.y&&q.z===-quaternion.z&&q.w===-quaternion.w);
    const moving=p.x!==position.x||p.y!==position.y||p.z!==position.z||!sameRotation||velocity.x!==0||velocity.y!==0||velocity.z!==0||angularVelocity.x!==0||angularVelocity.y!==0||angularVelocity.z!==0;
    if(moving){
      // Cannon uses the moving contact partner's sleep limit to wake a resting
      // receiver. A controlled slow push must still move the contacted object.
      // Override only this kinematic while a target is moving; dynamic bodies
      // retain their own sleep thresholds and wake through actual contacts.
      if(record.sleepSpeedLimit===null)record.sleepSpeedLimit=body.sleepSpeedLimit;
      body.sleepSpeedLimit=0;
      if(body.sleepState!==CANNON.Body.AWAKE)body.wakeUp();
    }else restoreSleepThreshold(record);
    record.position.copy(position);record.quaternion.copy(quaternion);record.velocity.copy(velocity);record.angularVelocity.copy(angularVelocity);
    copyPose(record);body.velocity.copy(record.velocity);body.angularVelocity.copy(record.angularVelocity);
    body.previousPosition.copy(record.position);body.interpolatedPosition.copy(record.position);body.previousQuaternion.copy(record.quaternion);body.interpolatedQuaternion.copy(record.quaternion);
    return true;
  }
  function clearContactHints(body){
    const record=records.get(body);if(!record)return;
    if(body.type!==CANNON.Body.KINEMATIC||body.world!==world){unregister(body);return;}
    restoreSleepThreshold(record);
    record.velocity.setZero();record.angularVelocity.setZero();copyPose(record);body.velocity.setZero();body.angularVelocity.setZero();
  }
  function dispose(){
    if(disposed)return;for(const body of records.keys())clearContactHints(body);records.clear();disposed=true;
    world.removeEventListener('preStep',beforeIntegration);world.removeEventListener('postStep',afterIntegration);controllers.delete(world);
    world.removeEventListener('removeBody',afterRemoval);
  }
  const controller={setTarget,clearContactHints,unregister,dispose,getState:()=>({registeredBodies:records.size,disposed})};
  controllers.set(world,controller);return controller;
}
