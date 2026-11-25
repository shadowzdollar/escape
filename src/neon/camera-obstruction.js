import * as THREE from 'three';

const SKIN=.003,EPS=1e-9;
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);
const vector=p=>new THREE.Vector3(p.x,p.y,p.z);

// Records contain local dimensions plus an optional ry / quaternion rotation.
// A `yaw` field alone is intentionally ignored: traffic/loose-prop providers
// expose world AABB dimensions with yaw retained only as vehicle information.
function boxRecord(c,radius){
  if(!c||c.cameraCollision===false||c.enabled===false||!['x','y','z','sx','sy','sz'].every(k=>Number.isFinite(c[k]))||Math.min(c.sx,c.sy,c.sz)<=0)return null;
  let b;
  if(c.quaternion){
    const q=c.quaternion,values=Array.isArray(q)?q:[q.x,q.y,q.z,q.w];
    if(values.length!==4||!values.every(Number.isFinite))return null;
    const length=Math.hypot(...values);if(length<EPS)return null;
    const [x,y,z,w]=values.map(v=>v/length);
    // Rows of the inverse rotation; every row is a local axis in world space.
    b=[1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w),
       2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w),
       2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y)];
  }else{
    if(c.ry!==undefined&&!Number.isFinite(c.ry))return null;
    const angle=c.ry??0,cs=Math.cos(angle),sn=Math.sin(angle);b=[cs,0,-sn,0,1,0,sn,0,cs];
  }
  return {x:c.x,y:c.y,z:c.z,b,h:[c.sx/2+radius+SKIN,c.sy/2+radius+SKIN,c.sz/2+radius+SKIN]};
}

function contains(p,box){
  const x=p.x-box.x,y=p.y-box.y,z=p.z-box.z;
  for(let axis=0;axis<3;axis++){
    const i=axis*3;if(Math.abs(box.b[i]*x+box.b[i+1]*y+box.b[i+2]*z)>box.h[axis])return false;
  }
  return true;
}

function rayInterval(origin,direction,box,maxT=1){
  const x=origin.x-box.x,y=origin.y-box.y,z=origin.z-box.z;
  let lo=0,hi=maxT;
  for(let axis=0;axis<3;axis++){
    const i=axis*3,b=box.b;
    const p=b[i]*x+b[i+1]*y+b[i+2]*z,d=b[i]*direction.x+b[i+1]*direction.y+b[i+2]*direction.z,h=box.h[axis];
    if(Math.abs(d)<EPS){if(Math.abs(p)>h)return null;continue;}
    let near=(-h-p)/d,far=(h-p)/d;if(near>far)[near,far]=[far,near];
    lo=Math.max(lo,near);hi=Math.min(hi,far);if(lo>hi)return null;
  }
  return {lo,hi};
}

function unionIntervals(intervals,gap=EPS){
  intervals.sort((a,b)=>a.lo-b.lo||a.hi-b.hi);
  const merged=[];
  for(const item of intervals){
    const last=merged[merged.length-1];
    if(last&&item.lo<=last.hi+gap)last.hi=Math.max(last.hi,item.hi);
    else merged.push({...item});
  }
  return merged;
}

// Sweep the full segment, not a collection of sample positions. Inflating the
// OBB in its own axes conservatively protects the camera's near-plane sphere.
function sweep(start,end,boxes){
  const direction=end.clone().sub(start),length=direction.length();
  if(length<EPS)return boxes.some(b=>contains(end,b))?null:end.clone();
  const intervals=unionIntervals(boxes.map(b=>rayInterval(start,direction,b)).filter(Boolean),SKIN/length);
  if(!intervals.length)return end.clone();
  const first=intervals[0],margin=SKIN/length;
  if(first.lo>EPS)return start.clone().addScaledVector(direction,Math.max(0,first.lo-margin));
  // A moving blocker may engulf the anchor. Skip only its contiguous covered
  // interval, then use the first free stretch; never return a contained anchor.
  if(first.hi>=1-EPS)return null;
  const next=intervals[1];
  if(!next)return end.clone();
  const t=Math.max(first.hi+(next.lo-first.hi)*.5,next.lo-margin);
  return start.clone().addScaledVector(direction,t);
}

function collect(start,end,previous,getColliders,radius){
  const points=previous?[start,end,previous]:[start,end];
  const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
  const minZ=Math.min(...points.map(p=>p.z)),maxZ=Math.max(...points.map(p=>p.z));
  const minY=Math.min(...points.map(p=>p.y))-radius-SKIN,maxY=Math.max(...points.map(p=>p.y))+radius+SKIN;
  const x=minX+(maxX-minX)/2,z=minZ+(maxZ-minZ)/2,range=Math.hypot(maxX-minX,maxZ-minZ)/2+radius+SKIN*2;
  const raw=typeof getColliders==='function'?getColliders(x,z,range):[];
  if(!raw||typeof raw[Symbol.iterator]!=='function')return [];
  const boxes=[];
  for(const c of raw){
    const box=boxRecord(c,radius);if(!box)continue;
    const {b,h}=box,hx=Math.abs(b[0])*h[0]+Math.abs(b[3])*h[1]+Math.abs(b[6])*h[2];
    const hy=Math.abs(b[1])*h[0]+Math.abs(b[4])*h[1]+Math.abs(b[7])*h[2];
    const hz=Math.abs(b[2])*h[0]+Math.abs(b[5])*h[1]+Math.abs(b[8])*h[2];
    if(box.x+hx<minX||box.x-hx>maxX||box.z+hz<minZ||box.z-hz>maxZ||box.y+hy<minY||box.y-hy>maxY)continue;
    boxes.push(box);
  }
  return boxes;
}

