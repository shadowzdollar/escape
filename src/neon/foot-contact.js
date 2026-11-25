import * as THREE from 'three';

const clamp=THREE.MathUtils.clamp;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const validBox=c=>c&&['x','y','z','sx','sy','sz'].every(k=>Number.isFinite(c[k]))&&Math.min(c.sx,c.sy,c.sz)>0;
const inside=(x,z,c,slack=0)=>{const cs=Math.cos(c.ry||0),sn=Math.sin(c.ry||0),dx=x-c.x,dz=z-c.z;return Math.abs(dx*cs-dz*sn)<=c.sx/2+slack&&Math.abs(dx*sn+dz*cs)<=c.sz/2+slack;};

/** Share movement's authored physical ground with both foot systems. Thin
 * physical slabs remain valid; the thickness cutoff applies only to additional
 * pavement boxes, where thinner pieces may be nonphysical surface decoration.
 * Keep the original object identities for support lifecycle and deduplication.
 */
export function collectFootSupportSurfaces({groundSurfaces=[],boxes=[]}={}){
  return [...new Set([...groundSurfaces,...boxes.filter(box=>box?.kind==='pavement'&&box.sy>=.025)])];
}

export function createFootContactUniforms(){return{
  uFootContactCenter:{value:[new THREE.Vector4(),new THREE.Vector4()]},
  uFootContactShape:{value:[new THREE.Vector4(1,0,0,0),new THREE.Vector4(1,0,0,0)]},
  uFootContactPlane:{value:[new THREE.Vector4(0,1,0,0),new THREE.Vector4(0,1,0,0)]},
  uFootContactSupport:{value:[new THREE.Vector4(),new THREE.Vector4()]},
  uFootContactSupportAxis:{value:[new THREE.Vector2(1,0),new THREE.Vector2(1,0)]},
  uFootContactParams:{value:new THREE.Vector4(.28,.10,.012,.75)},
};}
export const footContactUniforms=createFootContactUniforms();

const FOOT_GLSL=`
uniform vec4 uFootContactCenter[2];
uniform vec4 uFootContactShape[2];
uniform vec4 uFootContactPlane[2];
uniform vec4 uFootContactSupport[2];
uniform vec2 uFootContactSupportAxis[2];
uniform vec4 uFootContactParams;
float footContactAmount(vec3 p,vec3 n){
  float result=0.;
  if(uFootContactParams.x>0. && n.y>uFootContactParams.w){
    for(int i=0;i<2;i++){
      vec4 center=uFootContactCenter[i];
      if(center.w>0. && abs(p.y-center.y)<uFootContactParams.z){
        vec4 support=uFootContactSupport[i];vec2 supportAxis=uFootContactSupportAxis[i];
        vec2 offset=p.xz-support.xy;
        vec2 receiver=vec2(dot(offset,supportAxis),dot(offset,vec2(-supportAxis.y,supportAxis.x)));
        if(max(abs(receiver.x)-support.z,abs(receiver.y)-support.w)<=.0005){
          vec4 shape=uFootContactShape[i];vec2 delta=p.xz-center.xz;
          vec2 footprint=vec2(dot(delta,shape.xy),dot(delta,vec2(-shape.y,shape.x)));
          float outside=length(max(abs(footprint)-shape.zw,vec2(0.)));
          float falloff=1.-smoothstep(0.,uFootContactParams.y,outside);
          vec4 plane=uFootContactPlane[i];
          float soleY=-(plane.x*p.x+plane.z*p.z+plane.w)/max(.001,plane.y);
          float gap=1.-smoothstep(.015,.08,soleY-center.y);
          float level=1.-smoothstep(uFootContactParams.z*.5,uFootContactParams.z,abs(p.y-center.y));
          result=max(result,center.w*falloff*gap*level*smoothstep(uFootContactParams.w,.98,n.y));
        }
      }
    }
  }
  return clamp(result,0.,1.);
}
`;

/** Receiver AO only: follow the installed Three aomap_fragment accumulation.
 * Existing callers supply world-space position/normal varyings themselves.
 */
