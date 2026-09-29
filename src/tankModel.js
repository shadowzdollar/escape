// Main battle tank modelled after the reference art: low wide hull with a steep
// glacis, segmented side skirts, 7 road wheels + drive sprocket + idler, linked
// tracks, faceted wedge turret with bustle rack, commander cupola, gunner sight,
// smoke launchers, antennas, long gun with thermal sleeve + bore evacuator,
// green camo with sand stripes. Returns a Vehicle-compatible car object.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { blobShadowTexture } from './textures.js';

const C = {
  camo: '#6e8a3b', camoDark: '#4b6228', sand: '#ae9760', dark: '#2a2e25', track: '#24241f',
  trackEdge: '#6c6a5c', wheel: '#5d7432', hub: '#35431f', rubber: '#1d1d1a',
};

function prep(g, color) {
  const geo = g.index ? g.toNonIndexed() : g;
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  if (geo.attributes.uv1) geo.deleteAttribute('uv1');
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
function box(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}
function cyl(r0, r1, h, seg, x, y, z, axis = 'y') {
  const g = new THREE.CylinderGeometry(r0, r1, h, seg);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}
// side-profile extrusion across the width (profile in z,y)
function profile(pts, width, bevel = 0.06) {
  const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const depth = width - bevel * 2;
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1 });
  g.rotateY(-Math.PI / 2);
  g.translate(depth / 2, 0, 0);
  return g;
}
// top-view extrusion upward (polygon in x,z)
function plan(pts, height, bevel = 0.1) {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ExtrudeGeometry(s, { depth: height - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1 });
  g.rotateX(Math.PI / 2);
  g.translate(0, height - bevel, 0);
  return g;
}

