import * as THREE from 'three';

const UNIT=new THREE.Vector3(1,1,1),UP=new THREE.Vector3(0,1,0),X=new THREE.Vector3(1,0,0);
const clamp=THREE.MathUtils.clamp,smooth=t=>t*t*(3-2*t),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const point=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

/** Distance-driven gait for the existing voxel citizen, without new geometry.
 * plan() eases desired velocity; update() consumes collision-resolved movement.
 * Foot contacts are stored in world space and never slide during stance.
 */
export function createCivilianMotion({scale=1,phase=0,groundHeightAt=()=>.057,umbrella=false}={}){
  const velocity=point(),position=point(),previous=point(),forward=point(0,0,1),side=point(1,0,0);
  const feet=[-1,1].map(sign=>({sign,world:point(),from:point(),target:point(),yaw:0,planted:true,q:0,phaseOffset:0,swingStart:.62,lift:0,floor:.057}));
  const bones=Object.fromEntries(['pelvis','torso','head','upperArmL','upperArmR','forearmL','forearmR','thighL','thighR','shinL','shinR','footL','footR','umbrella'].map(name=>[name,new THREE.Matrix4()]));
  const orientations=Object.fromEntries(Object.keys(bones).map(name=>[name,new THREE.Quaternion()]));
  const joints=Object.fromEntries(['waist','neck','hipL','hipR','kneeL','kneeR','shoulderL','shoulderR','elbowL','elbowR'].map(name=>[name,point()])),local=new THREE.Matrix4(),basis=new THREE.Matrix4(),scaleVector=point();
  const ankle=point(),hip=point(),knee=point(),direction=point(),bend=point(),basisX=point(),basisY=point(),basisZ=point(),temp=point();
  const yawQuaternion=new THREE.Quaternion(),pitchQuaternion=new THREE.Quaternion(),torsoQuaternion=new THREE.Quaternion(),upperQuaternion=new THREE.Quaternion(),lowerQuaternion=new THREE.Quaternion();
  let yaw=0,distance=0,cycle=.31,cycleDistance=.46*scale,duty=.62,blend=0,fleeBlend=0,measuredSpeed=0,groundY=.057,originY=.057,initialized=false,idleTime=0;

  function support(x,z,angle=0){
    const c=Math.cos(angle),s=Math.sin(angle),hw=.1*scale,back=-.135*scale,front=.195*scale;
    let floor=groundHeightAt(x,z);
    for(const dx of [-hw,hw])for(const dz of [back,front])floor=Math.max(floor,groundHeightAt(x+dx*c+dz*s,z-dx*s+dz*c));
    return Number.isFinite(floor)?floor:groundY;
  }
  function footAtRoot(foot,out,ahead=0){return out.set(position.x+side.x*foot.sign*.135*scale+forward.x*ahead,0,position.z+side.z*foot.sign*.135*scale+forward.z*ahead);}
  function reset({x=0,z=0,yaw:angle=0,groundY:floor=groundHeightAt(x,z)}={}){
    yaw=angle;groundY=floor;originY=floor;position.set(x,floor,z);previous.copy(position);velocity.set(0,0,0);
    distance=0;cycle=.31+(Math.sin(phase)*.007);cycleDistance=.46*scale;duty=.62;blend=0;fleeBlend=0;measuredSpeed=0;idleTime=0;
    forward.set(Math.sin(yaw),0,Math.cos(yaw));side.set(Math.cos(yaw),0,-Math.sin(yaw));
    for(let i=0;i<feet.length;i++){const foot=feet[i];footAtRoot(foot,foot.world);foot.floor=foot.world.y=support(foot.world.x,foot.world.z,yaw);foot.from.copy(foot.world);foot.target.copy(foot.world);foot.yaw=yaw;foot.planted=true;foot.phaseOffset=0;foot.q=(cycle+i*.5)%1;foot.swingStart=foot.q;foot.lift=0;}
    initialized=true;pose();return getState();
  }
  function plan(dt,{vx=0,vz=0,fleeing=false}={}){
    const step=clamp(Number.isFinite(dt)?dt:0,0,.1),targetSpeed=Math.hypot(vx,vz);
    if(targetSpeed>.001){const desired=Math.atan2(vx,vz),angle=wrap(desired-yaw);
      // Brake along the existing travel direction before a sharp reversal.
      // Turning the torso while still running backward strands planted feet.
      if(Math.abs(angle)>1.3&&velocity.length()>.4){vx=0;vz=0;}
      else{yaw+=clamp(angle,-step*(fleeing?6:3.8),step*(fleeing?6:3.8));const turn=Math.max(.08,Math.cos(wrap(desired-yaw)));vx*=turn;vz*=turn;}}
    const dx=vx-velocity.x,dz=vz-velocity.z,length=Math.hypot(dx,dz),acceleration=Math.hypot(vx,vz)<velocity.length()?4.6:fleeing?6.5:3;
    const factor=length?Math.min(1,acceleration*step/length):0;velocity.x+=dx*factor;velocity.z+=dz*factor;
    if(targetSpeed<.001&&velocity.length()<.008)velocity.set(0,0,0);
    return{dx:velocity.x*step,dz:velocity.z*step,yaw,vx:velocity.x,vz:velocity.z};
  }
  function update(dt,{x,z,groundY:floor=groundHeightAt(x,z),fleeing=false}={}){
    if(!initialized)return reset({x,z,groundY:floor});
    const step=clamp(Number.isFinite(dt)?dt:0,0,.1),travel=Math.hypot(x-previous.x,z-previous.z);
    if(travel>Math.max(.8,step*6))return reset({x,z,yaw,groundY:floor});
    position.set(x,floor,z);groundY=floor;forward.set(Math.sin(yaw),0,Math.cos(yaw));side.set(Math.cos(yaw),0,-Math.sin(yaw));
    const actualSpeed=step>0?travel/step:0;
    measuredSpeed+=(actualSpeed-measuredSpeed)*(1-Math.exp(-step*10));
    const targetBlend=clamp(actualSpeed/.16,0,1);blend+=(targetBlend-blend)*(1-Math.exp(-step*13));
    fleeBlend+=((fleeing?1:0)-fleeBlend)*(1-Math.exp(-step*7));
    duty=.62-.24*fleeBlend;const reach=(.14+.09*fleeBlend)*scale;
    cycleDistance+=(2*reach/duty-cycleDistance)*(1-Math.exp(-step*7));
    const advance=travel/Math.max(.1,cycleDistance);cycle+=advance;distance+=travel;idleTime=actualSpeed<.012?idleTime+step:0;
    for(let i=0;i<feet.length;i++){
      const foot=feet[i];let q=(cycle+i*.5+foot.phaseOffset)%1;const wasSwing=!foot.planted;
      const hx=position.x+side.x*foot.sign*.135*scale,hz=position.z+side.z*foot.sign*.135*scale;
      // A sharp turn can strand a stance foot: lift it before the leg exceeds reach.
      if(foot.planted&&Math.hypot(foot.world.x-hx,foot.world.z-hz)>.22*scale){foot.phaseOffset+=duty+.001-q;q=duty+.001;}
      if(idleTime>.08||(actualSpeed<.012&&blend<.02)){
        // Finishing a lifted foot when stopping does not advance gait phase.
        const floor=foot.floor=support(foot.world.x,foot.world.z,foot.yaw);foot.world.y+= (floor-foot.world.y)*(1-Math.exp(-step*24));
        if(Math.abs(foot.world.y-floor)<.002){foot.world.y=floor;foot.planted=true;}foot.q=q;continue;
      }
      if(q<duty){
        if(wasSwing){footAtRoot(foot,foot.world,reach-q*cycleDistance);foot.floor=foot.world.y=support(foot.world.x,foot.world.z,yaw);foot.yaw=yaw;foot.planted=true;}
      }else{
        if(foot.planted){foot.from.copy(foot.world);foot.swingStart=foot.q>duty?foot.q:duty;foot.planted=false;}
        const progress=clamp((q-foot.swingStart)/Math.max(.04,1-foot.swingStart),0,1),t=smooth(progress);
        footAtRoot(foot,foot.target,reach+(1-q)*cycleDistance);foot.target.y=support(foot.target.x,foot.target.z,yaw);
        const height=(.065+.02*fleeBlend)*scale+Math.max(0,foot.target.y-foot.from.y);
        foot.world.lerpVectors(foot.from,foot.target,t);foot.world.y+=Math.sin(progress*Math.PI)*height;
        foot.yaw+=wrap(yaw-foot.yaw)*Math.min(1,step*15);foot.floor=support(foot.world.x,foot.world.z,foot.yaw);foot.world.y=Math.max(foot.world.y,foot.floor);
      }
      // The swing path may bend on a turn, but must remain anatomically reachable.
      if(!foot.planted){const dx=foot.world.x-hx,dz=foot.world.z-hz,d=Math.hypot(dx,dz),limit=.25*scale;if(d>limit){foot.world.x=hx+dx/d*limit;foot.world.z=hz+dz/d*limit;foot.floor=support(foot.world.x,foot.world.z,foot.yaw);foot.world.y=Math.max(foot.world.y,foot.floor);}}
      foot.q=q;
    }
    previous.copy(position);pose();return getState();
  }
  function transform(name,origin,quaternion){orientations[name].copy(quaternion);bones[name].compose(origin,quaternion,UNIT);}
  function limbRotation(up,out){
    basisY.copy(up).normalize();basisZ.copy(forward).addScaledVector(basisY,-forward.dot(basisY));if(basisZ.lengthSq()<1e-8)basisZ.set(0,0,1);basisZ.normalize();basisX.crossVectors(basisY,basisZ).normalize();basisZ.crossVectors(basisX,basisY).normalize();basis.makeBasis(basisX,basisY,basisZ);return out.setFromRotationMatrix(basis);
  }
  function pose(){
    yawQuaternion.setFromAxisAngle(UP,yaw);
    const l1=.245*scale,l2=.285*scale,reach=l1+l2-.001*scale,minKneeReach=Math.sqrt(l1*l1+l2*l2+2*l1*l2*Math.cos(1.6));
    originY=groundY-(.032+.05*fleeBlend)*scale*blend;
    // A trailing foot can remain on the lower side of a curb while the other
    // steps up. Lower the pelvis within reach instead of stretching a leg.
    for(const foot of feet){const hx=position.x+side.x*foot.sign*.135*scale,hz=position.z+side.z*foot.sign*.135*scale,horizontal=Math.hypot(foot.world.x-hx,foot.world.z-hz);
      if(horizontal<reach)originY=Math.min(originY,foot.world.y+.135*scale+Math.sqrt(Math.max(0,reach*reach-horizontal*horizontal))-.665*scale);}
    temp.set(position.x,originY,position.z);transform('pelvis',temp,yawQuaternion);
    const waist=joints.waist.set(0,.825*scale,0).applyMatrix4(bones.pelvis);
    pitchQuaternion.setFromAxisAngle(X,.11*fleeBlend*blend);torsoQuaternion.copy(yawQuaternion).multiply(pitchQuaternion);transform('torso',waist,torsoQuaternion);orientations.head.copy(torsoQuaternion);bones.head.copy(bones.torso);
    joints.neck.set(0,.5*scale,0).applyMatrix4(bones.torso);
    for(let i=0;i<feet.length;i++){
      const foot=feet[i],suffix=i?'R':'L';
      hip.set(foot.sign*.135*scale,.665*scale,0).applyMatrix4(bones.pelvis);
      const horizontal=Math.hypot(hip.x-foot.world.x,hip.z-foot.world.z),maxFootY=hip.y-Math.sqrt(Math.max(0,minKneeReach*minKneeReach-horizontal*horizontal))-.135*scale;
      if(!foot.planted)foot.world.y=Math.min(foot.world.y,Math.max(foot.floor,maxFootY));
      const solveLeg=()=>{
        ankle.copy(foot.world);ankle.y+=.135*scale;
        direction.copy(ankle).sub(hip);const separation=clamp(direction.length(),Math.abs(l2-l1)+.001,reach);direction.normalize();
        const along=(l1*l1-l2*l2+separation*separation)/(2*separation),height=Math.sqrt(Math.max(0,l1*l1-along*along));
        bend.copy(forward).addScaledVector(direction,-forward.dot(direction)).normalize();knee.copy(hip).addScaledVector(direction,along).addScaledVector(bend,height);
      };
      solveLeg();
      // Preserve the physical hip cone when a high swing crosses a curb. Lower
      // only the airborne foot; a planted sole keeps its exact support contact.
      if(!foot.planted&&(hip.y-knee.y)/l1<Math.cos(1.18)&&foot.world.y>foot.floor){
        let low=foot.floor,high=foot.world.y;
        for(let n=0;n<7;n++){foot.world.y=(low+high)/2;solveLeg();if((hip.y-knee.y)/l1<Math.cos(1.18))high=foot.world.y;else low=foot.world.y;}
        foot.world.y=low;solveLeg();
      }
      joints['hip'+suffix].copy(hip);joints['knee'+suffix].copy(knee);
      limbRotation(temp.copy(hip).sub(knee),orientations['thigh'+suffix]);transform('thigh'+suffix,hip,orientations['thigh'+suffix]);
      limbRotation(temp.copy(knee).sub(ankle),orientations['shin'+suffix]);transform('shin'+suffix,knee,orientations['shin'+suffix]);
      pitchQuaternion.setFromAxisAngle(UP,foot.yaw);transform('foot'+suffix,ankle,pitchQuaternion);
      const footAhead=(foot.world.x-position.x)*forward.x+(foot.world.z-position.z)*forward.z;
      const carrying=umbrella&&suffix==='R',armPitch=carrying?-.5:clamp(footAhead/scale*1.4,-.46,.46)*blend;
      const elbowPitch=carrying?-1.45:-(.06+.65*fleeBlend)*blend;
      const shoulder=joints['shoulder'+suffix].set(foot.sign*.235*scale,.42*scale,0).applyMatrix4(bones.torso);
      upperQuaternion.copy(torsoQuaternion).multiply(pitchQuaternion.setFromAxisAngle(X,armPitch));transform('upperArm'+suffix,shoulder,upperQuaternion);
      const elbow=joints['elbow'+suffix].set(foot.sign*.095*scale,-.245*scale,0).applyMatrix4(bones['upperArm'+suffix]);
      lowerQuaternion.copy(upperQuaternion).multiply(pitchQuaternion.setFromAxisAngle(X,elbowPitch));transform('forearm'+suffix,elbow,lowerQuaternion);
    }
    if(umbrella){
      const grip=temp.set(.01*scale,-.265*scale,.035*scale).applyMatrix4(bones.forearmR);grip.y+=.04*scale;
      const authoredPoleBase=bend.set(.35*scale,(1.38-.97)*scale,.1*scale).applyMatrix4(bones.torso);
      bones.umbrella.copy(bones.torso);bones.umbrella.elements[12]+=grip.x-authoredPoleBase.x;bones.umbrella.elements[13]+=grip.y-authoredPoleBase.y;bones.umbrella.elements[14]+=grip.z-authoredPoleBase.z;orientations.umbrella.copy(torsoQuaternion);
    }
  }
  function writePartMatrix(piece,out){
    let name='pelvis',px=0,py=.145;
    const sign=piece.x<0?-1:1,suffix=sign<0?'L':'R';
    if(piece.umbrella){name='umbrella';py=.97;}
    else if(piece.motion===1||piece.motion===2){px=sign*.135;if(piece.y<.3){name='foot'+suffix;py=.28;}else if(piece.y>.57){name='thigh'+suffix;py=.81;}else{name='shin'+suffix;py=.565;}}
    else if(piece.motion===3||piece.motion===4){name='forearm'+suffix;px=sign*.33;py=1.145;}
    else if(Math.abs(piece.x)>=.255&&piece.y>=1.2&&piece.y<1.5){name='upperArm'+suffix;px=sign*.235;py=1.39;}
    else if(piece.y>=.98){name=piece.y>=1.45?'head':'torso';py=.97;}
    local.makeTranslation((piece.x-px)*scale,(piece.y-py)*scale,piece.z*scale);scaleVector.set(piece.sx*scale,piece.sy*scale,piece.sz*scale);local.scale(scaleVector);return out.multiplyMatrices(bones[name],local);
  }
  function getState(){return{yaw,phase:cycle%1,distance,speed:measuredSpeed,velocity:{x:velocity.x,z:velocity.z},blend,fleeBlend,originY,groundY,feet:feet.map(foot=>({side:foot.sign<0?'L':'R',x:foot.world.x,y:foot.world.y,z:foot.world.z,yaw:foot.yaw,planted:foot.planted})),jointPositions:joints,segmentOrientations:orientations};}
  return{reset,plan,update,writePartMatrix,getState};
}
