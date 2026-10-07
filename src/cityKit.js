// CC0 Quaternius models for the city (trees, shrubs, ground cover, rocks, street
// furniture, rooftop units and European townhouses), packed by dev/pack-city.mjs into
// public/models/city/kit.glb. Loaded once; the city instances them per spatial chunk,
// with a simplified "__lod1" copy for distant chunks.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Real-world scale for each model (the source models use small, arbitrary units) and
// whether to centre it on its bounding box (props/buildings) or keep its origin (trees).
const SCALE = {
  tree0: 1.35, tree1: 1.3, tree2: 1.2, tree3: 1.2, tree4: 1.35, maple0: 0.72, maple1: 0.75,
  pine0: 1.45, pine1: 1.45, pineSnow: 2.7, palm0: 2.5, palm1: 3.2, palm2: 3.2,
  bushFlowers: 1.1, bush: 1.0, hedge: 1.1, bushSnow: 1.2,
  fern: 0.22, plant: 0.4, flowers0: 0.45, flowers1: 0.4, grass: 0.7, grassTuft: 0.55, clover: 0.4,
  rocks0: 0.45, rocks1: 0.5, rock0: 0.55, rock1: 0.55,
  hydrant: 1.1, trashcan: 0.5, dumpster: 0.95, trashBags: 1.1, boxes: 0.55, cone: 1.15, streetlight: 2.25,
  fence: 0.75, barrier: 1.0, plasticBarrier: 1.6, ac: 1.3, acStack: 1.5, antenna: 1.4, waterTower: 1.0,
  house0: 2.7, house1: 2.7, house2: 2.6, houseLarge: 2.6, houseSmall: 2.7, building: 2.6, buildingBig: 2.6,
};
const KEEP_ORIGIN = /^(tree|maple|pine|palm)/;

let kit = null;
let loading = null;

// Resolves to { name: { parts: [{ geo, lo, mat }], size: Vector3 } }, or {} if the file is missing.
export function loadCityKit() {
  if (kit) return Promise.resolve(kit);
  if (loading) return loading;
  if (window.__noKit) return Promise.resolve((kit = {})); // dev: benchmark the procedural fallback
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
  loader.setDRACOLoader(draco);
  loading = loader.loadAsync(`${import.meta.env.BASE_URL}models/city/kit.glb`)
    .then((g) => (kit = build(g.scene)))
    .catch((e) => { console.warn('city kit unavailable, using procedural props', e); return (kit = {}); });
  return loading;
}

export function cityKit() { return kit || {}; }

function collect(root) {
  root.updateMatrixWorld(true);
  const parts = [];
  root.traverse((o) => { if (o.isMesh) parts.push(o); });
  return parts;
}

function build(scene) {
  const out = {};
  const mats = new Map();
  const material = (m) => {
    if (mats.has(m)) return mats.get(m);
    const n = m.clone();
    if (n.map) {
      // foliage / fence textures: alpha-tested cut-outs instead of sorted blending
      if (m.transparent || m.alphaTest > 0) { n.transparent = false; n.alphaTest = 0.45; n.side = THREE.DoubleSide; n.depthWrite = true; }
      n.map.anisotropy = 4;
    }
    n.roughness = Math.max(0.55, n.roughness ?? 1);
    n.metalness = Math.min(0.2, n.metalness ?? 0);
    mats.set(m, n);
    return n;
  };
  const byName = new Map(scene.children.map((c) => [c.name, c]));
  for (const [name, root] of byName) {
    if (name.endsWith('__lod1') || !(name in SCALE)) continue;
    const lodRoot = byName.get(name + '__lod1');
    const hi = collect(root), lo = lodRoot ? collect(lodRoot) : [];
    const s = SCALE[name];
    // normalisation: scale to metres, sit on y=0, optionally centre on the footprint
    const box = new THREE.Box3();
    for (const m of hi) box.expandByObject(m);
    const c = box.getCenter(new THREE.Vector3());
    const keep = KEEP_ORIGIN.test(name);
    const fix = new THREE.Matrix4().makeScale(s, s, s);
    if (!keep) fix.multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
    const prep = (mesh) => {
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);
      g.applyMatrix4(fix);
      g.computeBoundingSphere();
      return g;
    };
    const parts = hi.map((m) => {
      const mat = material(m.material);
      if (!m.geometry.attributes.normal) mat.flatShading = true;
      const twin = lo.find((l) => l.material.name === m.material.name);
      return { geo: prep(m), lo: twin ? prep(twin) : null, mat };
    });
    const size = box.getSize(new THREE.Vector3()).multiplyScalar(s);
    out[name] = { parts, size };
  }
  return out;
}