const cache = {};
function geometry() {
  if (cache.g) return cache.g;
  const hull = [], turret = [], gun = [], wheels = [], links = [[], []];
  const W = 3.6, L = 7.4;
  // ---------------- hull
  hull.push(prep(box(2.2, 0.7, 6.7, 0, 0.68, -0.1), C.camoDark));
  hull.push(prep(profile([[-3.62, 1.0], [-3.5, 1.5], [2.25, 1.58], [3.72, 1.08], [3.62, 0.9], [-3.62, 0.9]], W), C.camo));
  // glacis sand stripe + deck camo patches
  const gl = Math.atan2(1.58 - 1.08, 3.72 - 2.25);
  hull.push(prep(box(0.55, 0.03, 1.6, -0.5, 1.35, 3.0, gl, 0.5, 0), C.sand));
  hull.push(prep(box(0.5, 0.03, 2.6, 0.9, 1.6, 0.4, 0, -0.6, 0), C.sand));
  hull.push(prep(box(0.45, 0.03, 2.0, -1.1, 1.6, -2.2, 0, 0.4, 0), C.sand));
  // engine deck grilles, tool boxes, tow hooks
  for (let k = 0; k < 4; k++) hull.push(prep(box(1.8, 0.04, 0.12, 0, 1.6, -2.3 - k * 0.3), C.dark));
  for (const sx of [-1, 1]) {
    hull.push(prep(box(0.5, 0.28, 1.2, sx * 1.45, 1.72, -1.4), C.camoDark));
    hull.push(prep(box(0.18, 0.18, 0.3, sx * 0.9, 1.0, 3.72), C.dark));
    // front fender lights (lens + marker)
    hull.push(prep(box(0.26, 0.2, 0.18, sx * 1.45, 1.42, 3.15), C.dark));
  }
  // segmented side skirts
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const z = -3.0 + k * 1.02;
      hull.push(prep(box(0.08, 0.5, 0.96, sx * 1.84, 1.12, z), k % 2 ? C.camo : C.camoDark));
      hull.push(prep(box(0.1, 0.07, 0.98, sx * 1.84, 0.86, z), C.dark));
    }
    hull.push(prep(box(0.08, 0.46, 0.8, sx * 1.84, 1.14, 3.1, 0.3, 0, 0), C.camo));
  }
  // ---------------- running gear (static; the tracks animate instead)
  const wheelZ = [];
  for (let k = 0; k < 7; k++) wheelZ.push(-2.55 + k * 0.83);
  for (const sx of [-1, 1]) {
    for (const z of wheelZ) {
      wheels.push(prep(cyl(0.37, 0.37, 0.18, 16, sx * 1.66, 0.4, z, 'x'), C.rubber));
      wheels.push(prep(cyl(0.33, 0.33, 0.2, 14, sx * 1.68, 0.4, z, 'x'), C.wheel));
      wheels.push(prep(cyl(0.12, 0.12, 0.24, 8, sx * 1.7, 0.4, z, 'x'), C.hub));
      wheels.push(prep(cyl(0.37, 0.37, 0.16, 16, sx * 1.24, 0.4, z, 'x'), C.rubber));
    }
    // drive sprocket with teeth (rear) + idler (front) + return rollers
    wheels.push(prep(cyl(0.34, 0.34, 0.42, 14, sx * 1.45, 0.62, -3.28, 'x'), C.hub));
    for (let t = 0; t < 10; t++) {
      const a = (t / 10) * Math.PI * 2;
      wheels.push(prep(box(0.44, 0.1, 0.1, sx * 1.45, 0.62 + Math.cos(a) * 0.37, -3.28 + Math.sin(a) * 0.37, a), C.dark));
    }
    wheels.push(prep(cyl(0.31, 0.31, 0.42, 14, sx * 1.45, 0.62, 3.32, 'x'), C.wheel));
    for (const z of [-1.6, 0, 1.6]) wheels.push(prep(cyl(0.11, 0.11, 0.3, 8, sx * 1.45, 0.9, z, 'x'), C.hub));
  }
  // ---------------- tracks: two link sets offset by half a pitch (alternated to animate)
  const path = [[-2.9, 0.05], [2.95, 0.05], [3.62, 0.6], [3.35, 0.97], [-3.3, 0.98], [-3.64, 0.6], [-2.9, 0.05]];
  const pitch = 0.2;
  let lenTot = 0;
  const segs = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [z0, y0] = path[i], [z1, y1] = path[i + 1];
    const l = Math.hypot(z1 - z0, y1 - y0);
    segs.push({ z0, y0, z1, y1, l, a0: lenTot });
    lenTot += l;
  }
  for (const set of [0, 1]) {
    for (let d = set * pitch / 2; d < lenTot; d += pitch) {
      const s = segs.find((q) => d >= q.a0 && d < q.a0 + q.l) || segs[segs.length - 1];
      const t = (d - s.a0) / s.l;
      const z = s.z0 + (s.z1 - s.z0) * t, y = s.y0 + (s.y1 - s.y0) * t;
      const ang = -Math.atan2(s.y1 - s.y0, s.z1 - s.z0);
      for (const sx of [-1, 1]) {
        links[set].push(prep(box(0.66, 0.075, pitch * 0.82, sx * 1.45, y, z, ang), C.track));
        links[set].push(prep(box(0.1, 0.09, pitch * 0.5, sx * 1.45 + sx * 0.3, y, z, ang), C.trackEdge));
      }
    }
  }
  // ---------------- turret (origin = turret ring centre)
  turret.push(prep(plan([[-0.6, 1.95], [0.6, 1.95], [1.35, 1.0], [1.42, -0.9], [1.05, -1.75], [-1.05, -1.75], [-1.42, -0.9], [-1.35, 1.0]], 0.78, 0.12), C.camo));
  turret.push(prep(plan([[-0.5, 1.3], [0.5, 1.3], [0.95, 0.4], [0.95, -1.1], [-0.95, -1.1], [-0.95, 0.4]], 0.9, 0.08), C.camo));
  turret.push(prep(box(0.5, 0.03, 1.8, 0.35, 0.91, -0.1, 0, 0.5, 0), C.sand));
  turret.push(prep(box(0.4, 0.03, 1.2, -0.6, 0.91, 0.6, 0, -0.4, 0), C.sand));
  // bustle rack
  turret.push(prep(box(2.2, 0.06, 0.6, 0, 0.3, -2.05), C.dark));
  turret.push(prep(box(2.2, 0.35, 0.05, 0, 0.5, -2.33), C.dark));
  for (const sx of [-1.08, 1.08]) turret.push(prep(box(0.05, 0.35, 0.6, sx, 0.5, -2.05), C.dark));
  // mantlet
  turret.push(prep(box(0.95, 0.62, 0.55, 0, 0.42, 2.05), C.camoDark));
  // commander cupola + sight + machine gun, gunner sight
  turret.push(prep(cyl(0.34, 0.38, 0.28, 12, 0.55, 1.02, -0.45), C.camoDark));
  turret.push(prep(box(0.34, 0.26, 0.3, 0.55, 1.3, -0.3), C.dark));
  turret.push(prep(cyl(0.035, 0.035, 0.9, 6, 0.3, 1.25, -0.1, 'z'), C.dark));
  turret.push(prep(box(0.36, 0.34, 0.36, -0.75, 1.05, 0.55), C.camoDark));
  turret.push(prep(cyl(0.14, 0.14, 0.2, 10, -0.2, 0.95, -0.7), C.hub));
  // smoke grenade launchers
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 4; k++) turret.push(prep(cyl(0.055, 0.055, 0.3, 6, sx * (1.3 - k * 0.05), 0.72 + (k % 2) * 0.12, 0.95 + Math.floor(k / 2) * 0.14, 'z'), C.dark));
  }
  // antennas
  for (const sx of [-1, 1]) turret.push(prep(cyl(0.012, 0.02, 2.4, 4, sx * 0.95, 1.95, -1.55), C.dark));
  // ---------------- gun (origin at the trunnion, points +z)
  gun.push(prep(cyl(0.2, 0.2, 1.1, 12, 0, 0, 0.55, 'z'), C.camoDark));
  gun.push(prep(cyl(0.14, 0.15, 4.0, 12, 0, 0, 3.1, 'z'), C.camo));
  for (const z of [1.5, 2.6, 4.4]) gun.push(prep(cyl(0.165, 0.165, 0.16, 12, 0, 0, z, 'z'), C.camoDark));
  gun.push(prep(cyl(0.2, 0.2, 0.55, 12, 0, 0, 3.55, 'z'), C.camoDark));
  gun.push(prep(cyl(0.18, 0.17, 0.3, 12, 0, 0, 5.2, 'z'), C.camoDark));
  gun.push(prep(cyl(0.1, 0.1, 0.02, 10, 0, 0, 5.36, 'z'), '#0b0b0b'));
  const lens = [];
  for (const sx of [-1, 1]) lens.push(prep(box(0.16, 0.1, 0.02, sx * 1.45, 1.44, 3.25), '#fff3c8'));
  lens.push(prep(box(0.22, 0.12, 0.02, 0.55, 1.3, -0.14), '#9fe3ff'));
  lens.push(prep(box(0.24, 0.14, 0.02, -0.75, 1.07, 0.74), '#9fe3ff'));
  const marks = [];
  for (const sx of [-1, 1]) marks.push(prep(box(0.08, 0.08, 0.02, sx * 1.62, 1.44, 3.25), '#ff5a1f'));
  cache.g = {
    hull: mergeGeometries(hull), wheels: mergeGeometries(wheels),
    linksA: mergeGeometries(links[0]), linksB: mergeGeometries(links[1]),
    turret: mergeGeometries(turret), gun: mergeGeometries(gun),
    lens: mergeGeometries(lens), marks: mergeGeometries(marks), pitch,
  };
  return cache.g;
}