export function injectFootContactAO(shader,{worldPosition='vSurfaceWorld',worldNormal='vSurfaceNormal',uniforms=footContactUniforms}={}){
  if(shader.fragmentShader.includes('float footContactAmount('))return;
  if(!shader.fragmentShader.includes('#include <aomap_fragment>'))throw new Error('Foot contact requires the Standard material AO stage');
  Object.assign(shader.uniforms,uniforms);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+FOOT_GLSL)
    .replace('#include <aomap_fragment>',`#include <aomap_fragment>
      // Zero contribution is exactly the identity in Three's AO equations.
      // Skip normal/foot evaluation for inactive feet and specular pow elsewhere.
      if(uFootContactParams.x>0. && max(uFootContactCenter[0].w,uFootContactCenter[1].w)>0.){
        float footContactCoverage=footContactAmount(${worldPosition},normalize(${worldNormal}));
        if(footContactCoverage>0.){
          float footContactAO=1.-uFootContactParams.x*footContactCoverage;
          reflectedLight.indirectDiffuse*=footContactAO;
          #if defined(USE_CLEARCOAT)
            clearcoatSpecularIndirect*=footContactAO;
          #endif
          #if defined(USE_SHEEN)
            sheenSpecularIndirect*=footContactAO;
          #endif
          #if defined(USE_ENVMAP) && defined(STANDARD)
            float footContactDotNV=saturate(dot(geometryNormal,geometryViewDir));
            reflectedLight.indirectSpecular*=computeSpecularOcclusion(footContactDotNV,footContactAO,material.roughness);
          #endif
        }
      }`);
}

/** Cache real unbatched GLB geometry in the final moving boot frame.
 * Older assets have a single rigid leg; retain their hip-frame fallback.
 */
export function cacheBootSole(avatar,name){
  const side=/^(left|right)_(?:leg|foot)$/.exec(name)?.[1];
  const joint=side?(avatar.getObjectByName(`${side}_foot`)||avatar.getObjectByName(`${side}_leg`)):avatar.getObjectByName(name);if(!joint)return null;
  avatar.updateWorldMatrix(true,true);
  const inverse=joint.matrixWorld.clone().invert(),vertices=[],point=new THREE.Vector3();
  joint.traverse(mesh=>{if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;
    const transform=inverse.clone().multiply(mesh.matrixWorld),attribute=mesh.geometry.attributes.position;
    for(let i=0;i<attribute.count;i++)vertices.push(point.fromBufferAttribute(attribute,i).applyMatrix4(transform).clone());
  });
  if(!vertices.length)return null;
  const minimumY=Math.min(...vertices.map(p=>p.y)),sole=vertices.filter(p=>p.y<=minimumY+.002);
  const minX=Math.min(...sole.map(p=>p.x)),maxX=Math.max(...sole.map(p=>p.x)),minZ=Math.min(...sole.map(p=>p.z)),maxZ=Math.max(...sole.map(p=>p.z));
  if(maxX-minX<.025||maxZ-minZ<.025)return null;
  return{name,frameName:joint.name,joint,geometryVertexCount:vertices.length,soleVertexCount:sole.length,localBounds:{minX,maxX,minZ,maxZ,y:minimumY},
    localQuad:[new THREE.Vector3(minX,minimumY,minZ),new THREE.Vector3(maxX,minimumY,minZ),new THREE.Vector3(maxX,minimumY,maxZ),new THREE.Vector3(minX,minimumY,maxZ)],
    soleQuad:Array.from({length:4},()=>new THREE.Vector3()),support:null,gain:0,reason:'uninitialized'};
}

/** Nine points retain heel/toe support at an edge without inventing a floor. */
export function resolveFootSupport(quad,colliders,{maxGap=.08,penetrationTolerance=.016}={}){
  const probes=[...quad];
  for(let i=0;i<4;i++)probes.push(quad[i].clone().add(quad[(i+1)%4]).multiplyScalar(.5));
  probes.push(quad[0].clone().add(quad[1]).add(quad[2]).add(quad[3]).multiplyScalar(.25));
  let chosen=null;
  for(const c of colliders){
    // Dynamic AABBs can bound a tilted car/bin without describing its top face.
    // Their fictitious horizontal top is not an eligible receiving support.
    if(!validBox(c)||c.civilian||c.dynamic||c.walkable===false||c.rx||c.rz)continue;
    const y=c.y+c.sy/2;let gap=Infinity,count=0;
    for(const probe of probes)if(inside(probe.x,probe.z,c,.0005)){gap=Math.min(gap,probe.y-y);count++;}
    if(!count||gap< -penetrationTolerance||gap>maxGap)continue;
    if(!chosen||y>chosen.top+.0001||Math.abs(y-chosen.top)<=.0001&&count>chosen.probeCount)chosen={box:c,top:y,gap,probeCount:count};
  }
  return chosen;
}

