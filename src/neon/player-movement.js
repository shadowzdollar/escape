import * as THREE from 'three';

const SKIN=.0015;
const finiteBox=c=>c&&['x','y','z','sx','sy','sz'].every(k=>Number.isFinite(c[k]))&&Math.min(c.sx,c.sy,c.sz)>0;

/** Upright circular character, resolved against actual world-space box shapes.
 * getColliders(x,z,radius) returns nearby OBBs (ry) and already-resolved AABBs.
 * position is the caller's eye-position Vector3 and is never replaced.
 */
export function createPlayerMovement({position,getColliders=()=>[],groundHeightAt=()=>0,bounds,
  eyeHeight=1.75,radius=.4,stepHeight=.30}={}) {
  if(!position?.isVector3)throw new TypeError('Player movement requires a shared THREE.Vector3 position');
  const height=eyeHeight+.15,velocity=new THREE.Vector3(),lastPosition=position.clone();
  const targetVelocity=new THREE.Vector3();
  let grounded=false,groundY=0,jumpBuffer=0,coyote=0,jumpHeld=false,distanceMoved=0,currentSpeed=0;
  let query=null;

  function ground(x,z){const y=groundHeightAt(x,z);return Number.isFinite(y)?y:-Infinity;}
  function queryArea(x,z,range){
    const objects=(getColliders(x,z,range)||[]).filter(c=>{
      if(!finiteBox(c))return false;
      const cs=Math.abs(Math.cos(c.ry||0)),sn=Math.abs(Math.sin(c.ry||0));
      return Math.abs(x-c.x)<=range+(cs*c.sx+sn*c.sz)/2&&Math.abs(z-c.z)<=range+(sn*c.sx+cs*c.sz)/2;
    });query={x,z,range,objects};return objects;
  }
  function nearby(x,z){return query&&Math.hypot(x-query.x,z-query.z)+radius+.1<=query.range?query.objects:queryArea(x,z,radius+.15);}
  function circleContact(x,z,c,margin=radius){
    const angle=c.ry||0,cs=Math.cos(angle),sn=Math.sin(angle),dx=x-c.x,dz=z-c.z;
    const lx=dx*cs-dz*sn,lz=dx*sn+dz*cs,hx=c.sx/2,hz=c.sz/2;
    const qx=Math.max(-hx,Math.min(hx,lx)),qz=Math.max(-hz,Math.min(hz,lz));
    const ex=lx-qx,ez=lz-qz,d2=ex*ex+ez*ez;
    if(d2>=margin*margin)return null;
    let nx,nz,depth;
    if(d2>1e-12){const length=Math.sqrt(d2);nx=ex/length;nz=ez/length;depth=margin-length;}
    else if(hx-Math.abs(lx)<hz-Math.abs(lz)){nx=lx>=0?1:-1;nz=0;depth=margin+hx-Math.abs(lx);}
    else{nx=0;nz=lz>=0?1:-1;depth=margin+hz-Math.abs(lz);}
    return{nx:nx*cs+nz*sn,nz:-nx*sn+nz*cs,depth};
  }
  const top=c=>c.y+c.sy/2,bottom=c=>c.y-c.sy/2;
  const canSupport=c=>c.walkable!==false&&!c.civilian;
  function overlapsBody(c,feet){return top(c)>feet+SKIN&&bottom(c)<feet+height-SKIN;}
  function clearAt(x,z,feet,objects){return!objects.some(c=>overlapsBody(c,feet)&&circleContact(x,z,c,radius-SKIN));}
  function supportAt(x,z,ceiling,objects){
    let result=ground(x,z);if(result>ceiling+SKIN)result=-Infinity;
    for(const c of objects)if(canSupport(c)&&top(c)<=ceiling+SKIN&&top(c)>result&&circleContact(x,z,c,radius-SKIN))result=top(c);
    return result;
  }
  function removeInto(nx,nz){const into=velocity.x*nx+velocity.z*nz;if(into<0){velocity.x-=nx*into;velocity.z-=nz*into;}}
  function constrainBounds(){
    if(!bounds)return;
    const x=Math.max(bounds.minX+radius,Math.min(bounds.maxX-radius,position.x));
    const z=Math.max(bounds.minZ+radius,Math.min(bounds.maxZ-radius,position.z));
    if(x!==position.x){removeInto(x>position.x?1:-1,0);position.x=x;}
    if(z!==position.z){removeInto(0,z>position.z?1:-1);position.z=z;}
  }
  function horizontal(dx,dz){
    const fromX=position.x,fromZ=position.z,feet=position.y-eyeHeight;
    let x=fromX+dx,z=fromZ+dz,bodyFeet=feet,objects=nearby(x,z);
    const terrain=ground(x,z),moving=dx*dx+dz*dz>1e-12;
    // Height-only terrain providers still cannot teleport a character onto a
    // ledge taller than the explicit curb allowance.
    const allowance=grounded?stepHeight:SKIN;
    if(terrain>feet+allowance+SKIN){
      if(ground(x,fromZ)<=feet+allowance+SKIN){z=fromZ;velocity.z=0;}
      else if(ground(fromX,z)<=feet+allowance+SKIN){x=fromX;velocity.x=0;}
      else{x=fromX;z=fromZ;velocity.x=0;velocity.z=0;}
      objects=nearby(x,z);
    }
    if(grounded&&moving){
      let step=ground(x,z);
      for(const c of objects)if(canSupport(c)&&top(c)>feet+SKIN&&top(c)<=feet+stepHeight+SKIN&&circleContact(x,z,c))step=Math.max(step,top(c));
      if(step>feet+SKIN&&step<=feet+stepHeight+SKIN){
        if(clearAt(x,z,step,objects))bodyFeet=step;
        else if(ground(x,z)>feet+SKIN){x=fromX;z=fromZ;velocity.x=0;velocity.z=0;}
      }
    }
    // Project penetration along the actual OBB/corner normal. This preserves
    // motion tangent to a wall instead of forcing axis-order stair stepping.
    for(let pass=0;pass<5;pass++){
      let changed=false;
      for(const c of objects){
        if(!overlapsBody(c,bodyFeet))continue;
        const contact=circleContact(x,z,c);if(!contact)continue;
        const correction=Math.min(contact.depth+SKIN,.12);
        x+=contact.nx*correction;z+=contact.nz*correction;removeInto(contact.nx,contact.nz);changed=true;
      }
      if(!changed)break;
    }
    const limit=Math.hypot(dx,dz)+.11,correction=Math.hypot(x-fromX,z-fromZ);
    if(correction>limit){x=fromX+(x-fromX)*limit/correction;z=fromZ+(z-fromZ)*limit/correction;}
    position.x=x;position.z=z;position.y=bodyFeet+eyeHeight;constrainBounds();
    return Math.hypot(position.x-fromX,position.z-fromZ);
  }
  function vertical(dt,wasGrounded){
    const oldFeet=position.y-eyeHeight,objects=nearby(position.x,position.z);
    velocity.y-=21*dt;
    let feet=oldFeet+velocity.y*dt;
    if(velocity.y>0){
      for(const c of objects)if(bottom(c)>=oldFeet+height-SKIN&&bottom(c)<feet+height&&circleContact(position.x,position.z,c,radius-SKIN)){
        feet=Math.min(feet,bottom(c)-height-SKIN);velocity.y=0;
      }
    }
    groundY=supportAt(position.x,position.z,oldFeet+.012,objects);
    const canSnap=wasGrounded&&velocity.y<=0&&oldFeet-groundY<=stepHeight+.012;
    if(velocity.y<=0&&(feet<=groundY+SKIN||canSnap)){
      feet=groundY;velocity.y=0;grounded=true;coyote=.09;
    }else{grounded=false;coyote=Math.max(0,coyote-dt);}
    position.y=feet+eyeHeight;
  }
  function state(){return{grounded,speed:currentSpeed,distanceMoved,velocity:velocity.clone(),groundY};}
  function synchronizeExternal(){
    velocity.set(0,0,0);currentSpeed=0;distanceMoved=0;jumpBuffer=0;coyote=0;
    const feet=position.y-eyeHeight;groundY=supportAt(position.x,position.z,Math.max(feet,ground(position.x,position.z))+.012,nearby(position.x,position.z));
    if(feet<=groundY+.025){position.y=groundY+eyeHeight;grounded=true;coyote=.09;}else grounded=false;
  }
  function reset(){
    query=null;
    velocity.set(0,0,0);jumpBuffer=0;jumpHeld=false;distanceMoved=0;currentSpeed=0;coyote=.09;
    constrainBounds();groundY=ground(position.x,position.z);
    groundY=supportAt(position.x,position.z,groundY+stepHeight,nearby(position.x,position.z));
    position.y=groundY+eyeHeight;grounded=true;lastPosition.copy(position);return state();
  }
  function jump(){jumpBuffer=.12;return grounded||coyote>0;}
  function update(dt,input={}){
    if(!Number.isFinite(dt)||dt<0)throw new TypeError('Player movement dt must be finite and nonnegative');
    query=null;
    if(position.distanceToSquared(lastPosition)>1e-10)synchronizeExternal();
    distanceMoved=0;
    const duration=Math.min(.1,dt),yaw=Number.isFinite(input.yaw)?input.yaw:0;
    let f=Math.max(-1,Math.min(1,Number(input.forward)||0)),s=Math.max(-1,Math.min(1,Number(input.strafe)||0));
    const dash=Boolean(input.dash),desiredSpeed=dash?29:input.sprint?9.3:5.4;
    if(dash&&!f&&!s)f=1;
    const magnitude=Math.max(1,Math.hypot(f,s));f/=magnitude;s/=magnitude;
    targetVelocity.set((-Math.sin(yaw)*f+Math.cos(yaw)*s)*desiredSpeed,0,(-Math.cos(yaw)*f-Math.sin(yaw)*s)*desiredSpeed);
    if(input.jump&&!jumpHeld)jump();jumpHeld=Boolean(input.jump);
    if(duration===0){lastPosition.copy(position);return state();}
    // One swept-area query is shared by every integration substep. Static
    // spatial hashes and dynamic actor providers need run only once per frame.
    queryArea(position.x,position.z,radius+Math.max(velocity.length(),desiredSpeed)*duration+.3);
    const steps=Math.max(1,Math.ceil(duration*120),Math.ceil(Math.max(velocity.length(),desiredSpeed)*duration/.075)),step=duration/steps;
    for(let i=0;i<steps;i++){
      if(jumpBuffer>0&&(grounded||coyote>0)){velocity.y=7;grounded=false;coyote=0;jumpBuffer=0;}
      jumpBuffer=Math.max(0,jumpBuffer-step);
      const dx=targetVelocity.x-velocity.x,dz=targetVelocity.z-velocity.z,length=Math.hypot(dx,dz);
      const acceleration=dash?200:grounded?(targetVelocity.lengthSq()===0?38:Math.hypot(velocity.x,velocity.z)>desiredSpeed?72:32):8;
      const change=Math.min(length,acceleration*step);
      if(length>1e-9){velocity.x+=dx/length*change;velocity.z+=dz/length*change;}
      const wasGrounded=grounded;
      distanceMoved+=horizontal(velocity.x*step,velocity.z*step);
      vertical(step,wasGrounded);
    }
    currentSpeed=duration>0?distanceMoved/duration:Math.hypot(velocity.x,velocity.z);
    lastPosition.copy(position);return state();
  }
  reset();return{update,jump,reset,getState:state};
}
