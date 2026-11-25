import {resolveBootClearance,BOOT_CLEARANCE_SKIN,BOOT_CLEARANCE_TOP_TOLERANCE} from './boot-clearance.js';

const EPS=1e-10,OUTSIDE=1e-8,MAX_REGIONS=256;
const dot=(p,n)=>p.x*n.x+p.z*n.z;
const axes=yaw=>{const c=Math.cos(yaw),s=Math.sin(yaw);return[{x:c,z:-s},{x:s,z:c}];};
const finitePosition=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);
const validRange=(minimum,maximum)=>typeof minimum==='number'&&typeof maximum==='number'&&!Number.isNaN(minimum)&&!Number.isNaN(maximum)&&minimum<=maximum;

function dimensions(p,halfWidth,halfLength,yaw,height=1){
  if(!finitePosition(p)||![halfWidth,halfLength,height,yaw].every(Number.isFinite)||Math.min(halfWidth,halfLength,height)<=0)
    throw new TypeError('Foot placement requires a finite sole center, yaw and positive boot dimensions');
}

function upright(source){
  if(!source||!['x','y','z','sx','sy','sz'].every(k=>Number.isFinite(source[k]))||Math.min(source.sx,source.sy,source.sz)<=0||source.dynamic||source.civilian||source.rx||source.rz)return null;
  let yaw=source.ry??0;
  // Dynamic AABBs and tilted tops are not horizontal support geometry. A yaw-only
  // quaternion is accepted only when it agrees with an explicitly supplied ry.
  if(source.quaternion){
    const q=source.quaternion;
    if(![q.x,q.y,q.z,q.w].every(Number.isFinite)||Math.abs(q.x)>EPS||Math.abs(q.z)>EPS||Math.abs(q.y*q.y+q.w*q.w-1)>1e-6)return null;
    const qYaw=2*Math.atan2(q.y,q.w);
    if(source.ry!==undefined&&Math.abs(Math.atan2(Math.sin(yaw-qYaw),Math.cos(yaw-qYaw)))>1e-6)return null;
    yaw=qYaw;
  }
  if(!Number.isFinite(yaw))return null;
  const box=yaw===(source.ry??0)?source:{...source,ry:yaw};
  return{source,box,yaw,axes:axes(yaw),top:box.y+box.sy/2,bottom:box.y-box.sy/2};
}

function rectangle(center,basis,hx,hz){
  return[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>({x:center.x+basis[0].x*hx*x+basis[1].x*hz*z,z:center.z+basis[0].z*hx*x+basis[1].z*hz*z}));
}
function area(poly){let sum=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];sum+=a.x*b.z-a.z*b.x;}return Math.abs(sum)/2;}
function clip(poly,n,b){
  const result=[];if(!poly.length)return result;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],next=poly[(i+1)%poly.length],da=dot(a,n)-b,db=dot(next,n)-b,ia=da<=EPS,ib=db<=EPS;
    if(ia)result.push(a);
    if(ia!==ib){const t=da/(da-db);result.push({x:a.x+(next.x-a.x)*t,z:a.z+(next.z-a.z)*t});}
  }
  return result;
}
function boxPlanes(item,extra=0){return item.axes.flatMap((n,i)=>{const half=(i===0?item.box.sx:item.box.sz)/2+extra,c=dot(item.box,n);return[{n,b:c+half},{n:{x:-n.x,z:-n.z},b:half-c}];});}
function contact(position,halfWidth,halfLength,bootAxes,item){
  let polygon=rectangle(position,bootAxes,halfWidth,halfLength);
  for(const {n,b} of boxPlanes(item))polygon=clip(polygon,n,b);
  const amount=area(polygon),dx=position.x-item.box.x,dz=position.z-item.box.z;
  const local={x:dx*item.axes[0].x+dz*item.axes[0].z,z:dx*item.axes[1].x+dz*item.axes[1].z};
  return{box:item.source,supportYaw:item.yaw,top:item.top,gap:position.y-item.top,area:amount,coverage:Math.min(1,amount/(4*halfWidth*halfLength)),centerInside:Math.abs(local.x)<=item.box.sx/2+EPS&&Math.abs(local.z)<=item.box.sz/2+EPS,centerLocal:local};
}

function footprintAxes(halfWidth,halfLength,bootAxes,item){
  return [...bootAxes,...item.axes].map(n=>({n,r:halfWidth*Math.abs(dot(n,bootAxes[0]))+halfLength*Math.abs(dot(n,bootAxes[1]))+item.box.sx/2*Math.abs(dot(n,item.axes[0]))+item.box.sz/2*Math.abs(dot(n,item.axes[1]))}));
}
function overlaps(position,projection,box,margin=0){
  const delta={x:position.x-box.x,z:position.z-box.z};
  return projection.every(({n,r})=>Math.abs(dot(delta,n))<r+margin-EPS);
}

