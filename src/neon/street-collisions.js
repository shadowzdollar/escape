import { SCENE_PLACEMENTS } from './asset-placements.js';
import assetManifest from './data/asset-manifest.json' with { type: 'json' };

const FLOOR_Y = .057;
const STREET_HEIGHT = 5.5;
const CELL = 32;
const EPSILON = 1e-6;

function finiteBox(box) {
  return ['x','y','z','sx','sy','sz'].every(key => Number.isFinite(box[key])) &&
    box.sx > 0 && box.sy > 0 && box.sz > 0 && Number.isFinite(box.ry || 0);
}

function footprint(box) {
  const c=Math.abs(Math.cos(box.ry||0)),s=Math.abs(Math.sin(box.ry||0));
  const x=(box.sx*c+box.sz*s)/2,z=(box.sz*c+box.sx*s)/2;
  return {minX:box.x-x,maxX:box.x+x,minZ:box.z-z,maxZ:box.z+z};
}

function contained(inner,outer) {
  if(inner.y-inner.sy/2 < outer.y-outer.sy/2-EPSILON || inner.y+inner.sy/2 > outer.y+outer.sy/2+EPSILON) return false;
  const c=Math.cos(inner.ry||0),s=Math.sin(inner.ry||0),oc=Math.cos(outer.ry||0),os=Math.sin(outer.ry||0);
  for(const dx of [-inner.sx/2,inner.sx/2])for(const dz of [-inner.sz/2,inner.sz/2]) {
    const x=inner.x+dx*c+dz*s-outer.x,z=inner.z-dx*s+dz*c-outer.z;
    if(Math.abs(x*oc-z*os)>outer.sx/2+EPSILON || Math.abs(x*os+z*oc)>outer.sz/2+EPSILON) return false;
  }
  return true;
}

/**
 * Collision shapes derive from the visible authored street geometry. Shapes
 * remain individual oriented boxes so the physics layer can batch them into
 * compound bodies without filling the gaps in benches, railings or gateways.
 * The input layout is never changed; removedBoxes contains its original refs.
 */