function surfaceIndex(surfaces){
  const cellSize=12,cells=new Map();
  for(const box of surfaces){if(!validBox(box))continue;
    const c=Math.abs(Math.cos(box.ry||0)),s=Math.abs(Math.sin(box.ry||0)),hx=(c*box.sx+s*box.sz)/2,hz=(s*box.sx+c*box.sz)/2;
    for(let x=Math.floor((box.x-hx)/cellSize);x<=Math.floor((box.x+hx)/cellSize);x++)for(let z=Math.floor((box.z-hz)/cellSize);z<=Math.floor((box.z+hz)/cellSize);z++){const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(box);}
  }
  return(x,z,radius)=>{const found=new Set();for(let ix=Math.floor((x-radius)/cellSize);ix<=Math.floor((x+radius)/cellSize);ix++)for(let iz=Math.floor((z-radius)/cellSize);iz<=Math.floor((z+radius)/cellSize);iz++)for(const b of cells.get(ix+','+iz)||[])found.add(b);return [...found];};
}

export function createFootContact({avatar,getColliders=()=>[],supportSurfaces=[],uniforms=footContactUniforms,strength=.28,outsideFalloff=.10}={}){
  if(!avatar?.isObject3D)throw new TypeError('Foot contact requires the actual avatar Object3D');
  const feet=['left_leg','right_leg'].map(name=>cacheBootSole(avatar,name));
  const querySurfaces=surfaceIndex(supportSurfaces),center=new THREE.Vector3(),edgeX=new THREE.Vector3(),edgeZ=new THREE.Vector3(),normal=new THREE.Vector3();
  let enabled=true,disposed=false,lastReason='uninitialized',candidateCount=0;
  const amount=clamp(strength,0,.30);uniforms.uFootContactParams.value.set(amount,Math.max(.025,outsideFalloff),.012,.75);
  function clear(reason){lastReason=reason;for(let i=0;i<2;i++){uniforms.uFootContactCenter.value[i].w=0;if(feet[i]){feet[i].support=null;feet[i].gain=0;feet[i].reason=reason;}}}
  function update({grounded=true,inVehicle=false,active=true}={}){
    if(disposed)return;
    avatar.updateWorldMatrix(true,false);
    for(const foot of feet)if(foot){foot.joint.updateWorldMatrix(true,false);for(let i=0;i<4;i++)foot.soleQuad[i].copy(foot.localQuad[i]).applyMatrix4(foot.joint.matrixWorld);}
    if(!active||!avatar.visible||inVehicle||!grounded){clear(inVehicle?'vehicle':!active||!avatar.visible?'hidden':'airborne');return;}
    center.set(0,0,0);let total=0;
    for(const foot of feet)if(foot)for(const corner of foot.soleQuad){center.add(corner);total++;}
    if(!total){clear('missing boot geometry');return;}center.multiplyScalar(1/total);
    let radius=outsideFalloff+.1;for(const foot of feet)if(foot)for(const p of foot.soleQuad)radius=Math.max(radius,Math.hypot(p.x-center.x,p.z-center.z)+outsideFalloff+.1);
    const candidates=[...querySurfaces(center.x,center.z,radius),...(getColliders(center.x,center.z,radius)||[])].filter(c=>{
      if(!validBox(c))return false;const cs=Math.abs(Math.cos(c.ry||0)),sn=Math.abs(Math.sin(c.ry||0));return Math.abs(c.x-center.x)<=radius+(cs*c.sx+sn*c.sz)/2&&Math.abs(c.z-center.z)<=radius+(sn*c.sx+cs*c.sz)/2;
    });
    candidateCount=candidates.length;lastReason='updated';
    for(let i=0;i<2;i++){
      const foot=feet[i];uniforms.uFootContactCenter.value[i].w=0;if(!foot)continue;
      foot.support=resolveFootSupport(foot.soleQuad,candidates);foot.gain=0;
      if(!foot.support){foot.reason='no nearby supported sole';continue;}
      const q=foot.soleQuad;edgeX.copy(q[1]).sub(q[0]);edgeZ.copy(q[3]).sub(q[0]);normal.crossVectors(edgeZ,edgeX).normalize();
      if(normal.y<.55){foot.reason='sole tilted away';continue;}
      const cx=(q[0].x+q[2].x)/2,cz=(q[0].z+q[2].z)/2,axisLength=Math.hypot(edgeX.x,edgeX.z);
      if(axisLength<.001){foot.reason='degenerate footprint';continue;}
      const ax=edgeX.x/axisLength,az=edgeX.z/axisLength;let hx=0,hz=0;
      for(const p of q){hx=Math.max(hx,Math.abs((p.x-cx)*ax+(p.z-cz)*az));hz=Math.max(hz,Math.abs(-(p.x-cx)*az+(p.z-cz)*ax));}
      const support=foot.support.box;foot.gain=1-smooth(.015,.08,Math.max(0,foot.support.gap));foot.reason=foot.gain?'contact':'lifted';
      uniforms.uFootContactCenter.value[i].set(cx,foot.support.top,cz,foot.gain);
      uniforms.uFootContactShape.value[i].set(ax,az,hx,hz);
      uniforms.uFootContactPlane.value[i].set(normal.x,normal.y,normal.z,-normal.dot(q[0]));
      uniforms.uFootContactSupport.value[i].set(support.x,support.z,support.sx/2,support.sz/2);
      uniforms.uFootContactSupportAxis.value[i].set(Math.cos(support.ry||0),-Math.sin(support.ry||0));
    }
  }
  function setEnabled(value){enabled=Boolean(value);uniforms.uFootContactParams.value.x=enabled?amount:0;return enabled;}
  function getState(){return{enabled,approximation:'short-range receiver ambient occlusion',candidateCount,lastReason,strength:amount,outsideFalloff,
    feet:feet.map((foot,i)=>foot?{name:foot.name,frameName:foot.frameName,reason:foot.reason,gain:foot.gain,soleQuad:foot.soleQuad.map(p=>p.toArray()),localBounds:{...foot.localBounds},geometryVertexCount:foot.geometryVertexCount,soleVertexCount:foot.soleVertexCount,supportTop:foot.support?.top??null,gap:foot.support?.gap??null,support:foot.support?{id:foot.support.box.id??null,x:foot.support.box.x,y:foot.support.box.y,z:foot.support.box.z,sx:foot.support.box.sx,sy:foot.support.box.sy,sz:foot.support.box.sz,ry:foot.support.box.ry||0,probeCount:foot.support.probeCount}:null,uniforms:{center:uniforms.uFootContactCenter.value[i].toArray(),shape:uniforms.uFootContactShape.value[i].toArray(),plane:uniforms.uFootContactPlane.value[i].toArray(),support:uniforms.uFootContactSupport.value[i].toArray(),supportAxis:uniforms.uFootContactSupportAxis.value[i].toArray()}}:null)};}
  clear('uninitialized');
  return{update,setEnabled,getState,reset:()=>clear('reset'),dispose(){disposed=true;clear('disposed');},uniforms};
}