/** Actual sole/top contact, with no horizontal skin or invented support plane.
 * A positive coverage can be a tiny heel contact; centerInside and coverage are
 * diagnostics, not a declaration that this is a suitable touchdown.
 */
export function queryFootSupport({position,halfWidth,halfLength,yaw=0,surfaces=[],maxGap=.02,penetrationTolerance=BOOT_CLEARANCE_TOP_TOLERANCE}={}){
  dimensions(position,halfWidth,halfLength,yaw);
  if(!Number.isFinite(maxGap)||!Number.isFinite(penetrationTolerance)||Math.min(maxGap,penetrationTolerance)<0)throw new TypeError('Foot support tolerances must be finite and nonnegative');
  const bootAxes=axes(yaw);let best=null;
  for(const source of surfaces){
    const item=upright(source);if(!item||source.walkable===false)continue;
    const gap=position.y-item.top;if(gap< -penetrationTolerance||gap>maxGap)continue;
    const result=contact(position,halfWidth,halfLength,bootAxes,item);if(result.area<=EPS)continue;
    if(!best||result.top>best.top+EPS||Math.abs(result.top-best.top)<=EPS&&result.area>best.area)best=result;
  }
  return best;
}

/** Expanded obstacle envelope for lift/advance/lower planning. Horizontal SAT
 * uses exactly the clearance solver's skin, on the same four upright OBB axes.
 * Nonwalkable solids still obstruct. This does not declare actual sole contact.
 * A caller must bound minTop/maxTop when choosing a reachable lift; a high wall
 * is deliberately not turned into a low, traversable support.
 */
export function queryBootObstacleEnvelope({position,halfWidth,halfLength,yaw=0,colliders=[],minTop=-Infinity,maxTop=Infinity}={}){
  dimensions(position,halfWidth,halfLength,yaw);
  if(!validRange(minTop,maxTop))throw new TypeError('Invalid obstacle top interval');
  const bootAxes=axes(yaw),obstacles=[];let top=null;
  for(const source of colliders){
    const item=upright(source);if(!item||item.top<minTop||item.top>maxTop)continue;
    const projection=footprintAxes(halfWidth,halfLength,bootAxes,item);
    if(!overlaps(position,projection,item.box,BOOT_CLEARANCE_SKIN))continue;
    obstacles.push({box:source,yaw:item.yaw,top:item.top,bottom:item.bottom,actualOverlap:overlaps(position,projection,item.box)});
    top=top===null?item.top:Math.max(top,item.top);
  }
  return{top,obstacles,skin:BOOT_CLEARANCE_SKIN};
}

function subtract(poly,planes){
  // Complement of a convex forbidden footprint. Each outside slice is retained
  // while the still-inside remainder advances to the next face. This discovers
  // valid side routes as well as the downhill half-plane, without assuming an
  // uphill direction or selecting a single obstacle face in advance.
  const regions=[];let inside=poly;
  for(const {n,b} of planes){
    const outside=clip(inside,{x:-n.x,z:-n.z},-b-OUTSIDE);
    if(outside.length>=3&&area(outside)>EPS)regions.push(outside);
    inside=clip(inside,n,b+OUTSIDE);if(inside.length<3||area(inside)<=EPS)break;
  }
  return regions;
}
function nearest(poly,p){
  let isInside=true,best=null,minimum=Infinity;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],dx=b.x-a.x,dz=b.z-a.z;
    if(dx*(p.z-a.z)-dz*(p.x-a.x)<-EPS)isInside=false;
    const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1))),q={x:a.x+t*dx,z:a.z+t*dz},d=(q.x-p.x)**2+(q.z-p.z)**2;
    if(d<minimum){minimum=d;best=q;}
  }
  return isInside?{x:p.x,z:p.z}:best;
}

/** Find a supported, collision-free endpoint for a horizontal boot.
 * This is endpoint selection, NOT a swing, root-reach, angular or temporal
 * sweep. The caller must plan the path and test pelvis/leg feasibility.
 *
 * `surfaces` must contain the current real support records. `colliders` are the
 * nearby upright static solids. The original records are never modified.
 * Returned supportYaw exposes normalized orientation even for quaternion-only
 * input; support itself retains the original record identity.
 * The real oriented center band is inset by centerMargin, even on short treads;
 * a center outside it is not rescued by a small heel/toe overlap. Higher solid
 * neighbors remove the full projected boot footprint plus collision skin from
 * this band. Rotated or mutually incompatible constraints return explicit no-fit.
 * Vertical tangency retains the clearance solver's existing 0.5mm numerical
 * tolerance; this is not a claim of zero overlap below that tolerance.
 */
