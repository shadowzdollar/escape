// VESPER CITY dressing (art direction + assets from the MIT-licensed Neon District reference,
// Hiraeth010/neon-district): holographic advert panels on towers, neon noodle stalls on the
// sidewalks and patrolling security drones. Called by City.build() before finalize().
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { pick, rand } from './utils.js';

const BASE = import.meta.env.BASE_URL;
const ASSET = (f) => `${BASE}models/vesper/${f}`;

export function buildVesper(city) {
  const rng = city.rng;
  const disposables = [];
  const root = new THREE.Group();
  root.name = 'vesper';
  city.group.add(root);

  // ------------------------------------------------------------ advert panels
  const ads = city.vesperAds || [];
  const loader = new THREE.TextureLoader();
  const campaigns = [];
  fetch(ASSET('ads.json')).then((r) => r.json()).then((list) => {
    list.forEach((ad, i) => {
      const tex = loader.load(ASSET(ad.file));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      disposables.push(tex);
      campaigns[i] = { tex, aspect: ad.aspect };
      for (const p of panels) if (p.idx === i) applyAd(p);
    });
  }).catch(() => { /* panels stay as dark glowing slabs */ });

  const frameGeo = new THREE.BoxGeometry(1, 1, 0.3);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a0d18, roughness: 0.5, metalness: 0.6 });
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  disposables.push(frameGeo, frameMat, planeGeo);
  const panels = [];
  function applyAd(p) {
    const c = campaigns[p.idx];
    if (!c) return;
    // fit the artwork inside the panel without stretching it
    const w = Math.min(p.w, p.h * c.aspect), h = w / c.aspect;
    p.screen.scale.set(w, h, 1);
    p.screen.material.map = c.tex;
    p.screen.material.color.setRGB(1.7, 1.7, 1.7);
    p.screen.material.needsUpdate = true;
  }
  ads.forEach((a, n) => {
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.scale.set(a.w + 0.5, a.h + 0.5, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0x0a2a3a });
    disposables.push(mat);
    const screen = new THREE.Mesh(planeGeo, mat);
    screen.scale.set(a.w, a.h, 1);
    screen.position.z = 0.17;
    const g = new THREE.Group();
    g.add(frame, screen);
    g.position.set(a.x, a.y, a.z);
    g.rotation.y = a.rot;
    root.add(g);
    // neon rim
    const col = pick(rng, ['#00e5ff', '#ff2bd6', '#ffb020']);
    city.prop('neon', a.x, a.y + a.h / 2 + 0.35, a.z, a.rot, 1, col, a.w + 0.6, 0.18, 0.18);
    city.prop('neon', a.x, a.y - a.h / 2 - 0.35, a.z, a.rot, 1, col, a.w + 0.6, 0.18, 0.18);
    panels.push({ idx: n % 17, w: a.w, h: a.h, screen });
  });

  // ------------------------------------------------------------ noodle stalls (instanced)
  const stalls = [];
  for (const b of city.blocks) {
    if (b.type === 'park' || b.type === 'parking' || b.type === 'plaza' || b.type === 'bank') continue;
    if (rng() > 0.4) continue;
    // sidewalk corner, clear of the building line (sidewalk is 3 m wide)
    const cx = rng() < 0.5 ? b.x0 + 1.5 : b.x1 - 1.5, cz = rng() < 0.5 ? b.z0 + 5.5 : b.z1 - 5.5;
    stalls.push({ x: cx, z: cz, rot: cx < (b.x0 + b.x1) / 2 ? Math.PI / 2 : -Math.PI / 2, col: pick(rng, ['#ff2bd6', '#00e5ff', '#ffb020']) });
  }
  const bodyGeo = new THREE.BoxGeometry(1.1, 1.0, 2.2).translate(0, 0.5, 0);
  const awnGeo = new THREE.BoxGeometry(1.5, 0.12, 2.6).translate(0, 2.3, 0);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x242a3c, roughness: 0.5, metalness: 0.4 });
  const awnMat = new THREE.MeshStandardMaterial({ color: 0xff8a1f, emissive: 0xff7a00, emissiveIntensity: 0.9, roughness: 0.6 });
  disposables.push(bodyGeo, awnGeo, bodyMat, awnMat);
  const body = new THREE.InstancedMesh(bodyGeo, bodyMat, stalls.length || 1);
  const awn = new THREE.InstancedMesh(awnGeo, awnMat, stalls.length || 1);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  stalls.forEach((s, i) => {
    q.setFromAxisAngle(up, s.rot);
    m.compose(new THREE.Vector3(s.x, 0.15, s.z), q, new THREE.Vector3(1, 1, 1));
    body.setMatrixAt(i, m); awn.setMatrixAt(i, m);
    city.prop('neon', s.x, 2.9, s.z, s.rot, 1, s.col, 0.12, 0.5, 2.0);
    city.addBox(s.x - 0.7, s.x + 0.7, s.z - 1.2, s.z + 1.2, 'prop', 2.4);
  });
  body.count = awn.count = stalls.length;
  body.instanceMatrix.needsUpdate = awn.instanceMatrix.needsUpdate = true;
  body.frustumCulled = awn.frustumCulled = false;
  root.add(body, awn);

  // ------------------------------------------------------------ patrol drones
  const drones = [];
  new GLTFLoader().loadAsync(ASSET('drone.glb')).then((gltf) => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const scale = 2.6 / Math.max(size.x, size.y, size.z);
    const ctr = box.getCenter(new THREE.Vector3());
    const half = (city.map.size || 0) || 440;
    for (let i = 0; i < 7; i++) {
      const d = gltf.scene.clone(true);
      d.scale.setScalar(scale);
      d.position.sub(ctr.clone().multiplyScalar(scale));
      const pivot = new THREE.Group();
      pivot.add(d);
      pivot.userData = {
        cx: rand(rng, -half, half), cz: rand(rng, -half, half), r: rand(rng, 25, 70),
        h: rand(rng, 28, 46), spd: rand(rng, 0.12, 0.28) * (rng() < 0.5 ? -1 : 1), ph: rng() * 6.28,
      };
      root.add(pivot);
      drones.push(pivot);
    }
  }).catch(() => { /* drones are optional */ });

  return {
    update(dt, time) {
      for (const p of drones) {
        const u = p.userData, a = time * u.spd + u.ph;
        const x = u.cx + Math.cos(a) * u.r, z = u.cz + Math.sin(a) * u.r;
        p.position.set(x, u.h + Math.sin(time * 1.3 + u.ph) * 0.8, z);
        p.rotation.y = -a - (u.spd > 0 ? Math.PI / 2 : -Math.PI / 2);
        p.rotation.z = Math.sin(time * 0.9 + u.ph) * 0.06;
      }
    },
    dispose() {
      for (const d of disposables) d.dispose?.();
      city.group.remove(root);
    },
  };
}