let mats = null;
function materials() {
  if (mats) return mats;
  mats = {
    body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.22, flatShading: true }),
    lens: new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.6, 1.6, 1.6) }),
    shadow: new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false, opacity: 0.85, color: 0x000000 }),
  };
  return mats;
}

export function createTank() {
  const G = geometry(), M = materials();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mesh = (g, m, parent, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; parent.add(o); return o; };
  mesh(G.hull, M.body, body);
  mesh(G.wheels, M.body, body);
  const linksA = mesh(G.linksA, M.body, body);
  const linksB = mesh(G.linksB, M.body, body);
  linksB.visible = false;
  mesh(G.lens, M.lens, body, false);
  mesh(G.marks, M.lens, body, false);
  const turret = new THREE.Group();
  turret.position.set(0, 1.58, -0.35);
  body.add(turret);
  mesh(G.turret, M.body, turret);
  const barrel = new THREE.Group();
  barrel.position.set(0, 0.42, 2.25);
  turret.add(barrel);
  mesh(G.gun, M.body, barrel);
  const muzzleMat = new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0, depthWrite: false });
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), muzzleMat);
  muzzle.position.set(0, 0, 5.6);
  barrel.add(muzzle);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 8.6), M.shadow);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03;
  root.add(shadow);
  const beam = new THREE.Object3D(); beam.visible = false;
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  const paintMat = M.body.clone(); // per-tank so wrecks can be darkened
  body.traverse((o) => { if (o.isMesh && o.material === M.body) o.material = paintMat; });
  return {
    root, body, wheels: [], turret, barrel, muzzle, muzzleMat, linksA, linksB, pitch: G.pitch,
    paintMat, tailMat, glowMat: null, red: null, blue: null, beam, shadow, pool: null,
    spec: { L: 7.4, W: 3.6, wr: 0.4, ww: 0.66, fa: 2.5, ra: -2.5, yb: 0.3, tailBot: 0.9, hoodY: 1.6, roofY: 2.6 },
    setColor() {},
    dispose() { paintMat.dispose(); muzzleMat.dispose(); tailMat.dispose(); shadow.geometry.dispose(); },
  };
}