export function selectSupportedTouchdown({desired,halfWidth,halfLength,height,yaw=0,surfaces=[],colliders=[],minTop=desired?.y-.3,maxTop=desired?.y+.3,maxDistance=.6,centerMargin=.08}={}){
  dimensions(desired,halfWidth,halfLength,yaw,height);
  if(!validRange(minTop,maxTop)||!Number.isFinite(maxDistance)||maxDistance<0||!Number.isFinite(centerMargin)||centerMargin<0)throw new TypeError('Invalid touchdown search bounds');
  const bootAxes=axes(yaw),obstacles=[...new Set([...colliders,...surfaces])].map(upright).filter(Boolean),rejected=[];let best=null;
  for(const source of [...new Set(surfaces)]){
    const support=upright(source);if(!support||source.walkable===false||support.top<minTop||support.top>maxTop)continue;
    const hx=support.box.sx/2-centerMargin,hz=support.box.sz/2-centerMargin;
    if(hx<=EPS||hz<=EPS){rejected.push({box:source,reason:'center-band-empty'});continue;}
    const band=rectangle(support.box,support.axes,hx,hz),closest=nearest(band,desired);
    if(Math.hypot(closest.x-desired.x,closest.z-desired.z)>maxDistance+EPS)continue;
    let regions=[band],tooComplex=false;
    for(const item of obstacles){
      if(item.top<=support.top+BOOT_CLEARANCE_TOP_TOLERANCE||item.bottom>=support.top+height-BOOT_CLEARANCE_TOP_TOLERANCE)continue;
      const projection=footprintAxes(halfWidth,halfLength,bootAxes,item);
      const planes=projection.flatMap(({n,r})=>{const c=dot(item.box,n),radius=r+BOOT_CLEARANCE_SKIN;return[{n,b:c+radius},{n:{x:-n.x,z:-n.z},b:radius-c}];});
      // A cheap polygon intersection avoids duplicating disjoint regions.
      const next=[];
      for(const region of regions){
        let intersection=region;for(const {n,b} of planes){intersection=clip(intersection,n,b);if(intersection.length<3)break;}
        if(intersection.length<3||area(intersection)<=EPS)next.push(region);else next.push(...subtract(region,planes));
      }
      regions=next;if(regions.length>MAX_REGIONS){tooComplex=true;break;}if(!regions.length)break;
    }
    if(tooComplex){rejected.push({box:source,reason:'geometry-complexity-limit'});continue;}
    if(!regions.length){rejected.push({box:source,reason:'no-clear-center-band'});continue;}
    let accepted=false;
    for(const region of regions){
      const p=nearest(region,desired),position={x:p.x,y:support.top,z:p.z},distance=Math.hypot(p.x-desired.x,p.z-desired.z);
      if(distance>maxDistance+EPS)continue;
      // Validate the complete prism at the chosen endpoint. Do not accept a
      // point repaired by the clearance solver as if it were the planned point.
      if(obstacles.some(item=>item.top>position.y+BOOT_CLEARANCE_TOP_TOLERANCE&&item.bottom<position.y+height-BOOT_CLEARANCE_TOP_TOLERANCE&&overlaps(position,footprintAxes(halfWidth,halfLength,bootAxes,item),item.box,BOOT_CLEARANCE_SKIN)))continue;
      const clearance=resolveBootClearance({from:position,to:position,halfWidth,halfLength,height,yaw,colliders:obstacles.map(item=>item.box)});
      if(clearance.blocked||clearance.unresolved||Math.hypot(clearance.position.x-position.x,clearance.position.z-position.z)>EPS)continue;
      const actual=contact(position,halfWidth,halfLength,bootAxes,support);if(!actual.centerInside||actual.area<=EPS)continue;
      const score=distance*distance+(position.y-desired.y)**2;accepted=true;
      if(!best||score<best.score-EPS)best={fit:true,position,support:source,supportYaw:support.yaw,top:support.top,coverage:actual.coverage,area:actual.area,centerLocal:actual.centerLocal,centerMargin,distance,contacts:clearance.contacts,reason:'supported-clear-endpoint',score};
    }
    if(!accepted)rejected.push({box:source,reason:'no-clear-center-in-range'});
  }
  if(best){delete best.score;return best;}
  return{fit:false,position:null,support:null,coverage:0,contacts:[],reason:rejected.length?'no-fitting-support':'no-eligible-support',rejected};
}