export function createStreetCollisionLayout(layout,{excludedBoxIds=new Set()}={}) {
  const boxes=layout.boxes||[],staticColliders=[],dynamicProps=[],removedBoxes=new Set();
  const groundSurfaces=boxes.filter(box=>finiteBox(box)&&box.lod!=='far'&&box.kind==='pavement'&&
    box.sx>=1&&box.sz>=1&&box.y+box.sy/2>=.08&&box.y+box.sy/2<=.4);
  const groundAt=(x,z)=>groundSurfaces.reduce((height,box)=>{
    const c=Math.cos(box.ry||0),s=Math.sin(box.ry||0),dx=x-box.x,dz=z-box.z;
    return Math.abs(dx*c-dz*s)<=box.sx/2&&Math.abs(dx*s+dz*c)<=box.sz/2?Math.max(height,box.y+box.sy/2):height;
  },FLOOR_Y);

  // The original bins consist of exactly a metal body, metal lid and front
  // label. Replace those 36 baked modules with twelve complete dynamic props.
  // Index by authored centers to retain reference identity and avoid fuzzy
  // searches that could accidentally detach adjacent vending-machine details.
  const centers=new Map();
  const centerKey=(x,y,z)=>[x,y,z].map(value=>Math.round(value*10000)).join(',');
  for(const box of boxes) {
    const key=centerKey(box.x,box.y,box.z);
    if(!centers.has(key))centers.set(key,[]);centers.get(key).push(box);
  }
  function findPart(x,y,z,sx,sy,sz,kind) {
    return (centers.get(centerKey(x,y,z))||[]).find(box=>box.kind===kind&&box.lod!=='far'&&
      Math.abs(box.sx-sx)<EPSILON&&Math.abs(box.sy-sy)<EPSILON&&Math.abs(box.sz-sz)<EPSILON);
  }
  for(const side of [-1,1])for(let i=0;i<11;i+=2) {
    const x=side*14.4,z=34-i*19;
    const original=[findPart(x,.6,z,.7,1.05,.65,'metal'),findPart(x,1.17,z,.77,.08,.72,'metal'),findPart(x,.94,z+.34,.46,.14,.035,'solid')];
    if(original.some(part=>!part))continue;
    const minY=Math.min(...original.map(p=>p.y-p.sy/2)),maxY=Math.max(...original.map(p=>p.y+p.sy/2));
    const minX=Math.min(...original.map(p=>p.x-p.sx/2)),maxX=Math.max(...original.map(p=>p.x+p.sx/2));
    const minZ=Math.min(...original.map(p=>p.z-p.sz/2)),maxZ=Math.max(...original.map(p=>p.z+p.sz/2));
    const floor=Math.max(...[[minX,minZ],[maxX,minZ],[minX,maxZ],[maxX,maxZ],[x,z]].map(([px,pz])=>groundAt(px,pz)));
    const lift=floor-minY;
    const parts=original.map(part=>({...part,y:part.y+lift}));
    original.forEach(part=>removedBoxes.add(part));
    dynamicProps.push({id:`STREET-BIN-${side<0?'W':'E'}-${String(i/2+1).padStart(2,'0')}`,kind:'bin',
      x:(minX+maxX)/2,y:(minY+maxY)/2+lift,z:(minZ+maxZ)/2,
      sx:maxX-minX,sy:maxY-minY,sz:maxZ-minZ,ry:0,mass:16,groundY:floor,parts});
  }

  const solidBuildings=(layout.colliders||[]).filter(finiteBox),grid=new Map();
  for(const building of solidBuildings) {
    const bounds=footprint(building);
    for(let x=Math.floor(bounds.minX/CELL);x<=Math.floor(bounds.maxX/CELL);x++)for(let z=Math.floor(bounds.minZ/CELL);z<=Math.floor(bounds.maxZ/CELL);z++) {
      const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(building);
    }
  }
  for(let index=0;index<boxes.length;index++) {
    const box=boxes[index];
    if(!finiteBox(box)||box.lod==='far'||removedBoxes.has(box)||excludedBoxIds.has(box.id)||!['solid','metal'].includes(box.kind))continue;
    if(box.y+box.sy/2<=FLOOR_Y+EPSILON||box.y-box.sy/2>=STREET_HEIGHT-EPSILON)continue;
    // A containing box necessarily contains the candidate's center, so one
    // spatial bucket is enough even for rotated or very large architecture.
    const candidates=grid.get(Math.floor(box.x/CELL)+','+Math.floor(box.z/CELL))||[];
    if(candidates.some(building=>contained(box,building)))continue;
    staticColliders.push({id:`STREET-VOXEL-${index}`,x:box.x,y:box.y,z:box.z,sx:box.sx,sy:box.sy,sz:box.sz,
      ry:box.ry||0,kind:box.kind,sourceIndex:index,sourceSupportId:box.supportId||null});
  }

  // The placements record kiosk world-space envelopes at quarter turns. Use
  // the actual exported local GLB bounds before applying the shared transform,
  // preventing the classic double-rotation of width and depth.
  const bounds=assetManifest.kiosk;
  const localCenter=bounds.gltf_min.map((value,index)=>(value+bounds.gltf_max[index])/2);
  const localSize=bounds.gltf_min.map((value,index)=>bounds.gltf_max[index]-value);
  for(const placement of Object.values(SCENE_PLACEMENTS).filter(p=>p.asset==='kiosk')) {
    const scale=placement.scale||1,ry=placement.ry||0,c=Math.cos(ry),s=Math.sin(ry);
    staticColliders.push({id:`STREET-ASSET-${placement.id}`,kind:'kiosk',asset:'kiosk',sourceId:placement.id,
      x:placement.x+(localCenter[0]*c+localCenter[2]*s)*scale,y:placement.y+localCenter[1]*scale,
      z:placement.z+(-localCenter[0]*s+localCenter[2]*c)*scale,
      sx:localSize[0]*scale,sy:localSize[1]*scale,sz:localSize[2]*scale,ry});
  }
  return {staticColliders,dynamicProps,removedBoxes,groundSurfaces};
}
