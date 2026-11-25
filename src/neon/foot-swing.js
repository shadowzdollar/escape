import * as THREE from 'three';
import {resolveBootClearance,BOOT_CLEARANCE_SKIN,BOOT_CLEARANCE_TOP_TOLERANCE} from './boot-clearance.js';

const EPS=1e-8;
const finiteBox=c=>c&&['x','y','z','sx','sy','sz'].every(k=>Number.isFinite(c[k]))&&Math.min(c.sx,c.sy,c.sz)>0;

// A fixed-yaw upright boot moving along one horizontal line produces an exact
// interval against each of the four horizontal separating axes of an OBB.
// The other dimension below is sole height, including the boot's full height.
function obstaclesAlongLine(from,direction,distance,shape,colliders){
  const cs=Math.cos(shape.yaw),sn=Math.sin(shape.yaw),footAxes=[[cs,-sn],[sn,cs]],result=[];
  for(const c of colliders){
    if(!finiteBox(c)||c.dynamic||c.civilian||c.rx||c.rz||c.ry!==undefined&&!Number.isFinite(c.ry))continue;
    const cc=Math.cos(c.ry||0),ss=Math.sin(c.ry||0),boxAxes=[[cc,-ss],[ss,cc]];
    let lo=-Infinity,hi=Infinity;
    for(const axis of [...footAxes,...boxAxes]){
      const dot=a=>Math.abs(a[0]*axis[0]+a[1]*axis[1]);
      const radius=shape.halfWidth*dot(footAxes[0])+shape.halfLength*dot(footAxes[1])+c.sx*.5*dot(boxAxes[0])+c.sz*.5*dot(boxAxes[1])+BOOT_CLEARANCE_SKIN;
      const origin=(from.x-c.x)*axis[0]+(from.z-c.z)*axis[1],velocity=direction.x*axis[0]+direction.z*axis[1];
      if(Math.abs(velocity)<EPS){if(Math.abs(origin)>=radius){lo=1;hi=0;break;}continue;}
      let a=(-radius-origin)/velocity,b=(radius-origin)/velocity;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);
      if(lo>=hi)break;
    }
    if(lo>=hi||hi<0||lo>distance)continue;
    result.push({id:c.id,lo,hi,bottom:c.y-c.sy*.5-shape.height+BOOT_CLEARANCE_TOP_TOLERANCE,top:c.y+c.sy*.5-BOOT_CLEARANCE_TOP_TOLERANCE});
  }
  return result;
}

function segmentIsClear(a,b,obstacles){
  for(const box of obstacles){
    let enter=0,exit=1;
    for(const [start,change,lo,hi] of [[a.s,b.s-a.s,box.lo,box.hi],[a.y,b.y-a.y,box.bottom,box.top]]){
      if(Math.abs(change)<EPS){if(start<=lo+EPS||start>=hi-EPS){enter=1;exit=0;break;}continue;}
      let t0=(lo-start)/change,t1=(hi-start)/change;if(t0>t1)[t0,t1]=[t1,t0];enter=Math.max(enter,t0);exit=Math.min(exit,t1);
    }
    if(enter<exit-EPS&&exit>EPS&&enter<1-EPS)return false;
  }
  return true;
}

