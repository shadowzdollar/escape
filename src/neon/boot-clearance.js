import * as THREE from 'three';

export const BOOT_CLEARANCE_SKIN=.0015;
export const BOOT_CLEARANCE_TOP_TOLERANCE=.0005;
const SKIN=BOOT_CLEARANCE_SKIN,TOP_TOLERANCE=BOOT_CLEARANCE_TOP_TOLERANCE,EPS=1e-9,MAX_PASSES=8;
const valid=c=>c&&['x','y','z','sx','sy','sz'].every(k=>Number.isFinite(c[k]))&&Math.min(c.sx,c.sy,c.sz)>0;

/** Sweep a horizontal, yaw-oriented boot prism between world sole centers.
 * Upright static OBBs only. Supporting top contact is allowed; to.y is never
 * changed. Vertical-only conflicts are reported for the pose planner to reject.
 * The supplied yaw is fixed during this sweep. This is not an angular sweep.
 */
export function resolveBootClearance({from,to,halfWidth,halfLength,height,yaw=0,colliders=[]}={}){
  if(!from||!to||![from.x,from.y,from.z,to.x,to.y,to.z,halfWidth,halfLength,height,yaw].every(Number.isFinite)||Math.min(halfWidth,halfLength,height)<=0)throw new TypeError('Boot clearance requires finite sole positions and positive prism dimensions');
  const cs=Math.cos(yaw),sn=Math.sin(yaw),bootAxes=[{x:cs,z:-sn},{x:sn,z:cs}];
  const objects=[];
  for(let index=0;index<colliders.length;index++){
    const c=colliders[index];if(!valid(c)||c.dynamic||c.civilian||c.rx||c.rz||c.ry!==undefined&&!Number.isFinite(c.ry))continue;
    const top=c.y+c.sy/2,bottom=c.y-c.sy/2;
    if(Math.min(from.y,to.y)>=top-TOP_TOLERANCE||Math.max(from.y,to.y)+height<=bottom+TOP_TOLERANCE)continue;
    const cc=Math.cos(c.ry||0),ss=Math.sin(c.ry||0),hx=c.sx/2,hz=c.sz/2;
    const boxAxes=[{x:cc,z:-ss},{x:ss,z:cc}];
    const axes=[...bootAxes,...boxAxes].map(axis=>({x:axis.x,z:axis.z,r:
      halfWidth*Math.abs(axis.x*bootAxes[0].x+axis.z*bootAxes[0].z)+halfLength*Math.abs(axis.x*bootAxes[1].x+axis.z*bootAxes[1].z)+
      hx*Math.abs(axis.x*boxAxes[0].x+axis.z*boxAxes[0].z)+hz*Math.abs(axis.x*boxAxes[1].x+axis.z*boxAxes[1].z)}));
    objects.push({c,index,id:c.id??index,top,bottom,axes});
  }
  const position=new THREE.Vector3(from.x,from.y,from.z),goal=new THREE.Vector3(to.x,to.y,to.z),contacts=[];
  let blocked=false,unresolvedVertical=false;

  function overlap(p,object){
    if(p.y>=object.top-TOP_TOLERANCE||p.y+height<=object.bottom+TOP_TOLERANCE)return null;
    const dx=p.x-object.c.x,dz=p.z-object.c.z;let depth=Infinity,normal;
    for(const axis of object.axes){
      const d=dx*axis.x+dz*axis.z,penetration=axis.r-Math.abs(d);
      if(penetration<=EPS)return null;
      if(penetration<depth){depth=penetration;const sign=d<0?-1:1;normal={x:axis.x*sign,y:0,z:axis.z*sign};}
    }
    const verticalDepth=Math.min(object.top-p.y,p.y+height-object.bottom);
    if(verticalDepth<depth)return{depth:verticalDepth,normal:{x:0,y:p.y+height/2<object.c.y?-1:1,z:0}};
    return{depth,normal};
  }
  function record(object,normal,kind,time,p){
    blocked=true;contacts.push({id:object.id,index:object.index,kind,time,normal:{...normal},point:{x:p.x,y:p.y,z:p.z}});
  }
  // A changed pose may already overlap a solid. Resolve that endpoint in XZ,
  // explicitly reporting the recovery rather than calling it a clear sweep.
  for(let pass=0;pass<MAX_PASSES;pass++){
    let changed=false;
    for(const object of objects){const contact=overlap(position,object);if(!contact)continue;
      if(contact.normal.y){
        if(goal.y>=object.top-TOP_TOLERANCE||goal.y+height<=object.bottom+TOP_TOLERANCE)continue;
        record(object,contact.normal,'vertical',0,position);unresolvedVertical=true;break;
      }
      position.x+=contact.normal.x*(contact.depth+SKIN);position.z+=contact.normal.z*(contact.depth+SKIN);
      record(object,contact.normal,'initial-overlap',0,position);changed=true;
    }
    if(unresolvedVertical||!changed)break;
  }
  if(unresolvedVertical){position.y=to.y;return{position,blocked,contacts,unresolvedVertical:true,unresolved:true};}

  function sweep(a,b,object){
    const vx=b.x-a.x,vy=b.y-a.y,vz=b.z-a.z;let enter=-Infinity,exit=Infinity,normal=null;
    const intervals=[...object.axes.map(axis=>({d:(a.x-object.c.x)*axis.x+(a.z-object.c.z)*axis.z,v:vx*axis.x+vz*axis.z,r:axis.r+SKIN,x:axis.x,y:0,z:axis.z})),
      {d:a.y+height/2-object.c.y,v:vy,r:(height+object.c.sy)/2-TOP_TOLERANCE,x:0,y:1,z:0}];
    for(const axis of intervals){
      if(Math.abs(axis.v)<EPS){if(Math.abs(axis.d)>=axis.r)return null;continue;}
      let t0=(-axis.r-axis.d)/axis.v,t1=(axis.r-axis.d)/axis.v;
      if(t0>t1)[t0,t1]=[t1,t0];
      if(t0>enter){enter=t0;const sign=axis.v>0?-1:1;normal={x:axis.x*sign,y:axis.y*sign,z:axis.z*sign};}
      exit=Math.min(exit,t1);if(enter>exit)return null;
    }
    if(!normal||exit<=0||enter>1||enter>exit)return null;
    if(enter< -EPS){
      // An actual nonpenetrating start can lie inside the thin contact skin.
      // Block inward travel there, but allow tangent/outward travel to leave.
      let depth=Infinity,outward=null;
      for(const axis of object.axes){const d=(a.x-object.c.x)*axis.x+(a.z-object.c.z)*axis.z,p=axis.r+SKIN-Math.abs(d);if(p<depth){depth=p;const sign=d<0?-1:1;outward={x:axis.x*sign,y:0,z:axis.z*sign};}}
      if(depth>SKIN+EPS||!outward||vx*outward.x+vz*outward.z>=-EPS)return null;
      return{time:0,normal:outward,object};
    }
    return{time:Math.max(0,enter),normal,object};
  }
  for(let pass=0;pass<MAX_PASSES;pass++){
    let hit=null;
    for(const object of objects){const candidate=sweep(position,goal,object);if(candidate&&(!hit||candidate.time<hit.time))hit=candidate;}
    if(!hit){position.copy(goal);break;}
    position.lerp(goal,hit.time);record(hit.object,hit.normal,hit.normal.y?'vertical':'sweep',hit.time,position);
    if(hit.normal.y){unresolvedVertical=true;break;}
    const dx=goal.x-position.x,dz=goal.z-position.z,into=dx*hit.normal.x+dz*hit.normal.z;
    if(into<0){goal.x-=hit.normal.x*into;goal.z-=hit.normal.z*into;}
    if(Math.abs(goal.x-position.x)+Math.abs(goal.z-position.z)+Math.abs(goal.y-position.y)<EPS)break;
  }
  position.y=to.y;
  // A vertical obstruction is intentionally unresolved: changing the requested
  // sole elevation here would silently override the caller's support/trajectory.
  const unresolved=unresolvedVertical||objects.some(object=>Boolean(overlap(position,object)));
  return{position,blocked,contacts,unresolvedVertical,unresolved};
}