/** CPU reference for support/falloff tests; no renderer or final-color model. */
export function sampleFootContact(uniforms,point,normalY=1){
  const params=uniforms.uFootContactParams.value;if(params.x<=0||normalY<=params.w)return 1;let maximum=0;
  for(let i=0;i<2;i++){
    const center=uniforms.uFootContactCenter.value[i],shape=uniforms.uFootContactShape.value[i],support=uniforms.uFootContactSupport.value[i],axis=uniforms.uFootContactSupportAxis.value[i],plane=uniforms.uFootContactPlane.value[i];
    if(!center.w||Math.abs(point.y-center.y)>=params.z)continue;
    const dx=point.x-support.x,dz=point.z-support.y;
    if(Math.max(Math.abs(dx*axis.x+dz*axis.y)-support.z,Math.abs(-dx*axis.y+dz*axis.x)-support.w)>.0005)continue;
    const fx=point.x-center.x,fz=point.z-center.z,outside=Math.hypot(Math.max(0,Math.abs(fx*shape.x+fz*shape.y)-shape.z),Math.max(0,Math.abs(-fx*shape.y+fz*shape.x)-shape.w));
    const soleY=-(plane.x*point.x+plane.z*point.z+plane.w)/Math.max(.001,plane.y);
    maximum=Math.max(maximum,center.w*(1-smooth(0,params.y,outside))*(1-smooth(.015,.08,soleY-center.y))*(1-smooth(params.z*.5,params.z,Math.abs(point.y-center.y)))*smooth(params.w,.98,normalY));
  }
  return 1-params.x*clamp(maximum,0,1);
}