function visibilityRoute(start,end,obstacles,minimumY,maximumY){
  const nodes=[start,end],guard=.025;
  for(const box of obstacles){
    for(const s of [box.lo-guard,box.hi+guard]){
      if(s<start.s-EPS||s>end.s+EPS)continue;
      for(const y of [box.top+guard,box.bottom-guard]){
        if(y<minimumY||y>maximumY)continue;
        const point={s,y};if(segmentIsClear(point,point,obstacles))nodes.push(point);
      }
    }
  }
  // Nearby duplicate decoration boxes should not multiply the route graph.
  const unique=[],seen=new Set();
  for(const p of nodes){const key=p.s.toFixed(7)+','+p.y.toFixed(7);if(!seen.has(key)){seen.add(key);unique.push(p);}}
  if(unique.length>220)return null;
  const costs=unique.map(()=>Infinity),parents=unique.map(()=>-1),visited=new Set();costs[0]=0;
  const endIndex=unique.findIndex(p=>Math.abs(p.s-end.s)<EPS&&Math.abs(p.y-end.y)<EPS);
  for(let pass=0;pass<unique.length;pass++){
    let index=-1;for(let i=0;i<unique.length;i++)if(!visited.has(i)&&(index<0||costs[i]<costs[index]))index=i;
    if(index<0||!Number.isFinite(costs[index]))break;
    if(index===endIndex)break;visited.add(index);
    for(let next=0;next<unique.length;next++){
      if(visited.has(next)||next===index||unique[next].s<unique[index].s-EPS)continue;
      const length=Math.hypot(unique[next].s-unique[index].s,unique[next].y-unique[index].y);
      if(costs[index]+length>=costs[next]||!segmentIsClear(unique[index],unique[next],obstacles))continue;
      costs[next]=costs[index]+length;parents[next]=index;
    }
  }
  if(!Number.isFinite(costs[endIndex]))return null;
  const path=[];for(let i=endIndex;i>=0;i=parents[i]){path.push(unique[i]);if(i===0)break;}
  return path.reverse();
}

function roundedRoute(points,obstacles,rounding){
  if(points.length<3)return points;
  const result=[points[0]];
  for(let i=1;i<points.length-1;i++){
    const a=points[i-1],b=points[i],c=points[i+1],before=Math.hypot(b.s-a.s,b.y-a.y),after=Math.hypot(c.s-b.s,c.y-b.y);
    if(Math.min(before,after)<EPS)continue;
    const cut=Math.min(rounding,before*.3,after*.3),p={s:b.s+(a.s-b.s)*cut/before,y:b.y+(a.y-b.y)*cut/before},q={s:b.s+(c.s-b.s)*cut/after,y:b.y+(c.y-b.y)*cut/after};
    const curve=[p];for(let j=1;j<=12;j++){const t=j/12,u=1-t;curve.push({s:u*u*p.s+2*u*t*b.s+t*t*q.s,y:u*u*p.y+2*u*t*b.y+t*t*q.y});}
    const sequence=[result.at(-1),...curve,c];
    if(sequence.slice(1).every((point,j)=>segmentIsClear(sequence[j],point,obstacles)))result.push(...curve);else result.push(b);
  }
  result.push(points.at(-1));return result;
}

/** Plan a fixed-yaw boot trajectory through actual static solids. This module
 * knows no player/root/controller: it does not choose a supporting surface or
 * assert that the leg can reach the path. The caller must choose a supported
 * endpoint and validate its future leg/pelvis, then commit actual motion.
 */