// Rare recovery for a zero-length or completely enclosed boom. Test exits along
// world and OBB face normals and choose the nearest clear exit of their union.
function escapeContained(point,boxes){
  if(!boxes.some(b=>contains(point,b)))return point.clone();
  const directions=[new THREE.Vector3(0,1,0),new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1),new THREE.Vector3(0,-1,0)];
  const seen=new Set(directions.map(d=>d.toArray().map(v=>v.toFixed(4)).join(',')));
  for(const box of boxes.filter(b=>contains(point,b)))for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
    const i=axis*3,d=new THREE.Vector3(box.b[i]*sign,box.b[i+1]*sign,box.b[i+2]*sign),key=d.toArray().map(v=>v.toFixed(4)).join(',');
    if(!seen.has(key)&&directions.length<48){seen.add(key);directions.push(d);}
  }
  let best=null,bestDistance=Infinity;
  for(const direction of directions){
    const union=unionIntervals(boxes.map(b=>rayInterval(point,direction,b,Infinity)).filter(Boolean),SKIN*2);
    const distance=(union[0]?.hi??0)+SKIN;
    if(!Number.isFinite(distance)||distance>=bestDistance)continue;
    const candidate=point.clone().addScaledVector(direction,distance);
    if(finitePoint(candidate)&&!boxes.some(b=>contains(candidate,b))){best=candidate;bestDistance=distance;}
  }
  return best||point.clone();
}

/**
 * Resolve an obstructed third-person/chase boom without mutating caller data.
 * getColliders(x,z,range) must return every solid intersecting that XZ query;
 * exclude the player and owned vehicle there. Box y is its centre, not its base.
 * `previous` additionally sweeps the camera's actual inter-frame movement.
 * If that temporal constraint conflicts with the current anchor's visibility,
 * an inward camera snap takes priority. Both segment constraints cannot always
 * be satisfied after rounding a corner; never leave the player behind a wall.
 * Apply this AFTER any outward interpolation. Snap inward when the boom shrinks;
 * do not interpolate the resolved result through an obstruction afterward.
 */
export function resolveCameraBoom({anchor,desired,getColliders,radius=.22,previous}={}){
  const start=finitePoint(anchor)?vector(anchor):finitePoint(desired)?vector(desired):new THREE.Vector3();
  const end=finitePoint(desired)?vector(desired):start.clone();
  const last=finitePoint(previous)?vector(previous):null;
  radius=Number.isFinite(radius)&&radius>=0?radius:.22;
  if(!Number.isFinite(start.distanceTo(end))||last&&!Number.isFinite(last.distanceTo(end)))return start;
  let boxes=collect(start,end,last,getColliders,radius),result=sweep(start,end,boxes),recovering=!result;
  if(!result)result=escapeContained(end,boxes);
  if(last){const temporal=sweep(last,result,boxes);if(!temporal)recovering=true;result=temporal||escapeContained(result,boxes);}
  // The temporal sweep can stop on the old side of a corner. Its endpoint is
  // outside the solid, but the player-to-camera segment can now cross that
  // solid. Reproject inward from the current anchor instead of showing its
  // back face. Do not interpolate or reapply the conflicting temporal sweep.
  const visible=sweep(start,result,boxes);
  if(visible)result=visible;
  else{recovering=true;result=escapeContained(result,boxes);}
  if(!recovering)return result;
  // An enclosed-anchor escape can extend beyond the original query. Requery
  // that destination and the whole travelled segment rather than using stale
  // bounds or overlooking an adjacent building after depenetration.
  // Keep every blocker found during this recovery. Otherwise an escape into
  // an adjacent box can repeatedly alternate across the same shared wall as
  // the narrow query forgets the box on the opposite side.
  const known=new Map(boxes.map(box=>[JSON.stringify(box),box]));
  for(let pass=0;pass<64;pass++){
    const fresh=collect(start,result,last,getColliders,radius);
    const containing=fresh.filter(b=>contains(result,b));
    if(!containing.length){
      // Recovery may have left the initial query. Include newly discovered
      // intervening blockers when restoring the final boom's visibility.
      const visible=sweep(start,result,fresh);if(visible)return visible;
    }
    for(const box of fresh)known.set(JSON.stringify(box),box);
    boxes=[...known.values()];result=escapeContained(result,boxes);
  }
  return finitePoint(result)?result:start;
}
