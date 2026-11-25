import * as THREE from 'three';

const CELL=32,FRUSTUM_WIDTH=104,MAP_SIZE=2048,REFRESH_DISTANCE=4,SELECTION_MARGIN=12;
const finiteBox=b=>b&&['x','y','z','sx','sy','sz'].every(k=>Number.isFinite(b[k]))&&Math.min(b.sx,b.sy,b.sz)>0;

/** One local directional shadow map; no added lights, shadow discs, or scene color.
 * Call update once immediately before the frame's first scene render. The map is
 * then reused by additional renders, including Three's planar Reflector pass.
 * Existing moving casters remain enabled. addCaster enables a newly loaded car
 * or avatar; do not register the camera's first-person weapon/arms.
 */
export function createCityShadows({scene,renderer,moon,city}) {
  if(!scene?.isScene||!moon?.isDirectionalLight||!renderer?.shadowMap)throw new TypeError('City shadows require a scene, renderer, and directional moon light');
  const shadow=moon.shadow,camera=shadow.camera,half=FRUSTUM_WIDTH/2,texel=FRUSTUM_WIDTH/MAP_SIZE;
  const original={enabled:renderer.shadowMap.enabled,type:renderer.shadowMap.type,autoUpdate:renderer.shadowMap.autoUpdate,
    castShadow:moon.castShadow,lightPosition:moon.position.clone(),targetPosition:moon.target.position.clone(),targetParent:moon.target.parent,
    mapSize:shadow.mapSize.clone(),shadowAutoUpdate:shadow.autoUpdate,bias:shadow.bias,normalBias:shadow.normalBias,radius:shadow.radius,
    near:camera.near,far:camera.far,left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom};
  scene.updateMatrixWorld(true);
  const lightDirection=new THREE.Vector3().subVectors(moon.getWorldPosition(new THREE.Vector3()),moon.target.getWorldPosition(new THREE.Vector3())).normalize();
  if(lightDirection.y<.25)throw new RangeError('Local city shadows require the moon at least 15 degrees above the horizon');
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),lightDirection).normalize();
  const up=new THREE.Vector3().crossVectors(lightDirection,right).normalize();
  const center=new THREE.Vector3(),lastSelection=new THREE.Vector3(Infinity,Infinity,Infinity),lightPosition=new THREE.Vector3();
  const grid=new Map(),source=[],disabledStatic=[],casterRestores=new Set(),dummy=new THREE.Object3D();
  const halfGroundX=half*(Math.abs(right.x)+Math.abs(up.x-lightDirection.x*up.y/lightDirection.y));
  const halfGroundZ=half*(Math.abs(right.z)+Math.abs(up.z-lightDirection.z*up.y/lightDirection.y));
  let maxTop=1,disposed=false,selectedIds=[];
  const stats={mapSize:MAP_SIZE,frustumWidth:FRUSTUM_WIDTH,texelSize:texel,sourceShapes:0,indexedShapes:0,
    activeProxies:0,disabledStaticBatches:0,proxyRefreshes:0,shadowUpdates:0,proxyDrawCalls:1};

  // Index the *shadow footprint*, not just the source building's ground parcel:
  // a tall tower outside the local street can still cast into the visible area.
  for(const b of [...(city?.colliders||[]),...(city?.streetColliders||[])]){
    stats.sourceShapes++;
    if(!finiteBox(b)||b.y+b.sy/2<=.25||b.sx*b.sy*b.sz<.025)continue;
    const angle=b.ry||0,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
    const hx=(b.sx*c+b.sz*s)/2,hz=(b.sx*s+b.sz*c)/2,low=b.y-b.sy/2,high=b.y+b.sy/2;
    const groundY=city?.groundHeightAt?.(b.x,b.z)??.057;
    const ox0=-lightDirection.x/lightDirection.y*(low-groundY),ox1=-lightDirection.x/lightDirection.y*(high-groundY);
    const oz0=-lightDirection.z/lightDirection.y*(low-groundY),oz1=-lightDirection.z/lightDirection.y*(high-groundY);
    const projected={minX:b.x-hx+Math.min(ox0,ox1),maxX:b.x+hx+Math.max(ox0,ox1),minZ:b.z-hz+Math.min(oz0,oz1),maxZ:b.z+hz+Math.max(oz0,oz1)};
    const index=source.length;source.push({box:b,projected});maxTop=Math.max(maxTop,high);
    for(let x=Math.floor(projected.minX/CELL);x<=Math.floor(projected.maxX/CELL);x++)for(let z=Math.floor(projected.minZ/CELL);z<=Math.floor(projected.maxZ/CELL);z++){
      const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(index);
    }
  }
  stats.indexedShapes=source.length;
  const distance=maxTop/lightDirection.y+FRUSTUM_WIDTH+10;
  const geometry=new THREE.BoxGeometry(1,1,1);
  const material=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,depthTest:true,shadowSide:THREE.BackSide});
  const depthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.BackSide});
  const proxies=new THREE.InstancedMesh(geometry,material,Math.max(1,source.length));
  proxies.name='Local city / invisible-output shadow occluders';proxies.count=0;proxies.castShadow=true;proxies.receiveShadow=false;
  proxies.frustumCulled=false;proxies.customDepthMaterial=depthMaterial;proxies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  proxies.userData.cityShadowProxy=true;scene.add(proxies);
  // Only the authored static batches are replaced. Citizens, cars, debris and
  // any separately registered moving mesh retain their own real silhouette.
  city?.root?.traverse(object=>{
    if(object.isMesh&&object.name.startsWith('Shared Blender city / ')){
      disabledStatic.push([object,object.castShadow]);object.castShadow=false;
    }
  });
  stats.disabledStaticBatches=disabledStatic.length;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
  moon.castShadow=true;shadow.autoUpdate=false;shadow.mapSize.set(MAP_SIZE,MAP_SIZE);
  shadow.bias=-.000015;shadow.normalBias=.045;shadow.radius=1.25;
  Object.assign(camera,{left:-half,right:half,top:half,bottom:-half,near:.5,far:distance+FRUSTUM_WIDTH+30});camera.updateProjectionMatrix();
  if(shadow.map){shadow.map.dispose();shadow.map=null;}
  if(!moon.target.parent)scene.add(moon.target);

  function select(px,pz,groundY){
    const xRadius=halfGroundX+SELECTION_MARGIN,zRadius=halfGroundZ+SELECTION_MARGIN,candidates=new Set();
    for(let x=Math.floor((px-xRadius)/CELL);x<=Math.floor((px+xRadius)/CELL);x++)for(let z=Math.floor((pz-zRadius)/CELL);z<=Math.floor((pz+zRadius)/CELL);z++)for(const index of grid.get(x+','+z)||[])candidates.add(index);
    let count=0;selectedIds=[];
    for(const index of candidates){
      const {box:b,projected:p}=source[index];
      if(p.maxX<px-xRadius||p.minX>px+xRadius||p.maxZ<pz-zRadius||p.minZ>pz+zRadius)continue;
      dummy.position.set(b.x,b.y,b.z);dummy.rotation.set(0,b.ry||0,0);dummy.scale.set(b.sx,b.sy,b.sz);dummy.updateMatrix();
      proxies.setMatrixAt(count++,dummy.matrix);selectedIds.push(b.id??index);
    }
    proxies.count=count;proxies.instanceMatrix.clearUpdateRanges();if(count)proxies.instanceMatrix.addUpdateRange(0,count*16);
    proxies.instanceMatrix.needsUpdate=true;stats.activeProxies=count;stats.proxyRefreshes++;
    lastSelection.set(px,groundY,pz);
  }
  function update(playerPosition){
    if(disposed||!playerPosition||!Number.isFinite(playerPosition.x+playerPosition.z))return;
    const groundY=city?.groundHeightAt?.(playerPosition.x,playerPosition.z)??.057;
    center.set(playerPosition.x,groundY,playerPosition.z);
    // Snap in the light's image plane rather than world X/Z. This preserves the
    // same texel lattice when walking diagonally past a wall or moving a camera.
    const u=center.dot(right),v=center.dot(up);
    center.addScaledVector(right,Math.round(u/texel)*texel-u).addScaledVector(up,Math.round(v/texel)*texel-v);
    lightPosition.copy(center).addScaledVector(lightDirection,distance);
    moon.position.copy(moon.parent?moon.parent.worldToLocal(lightPosition.clone()):lightPosition);
    moon.target.position.copy(moon.target.parent?moon.target.parent.worldToLocal(center.clone()):center);
    moon.updateWorldMatrix(true,false);moon.target.updateWorldMatrix(true,false);
    if(Math.hypot(playerPosition.x-lastSelection.x,playerPosition.z-lastSelection.z)>=REFRESH_DISTANCE||Math.abs(groundY-lastSelection.y)>1)select(playerPosition.x,playerPosition.z,groundY);
    shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;stats.shadowUpdates++;
  }
  function addCaster(object,{receiveShadow=true}={}){
    const changed=[];
    object?.traverse(child=>{
      if(!child.isMesh||child.userData.cityShadowProxy)return;
      const materials=Array.isArray(child.material)?child.material:[child.material];
      if(materials.every(m=>!m||m.isShaderMaterial||(m.transparent&&m.opacity<.95)))return;
      changed.push([child,child.castShadow,child.receiveShadow]);child.castShadow=true;child.receiveShadow=receiveShadow;
    });
    const restore=()=>{for(const [child,cast,receive] of changed){child.castShadow=cast;child.receiveShadow=receive;}casterRestores.delete(restore);};
    casterRestores.add(restore);return restore;
  }
  function getState(){return{...stats,lightDirection:lightDirection.toArray(),center:center.toArray(),activeSourceIds:[...selectedIds]};}
  function dispose(){
    if(disposed)return;disposed=true;scene.remove(proxies);geometry.dispose();material.dispose();depthMaterial.dispose();
    for(const [object,castShadow] of disabledStatic)object.castShadow=castShadow;
    for(const restore of [...casterRestores])restore();
    renderer.shadowMap.enabled=original.enabled;renderer.shadowMap.type=original.type;renderer.shadowMap.autoUpdate=original.autoUpdate;renderer.shadowMap.needsUpdate=true;
    moon.castShadow=original.castShadow;moon.position.copy(original.lightPosition);moon.target.position.copy(original.targetPosition);
    if(!original.targetParent)moon.target.removeFromParent();
    shadow.autoUpdate=original.shadowAutoUpdate;shadow.mapSize.copy(original.mapSize);shadow.bias=original.bias;shadow.normalBias=original.normalBias;shadow.radius=original.radius;
    for(const key of ['near','far','left','right','top','bottom'])camera[key]=original[key];camera.updateProjectionMatrix();
    if(shadow.map){shadow.map.dispose();shadow.map=null;}shadow.needsUpdate=true;
  }
  return{update,addCaster,getState,dispose,proxies};
}