export function planFootSwing({from,to,halfWidth,halfLength,height,yaw=0,colliders=[],lift=.055,speed=12,acceleration=240,rounding=.035}={}){
  if(!from?.isVector3||!to?.isVector3||![...from.toArray(),...to.toArray(),halfWidth,halfLength,height,yaw,lift,speed,acceleration,rounding].every(Number.isFinite)||Math.min(halfWidth,halfLength,height,speed,acceleration)<=0||Math.min(lift,rounding)<0)throw new TypeError('Foot swing requires finite positions and positive dimensions/motor limits');
  const distance=Math.hypot(to.x-from.x,to.z-from.z),direction=distance>EPS?new THREE.Vector3(to.x-from.x,0,to.z-from.z).divideScalar(distance):new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  const shape={halfWidth,halfLength,height,yaw},obstacles=obstaclesAlongLine(from,direction,distance,shape,colliders);
  const start={s:0,y:from.y},end={s:distance,y:to.y};
  if(!segmentIsClear(start,start,obstacles)||!segmentIsClear(end,end,obstacles))return{ok:false,reason:'endpoint intersects a solid or its lateral clearance skin'};
  let route;
  if(distance<EPS){route=segmentIsClear(start,end,obstacles)?[start,end]:null;}
  else{
    const lifted={s:0,y:from.y+lift};
    if(!segmentIsClear(start,lifted,obstacles))return{ok:false,reason:'no clearance to lift the boot'};
    const core=visibilityRoute(lifted,end,obstacles,Math.min(from.y,to.y),Math.max(from.y,to.y)+Math.max(.36,lift));
    route=core?[start,...core]:null;
  }
  if(!route)return{ok:false,reason:'no clear route in the foot swing height range'};
  const rounded=roundedRoute(route,obstacles,rounding);
  const world=p=>new THREE.Vector3(from.x+direction.x*p.s,p.y,from.z+direction.z*p.s);
  function checked(points){
    const values=points.map(world).filter((p,i,a)=>i===0||p.distanceToSquared(a[i-1])>1e-16);
    for(let i=1;i<values.length;i++){
      const sweep=resolveBootClearance({from:values[i-1],to:values[i],...shape,colliders});
      if(sweep.blocked||sweep.unresolved||sweep.position.distanceTo(values[i])>1e-6)return null;
    }
    return values;
  }
  const points=checked(rounded)||checked(route);
  if(!points)return{ok:false,reason:'route failed the executing clearance sweep'};
  const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+points[i].distanceTo(points[i-1]));
  const length=lengths.at(-1),peak=Math.min(speed,Math.sqrt(length*acceleration)),ramp=peak/acceleration,rampDistance=.5*acceleration*ramp*ramp,cruise=peak>0?Math.max(0,length-2*rampDistance)/peak:0;
  return{ok:true,points,lengths,length,yaw,speed,acceleration,peak,ramp,rampDistance,cruise,duration:2*ramp+cruise,
    scope:'fixed-yaw static boot prism; supported endpoint, anatomical reach, changing geometry and angular motion require caller validation'};
}

/** Sample the SAME arc-length profile used for execution and arrival prediction.
 * It reaches the endpoint with zero speed exactly, independently of frame rate.
 */
export function sampleFootSwing(path,elapsed){
  if(!path?.ok||!Number.isFinite(elapsed))throw new TypeError('Sample a valid foot path at finite elapsed time');
  const t=Math.max(0,Math.min(path.duration,elapsed));let distance,velocity;
  if(t<path.ramp){distance=.5*path.acceleration*t*t;velocity=path.acceleration*t;}
  else if(t<path.ramp+path.cruise){distance=path.rampDistance+path.peak*(t-path.ramp);velocity=path.peak;}
  else{const left=path.duration-t;distance=path.length-.5*path.acceleration*left*left;velocity=path.acceleration*left;}
  if(path.length<EPS)return{position:path.points[0].clone(),velocity:new THREE.Vector3(),distance:0,elapsed:t,done:true};
  let i=1;while(i<path.lengths.length-1&&path.lengths[i]<distance)i++;
  const segment=path.lengths[i]-path.lengths[i-1],direction=path.points[i].clone().sub(path.points[i-1]).divideScalar(segment);
  return{position:path.points[i-1].clone().addScaledVector(direction,Math.max(0,Math.min(segment,distance-path.lengths[i-1]))),velocity:direction.multiplyScalar(velocity),distance,elapsed:t,done:t>=path.duration};
}

/** Never advance a hidden trajectory while the rendered foot is held elsewhere.
 * A rejected/IK-projected step must cause the caller to replan from that actual
 * solved pose. This guard cannot itself select a new reachable/clear route.
 */
export function advanceFootSwing(path,{elapsed,dt,actualPosition,tolerance=.001}={}){
  if(!Number.isFinite(dt)||dt<0||!actualPosition?.isVector3||!Number.isFinite(tolerance)||tolerance<0)throw new TypeError('Foot swing advance requires actual position, nonnegative dt and tolerance');
  const expected=sampleFootSwing(path,elapsed);
  if(expected.position.distanceTo(actualPosition)>tolerance)return{advanced:false,reason:'actual foot diverged; replan from the solved pose',...expected,position:actualPosition.clone()};
  return{advanced:true,...sampleFootSwing(path,elapsed+dt)};
}
