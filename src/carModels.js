// Procedural car builder.
// Each body is an extruded side-profile (with real wheel arches), a tapered cabin
// with glass inlays (so pillars show), and detail parts merged per material.
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { blobShadowTexture, beamTexture, radialTexture, signTexture } from './textures.js';
import { clamp } from './utils.js';

const V2 = THREE.Vector2;

// All dimensions in meters. Front of the car is +Z.
export const SPECS = {
  hatch: {
    L: 3.95, W: 1.78, wr: 0.34, ww: 0.22, fa: 1.28, ra: -1.3, yb: 0.34,
    noseBot: 0.36, noseTop: 0.74, noseDz: 0.22, hoodY: 0.95, cowlZ: 0.78,
    roofY: 1.5, roofFZ: 0.02, roofRZ: -1.5, rwZ: -1.86, deckY: 1.02,
    tailTop: 1.0, tailDz: 0.06, tailBot: 0.38, cabinW: 0.86, taper: 0.8,
    rim: 'five', spoiler: 'roof', head: 'round', tail: 'tall',
  },
  sedan: {
    L: 4.7, W: 1.84, wr: 0.35, ww: 0.24, fa: 1.45, ra: -1.4, yb: 0.32,
    noseBot: 0.34, noseTop: 0.72, noseDz: 0.25, hoodY: 0.94, cowlZ: 0.9,
    roofY: 1.44, roofFZ: -0.05, roofRZ: -1.0, rwZ: -1.6, deckY: 1.02,
    tailTop: 1.0, tailDz: 0.12, tailBot: 0.4, cabinW: 0.84, taper: 0.78,
    rim: 'multi', head: 'wide', tail: 'wide',
  },
  taxi: null, // sedan variant, resolved below
  muscle: {
    L: 4.85, W: 1.94, wr: 0.38, ww: 0.3, fa: 1.55, ra: -1.5, yb: 0.34,
    noseBot: 0.36, noseTop: 0.86, noseDz: 0.08, hoodY: 1.02, cowlZ: 0.6,
    roofY: 1.38, roofFZ: -0.32, roofRZ: -1.05, rwZ: -1.8, deckY: 1.04,
    tailTop: 1.04, tailDz: 0.06, tailBot: 0.42, cabinW: 0.8, taper: 0.8,
    rim: 'five', spoiler: 'duck', head: 'twin', tail: 'wide', scoop: true, stripes: true, exhaust: 'dual',
  },
  sports: {
    L: 4.45, W: 1.9, wr: 0.36, ww: 0.28, fa: 1.42, ra: -1.38, yb: 0.28,
    noseBot: 0.28, noseTop: 0.6, noseDz: 0.38, hoodY: 0.88, cowlZ: 0.52,
    roofY: 1.26, roofFZ: -0.32, roofRZ: -0.95, rwZ: -1.72, deckY: 0.94,
    tailTop: 0.93, tailDz: 0.12, tailBot: 0.38, cabinW: 0.78, taper: 0.74,
    rim: 'multi', spoiler: 'wing', head: 'slim', tail: 'wide', calipers: true, exhaust: 'quad', fenders: true,
  },
  super: {
    L: 4.6, W: 2.0, wr: 0.36, ww: 0.3, fa: 1.5, ra: -1.45, yb: 0.22,
    noseBot: 0.22, noseTop: 0.46, noseDz: 0.5, hoodY: 0.8, cowlZ: 0.42,
    roofY: 1.13, roofFZ: -0.28, roofRZ: -0.78, rwZ: -1.95, deckY: 0.92,
    tailTop: 0.92, tailDz: 0.06, tailBot: 0.36, cabinW: 0.72, taper: 0.7,
    rim: 'aero', spoiler: 'wing', head: 'slim', tail: 'bar', calipers: true, intakes: true, exhaust: 'center', fenders: true,
  },
  hyper: {
    L: 4.8, W: 2.04, wr: 0.37, ww: 0.3, fa: 1.6, ra: -1.55, yb: 0.2,
    noseBot: 0.2, noseTop: 0.38, noseDz: 0.62, hoodY: 0.76, cowlZ: 0.62,
    roofY: 1.08, roofFZ: -0.12, roofRZ: -0.7, rwZ: -2.05, deckY: 0.86,
    tailTop: 0.86, tailDz: 0.03, tailBot: 0.42, cabinW: 0.7, taper: 0.64,
    rim: 'disc', spoiler: 'wing', head: 'slim', tail: 'bar', calipers: true, neon: true, intakes: true, fenders: true,
  },
  truck: {
    L: 5.3, W: 2.05, wr: 0.5, ww: 0.36, fa: 1.75, ra: -1.65, yb: 0.66,
    noseBot: 0.7, noseTop: 1.28, noseDz: 0.1, hoodY: 1.42, cowlZ: 0.95,
    roofY: 2.12, roofFZ: 0.5, roofRZ: -0.62, rwZ: -0.72, deckY: 1.44,
    tailTop: 1.44, tailDz: 0.03, tailBot: 0.74, cabinW: 0.9, taper: 0.88,
    rim: 'off', head: 'square', tail: 'tall', bed: true, rollbar: true, bullbar: true, exhaust: 'single',
  },
  van: {
    L: 4.95, W: 1.98, wr: 0.36, ww: 0.25, fa: 1.7, ra: -1.5, yb: 0.36,
    noseBot: 0.38, noseTop: 0.92, noseDz: 0.18, hoodY: 1.12, cowlZ: 1.55,
    roofY: 2.3, roofFZ: 0.95, roofRZ: -2.35, rwZ: -2.42, deckY: 1.12,
    tailTop: 1.1, tailDz: 0.03, tailBot: 0.4, cabinW: 0.96, taper: 0.94,
    rim: 'steel', head: 'square', tail: 'tall', sideWinRear: 0.35,
  },
};
SPECS.taxi = { ...SPECS.sedan, taxiSign: true, rim: 'steel' };

// ---------------------------------------------------------------- geometry helpers

function prep(geo, color = '#ffffff') {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) {
    if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function box(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}

function cyl(rTop, rBot, h, seg, x, y, z, axis = 'y') {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

function extrudeProfile(pts, width, bt, bs, seg = 3) {
  const shape = new THREE.Shape(pts.map((p) => new V2(p[0], p[1])));
  const depth = Math.max(0.02, width - 2 * bt);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: seg, curveSegments: 10, steps: 1,
  });
  g.rotateY(-Math.PI / 2);
  g.translate(depth / 2, 0, 0);
  return { g, depth };
}

function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

// Offset each edge of a CCW polygon inward by its own distance.
function insetPolygon(pts, dists) {
  const n = pts.length;
  const lines = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy); dx /= len; dy /= len;
    const nx = -dy, ny = dx; // inward for CCW
    lines.push({ px: a[0] + nx * dists[i], py: a[1] + ny * dists[i], dx, dy });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const l1 = lines[(i - 1 + n) % n], l2 = lines[i];
    const cr = l1.dx * l2.dy - l1.dy * l2.dx;
    if (Math.abs(cr) < 1e-6) { out.push([l2.px, l2.py]); continue; }
    const t = ((l2.px - l1.px) * l2.dy - (l2.py - l1.py) * l2.dx) / cr;
    out.push([l1.px + l1.dx * t, l1.py + l1.dy * t]);
  }
  return out;
}

function clipPolygon(pts, keep) { // keep(p) -> signed distance >= 0 kept
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const da = keep(a), db = keep(b);
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

// Build a flat polygon (in z,y) on the side of the car at x = side * xAt(y).
function sidePolygon(poly, xAt, side) {
  const contour = poly.map((p) => new V2(p[0], p[1]));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const pos = [];
  for (const t of tris) {
    let idx = [t[0], t[1], t[2]];
    const P = idx.map((k) => new THREE.Vector3(side * xAt(poly[k][1]), poly[k][1], poly[k][0]));
    const nrm = new THREE.Vector3().subVectors(P[1], P[0]).cross(new THREE.Vector3().subVectors(P[2], P[0]));
    if (nrm.x * side < 0) P.reverse();
    for (const p of P) pos.push(p.x, p.y, p.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// Quad from 4 points, flipped so its normal agrees with `outward`.
function quad(p, outward) {
  const [a, b, c, d] = p;
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  const order = n.dot(outward) >= 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
  const pos = [];
  for (const v of order) pos.push(v.x, v.y, v.z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- body

function bodyProfile(s) {
  const zF = s.L / 2, zR = -s.L / 2;
  const pts = [];
  pts.push([zR + s.tailDz, s.tailTop]);
  pts.push([s.rwZ, s.deckY]);
  pts.push([s.cowlZ, s.hoodY]);
  pts.push([(s.cowlZ + zF - s.noseDz) / 2, (s.hoodY + s.noseTop) / 2 + 0.025]);
  pts.push([zF - s.noseDz, s.noseTop]);
  pts.push([zF, s.noseTop * 0.42 + s.noseBot * 0.58]);
  pts.push([zF - 0.14, s.noseBot]);
  const arch = (az) => {
    const cy = s.wr, ar = s.wr + 0.13;
    const th0 = Math.asin(clamp((s.yb - cy) / ar, -1, 1));
    const N = 12;
    for (let i = 0; i <= N; i++) {
      const th = th0 + (Math.PI - 2 * th0) * (i / N);
      pts.push([az + ar * Math.cos(th), cy + ar * Math.sin(th)]);
    }
  };
  arch(s.fa);
  arch(s.ra);
  pts.push([zR + 0.14, s.tailBot]);
  pts.push([zR, (s.tailTop + s.tailBot) / 2]);
  if (signedArea(pts) < 0) pts.reverse();
  return pts;
}

function cabinProfile(s) {
  const pts = [
    [s.cowlZ + 0.02, s.hoodY - 0.08],
    [s.roofFZ, s.roofY],
    [s.roofRZ, s.roofY],
    [s.rwZ - 0.02, s.deckY - 0.08],
  ];
  if (signedArea(pts) < 0) pts.reverse();
  return pts;
}

// Returns a y on the belt line at z (line between cowl and rear-window base).
function beltY(s, z) {
  const t = clamp((z - s.rwZ) / (s.cowlZ - s.rwZ), 0, 1);
  return s.deckY + (s.hoodY - s.deckY) * t;
}

const geoCache = new Map();

function buildBody(modelId, livery) {
  const key = modelId + '|' + (livery || '');
  if (geoCache.has(key)) return geoCache.get(key);
  const s = SPECS[modelId];
  const B = { paint: [], paint2: [], trim: [], glass: [], head: [], tail: [], glow: [], red: [], blue: [], decal: [] };
  const zF = s.L / 2, zR = -s.L / 2;
  const BT = 0.1, BS = 0.07;

  // ---- lower body
  const prof = bodyProfile(s);
  const { g: lower } = extrudeProfile(prof, s.W, BT, BS, 3);
  B.paint.push(prep(toCreasedNormals(lower, 0.62)));

  // ---- sculpted fenders over the wheels (low cars whose hood sits below the tyre)
  if (s.fenders) {
    for (const az of [s.fa, s.ra]) {
      const cy = s.wr, ar = s.wr + 0.13, ro = s.wr + 0.24;
      const band = [];
      const N = 14;
      const lowY = Math.max(s.yb, 0.05);
      const aIn = Math.asin(clamp((lowY - cy) / ar, -1, 1));
      const aOut = Math.asin(clamp((lowY - cy) / ro, -1, 1));
      for (let i = 0; i <= N; i++) {
        const th = aOut + (Math.PI - 2 * aOut) * (i / N);
        // flatten the top a little so it reads as a sculpted wing, not a tube
        const r = ro * (1 - 0.1 * Math.pow(Math.sin(th), 4));
        band.push([az + r * Math.cos(th), cy + r * Math.sin(th)]);
      }
      for (let i = N; i >= 0; i--) {
        const th = aIn + (Math.PI - 2 * aIn) * (i / N);
        band.push([az + ar * Math.cos(th), cy + ar * Math.sin(th)]);
      }
      const poly = signedArea(band) < 0 ? band.reverse() : band;
      const fw = 0.56;
      const { g: fg } = extrudeProfile(poly, fw, 0.08, 0.05, 3);
      for (const sx of [-1, 1]) {
        const c = fg.clone();
        c.translate(sx * (s.W / 2 - fw / 2 + 0.01), 0, 0);
        B.paint.push(prep(toCreasedNormals(c, 0.62)));
      }
    }
  }

  // ---- cabin (tapered toward the roof)
  const cw = s.W * s.cabinW;
  const CBT = 0.07, CBS = 0.05;
  const cab = cabinProfile(s);
  const { g: cabin, depth: cDepth } = extrudeProfile(cab, cw, CBT, CBS, 2);
  const belt0 = Math.min(s.hoodY, s.deckY) - 0.08;
  const taperAt = (y) => 1 - (1 - s.taper) * clamp((y - belt0) / (s.roofY + CBS - belt0), 0, 1);
  const cp = cabin.attributes.position;
  for (let i = 0; i < cp.count; i++) cp.setX(i, cp.getX(i) * taperAt(cp.getY(i)));
  cabin.deleteAttribute('normal');
  B.paint.push(prep(toCreasedNormals(cabin, 0.5)));

  // ---- glass: side windows (with B-pillar), windshield, rear window
  const sideX = (y) => (cDepth / 2 + CBT + 0.012) * taperAt(y);
  // cabin polygon order (CCW): cowl -> roofF (A-pillar), roofF -> roofR (roof), roofR -> rw (C-pillar), rw -> cowl (belt)
  let win = insetPolygon(cab, [0.1, 0.08, 0.16, 0.06]);
  if (s.sideWinRear !== undefined) win = clipPolygon(win, (p) => p[0] - s.sideWinRear);
  for (const side of [-1, 1]) {
    B.glass.push(prep(sidePolygon(win, sideX, side)));
    // B-pillar
    const zs = win.map((p) => p[0]);
    const bz = (Math.min(...zs) * 0.45 + Math.max(...zs) * 0.55);
    const ys = win.map((p) => p[1]);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const bp = [[bz + 0.05, y0 - 0.01], [bz + 0.05, y1 + 0.01], [bz - 0.05, y1 + 0.01], [bz - 0.05, y0 - 0.01]];
    const bpg = sidePolygon(bp, (y) => sideX(y) + 0.006, side);
    B.trim.push(prep(bpg, '#16181c'));
  }
  const faceGlass = (a, b, inset0, inset1, target) => {
    // a,b are (z,y) endpoints of a slanted cabin face; glass spans across x
    const dz = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dz, dy);
    let nz = dy / len, ny = -dz / len; // outward for CCW (a->b ordered along CCW polygon)
    const off = CBS + 0.012;
    const P = (t, sx) => {
      const z = a[0] + dz * t + nz * off, y = a[1] + dy * t + ny * off;
      const x = sx * (cDepth / 2 - 0.02) * taperAt(y);
      return new THREE.Vector3(x, y, z);
    };
    const pts = [P(inset0, -1), P(inset0, 1), P(1 - inset1, 1), P(1 - inset1, -1)];
    target.push(prep(quad(pts, new THREE.Vector3(0, ny, nz))));
  };
  faceGlass(cab[0], cab[1], 0.07, 0.07, B.glass); // windshield
  faceGlass(cab[2], cab[3], 0.1, 0.1, B.glass);   // rear window

  // ---- lights, grille, plates
  const bumperY = s.noseTop * 0.42 + s.noseBot * 0.58;
  const frontA = [zF - s.noseDz, s.noseTop], frontB = [zF, bumperY];
  const rearA = [zR + s.tailDz, s.tailTop], rearB = [zR, (s.tailTop + s.tailBot) / 2];
  const onFace = (A, Bp, t, outwardSign) => {
    const z = A[0] + (Bp[0] - A[0]) * t, y = A[1] + (Bp[1] - A[1]) * t;
    const dz = Bp[0] - A[0], dy = Bp[1] - A[1];
    const len = Math.hypot(dz, dy);
    // outward normal: for front face points +z, for rear face -z
    let nz = -dy / len, ny = dz / len;
    if (nz * outwardSign < 0) { nz = -nz; ny = -ny; }
    const ang = Math.atan2(-ny, nz); // rotation about X so local +Z aligns to normal
    return { z: z + nz * (BS + 0.012), y: y + ny * (BS + 0.012), rx: ang, nz, ny };
  };
  const hf = onFace(frontA, frontB, 0.28, 1);
  const hx = s.W / 2 - 0.36;
  if (s.fenders) {
    // lights sit on the front face of the fender pods
    const th = 0.62, ro = (s.wr + 0.24) * 0.99 + 0.05;
    const z = s.fa + ro * Math.cos(th), y = s.wr + ro * Math.sin(th);
    for (const sx of [-1, 1]) {
      B.head.push(prep(box(0.34, 0.06, 0.2, sx * (s.W / 2 - 0.28), y, z, -th), '#fff4e0'));
    }
  } else if (s.head === 'slim') {
    for (const sx of [-1, 1]) B.head.push(prep(box(0.52, 0.07, 0.05, sx * (hx - 0.02), hf.y, hf.z, hf.rx, 0, 0), '#fff4e0'));
  } else if (s.head === 'round' || s.head === 'twin') {
    for (const sx of [-1, 1]) {
      const n = s.head === 'twin' ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const c = cyl(0.11, 0.11, 0.05, 14, 0, 0, 0, 'z');
        c.rotateX(hf.rx);
        c.translate(sx * (hx - k * 0.26), hf.y, hf.z);
        B.head.push(prep(c, '#fff8e8'));
      }
    }
  } else if (s.head === 'square') {
    for (const sx of [-1, 1]) B.head.push(prep(box(0.34, 0.2, 0.05, sx * hx, hf.y, hf.z, hf.rx), '#fff4e0'));
  } else {
    for (const sx of [-1, 1]) B.head.push(prep(box(0.44, 0.13, 0.05, sx * hx, hf.y, hf.z, hf.rx), '#fff4e0'));
  }
  // amber indicators
  for (const sx of [-1, 1]) B.head.push(prep(box(0.12, 0.05, 0.04, sx * (s.W / 2 - 0.12), hf.y - 0.02, hf.z - 0.04, hf.rx), '#ff9a1f'));
  // grille + lower intake
  const gf = onFace(frontA, frontB, 0.7, 1);
  B.trim.push(prep(box(s.W - (s.head === 'twin' ? 1.25 : 1.05), 0.14, 0.05, 0, gf.y, gf.z, gf.rx), '#101114'));
  const lowA = frontB, lowB = [zF - 0.14, s.noseBot];
  const lf = onFace(lowA, lowB, 0.5, 1);
  B.trim.push(prep(box(s.W - 0.5, Math.max(0.06, (bumperY - s.noseBot) * 0.5), 0.05, 0, lf.y, lf.z, lf.rx), '#0c0d10'));
  B.trim.push(prep(box(0.5, 0.11, 0.03, 0, lf.y + 0.02, lf.z + 0.02, lf.rx), '#e8e8e8')); // front plate
  // splitter
  B.trim.push(prep(box(s.W - 0.2, 0.04, 0.3, 0, s.noseBot + 0.01, zF - 0.2), '#111'));

  const tf = onFace(rearA, rearB, 0.3, -1);
  const tx = s.W / 2 - 0.34;
  if (s.tail === 'bar') {
    B.tail.push(prep(box(s.W - 0.3, 0.06, 0.05, 0, tf.y, tf.z, tf.rx), '#ff1a1a'));
  } else if (s.tail === 'tall') {
    for (const sx of [-1, 1]) B.tail.push(prep(box(0.2, 0.3, 0.05, sx * (s.W / 2 - 0.2), tf.y - 0.08, tf.z, tf.rx), '#ff1a1a'));
  } else {
    for (const sx of [-1, 1]) B.tail.push(prep(box(0.5, 0.12, 0.05, sx * tx, tf.y, tf.z, tf.rx), '#ff1a1a'));
  }
  const pf = onFace(rearA, rearB, 0.85, -1);
  B.trim.push(prep(box(0.5, 0.11, 0.03, 0, pf.y - 0.05, pf.z - 0.02, pf.rx), '#e8e8e8')); // rear plate
  B.trim.push(prep(box(s.W - 0.3, 0.1, 0.25, 0, s.tailBot + 0.02, zR + 0.18), '#111')); // diffuser

  // exhausts
  const exY = s.tailBot + 0.08, exZ = zR + 0.02;
  const ex = s.exhaust || 'single';
  const exXs = ex === 'dual' ? [-0.55, 0.55] : ex === 'quad' ? [-0.62, -0.46, 0.46, 0.62] : ex === 'center' ? [-0.1, 0.1] : [0.55];
  for (const x of exXs) B.trim.push(prep(cyl(0.055, 0.055, 0.2, 10, x, exY, exZ, 'z'), '#d9d9d9'));

  // mirrors
  const my = s.hoodY + 0.14, mz = s.cowlZ - 0.18;
  for (const sx of [-1, 1]) {
    B.trim.push(prep(box(0.2, 0.11, 0.16, sx * (cw / 2 * 0.96 + 0.12), my, mz), '#15171b'));
  }
  // side skirts
  const skirtLen = (s.fa - s.wr - 0.15) - (s.ra + s.wr + 0.15);
  for (const sx of [-1, 1]) {
    B.trim.push(prep(box(0.06, 0.1, skirtLen, sx * (s.W / 2 + 0.01), s.yb + 0.06, (s.fa + s.ra) / 2), '#121317'));
  }
  // door handle hints
  for (const sx of [-1, 1]) {
    const z = (s.cowlZ + s.rwZ) / 2 + 0.3;
    B.trim.push(prep(box(0.03, 0.03, 0.16, sx * (s.W / 2 + 0.005), beltY(s, z) - 0.12, z), '#222'));
  }
  if (s.calipers) {
    for (const az of [s.fa, s.ra]) for (const sx of [-1, 1]) {
      B.trim.push(prep(box(0.08, 0.16, 0.2, sx * (s.W / 2 - s.ww - 0.02), s.wr + 0.12, az + 0.08), '#e10600'));
    }
  }
  if (s.intakes) {
    for (const sx of [-1, 1]) {
      const z = s.ra + s.wr + 0.45;
      B.trim.push(prep(box(0.05, 0.2, 0.55, sx * (s.W / 2 + 0.005), (beltY(s, z) + s.yb) / 2 + 0.05, z), '#08090b'));
    }
  }

  // ---- spoilers & extras
  if (s.spoiler === 'wing') {
    const wz = zR + 0.32, wy = s.tailTop + 0.34;
    for (const sx of [-0.62, 0.62]) B.trim.push(prep(box(0.05, 0.34, 0.14, sx, s.tailTop + 0.16, wz), '#15171b'));
    B.paint.push(prep(box(s.W - 0.12, 0.05, 0.4, 0, wy, wz - 0.03, -0.12)));
    for (const sx of [-1, 1]) B.trim.push(prep(box(0.03, 0.14, 0.44, sx * (s.W / 2 - 0.07), wy - 0.02, wz - 0.03), '#15171b'));
  } else if (s.spoiler === 'duck') {
    B.paint.push(prep(box(s.W - 0.3, 0.06, 0.22, 0, s.tailTop + 0.06, zR + s.tailDz + 0.12, -0.3)));
  } else if (s.spoiler === 'roof') {
    B.paint.push(prep(box(cw * s.taper - 0.05, 0.05, 0.3, 0, s.roofY + 0.04, s.roofRZ - 0.08, -0.15)));
  }
  if (s.scoop) {
    const sz = (s.cowlZ + zF) / 2 - 0.05;
    const hy = s.hoodY + (s.noseTop - s.hoodY) * ((sz - s.cowlZ) / (zF - s.noseDz - s.cowlZ));
    B.paint.push(prep(box(0.62, 0.14, 0.8, 0, hy + 0.1, sz, 0.08)));
    B.trim.push(prep(box(0.5, 0.08, 0.04, 0, hy + 0.12, sz + 0.41), '#0b0b0d'));
  }
  if (s.stripes || livery === 'race') {
    const { g: st } = extrudeProfile(prof, 0.22, 0.0001, BS, 1);
    for (const sx of [-0.2, 0.2]) {
      const c = st.clone(); c.translate(sx, 0, 0);
      B.paint2.push(prep(c));
    }
    // roof-only stripes (keep glass clear)
    const roofPoly = [[s.roofFZ - 0.02, s.roofY - 0.04], [s.roofFZ - 0.1, s.roofY], [s.roofRZ + 0.1, s.roofY], [s.roofRZ + 0.02, s.roofY - 0.04]];
    const { g: st2 } = extrudeProfile(signedArea(roofPoly) < 0 ? roofPoly.reverse() : roofPoly, 0.22, 0.0001, CBS, 1);
    for (const sx of [-0.2, 0.2]) {
      const c = st2.clone(); c.translate(sx * s.taper, 0, 0);
      B.paint2.push(prep(c));
    }
  }
  if (s.bed) {
    B.trim.push(prep(box(s.W - 0.3, 0.04, (s.rwZ - 0.1) - (zR + 0.15), 0, s.deckY + 0.08, ((s.rwZ - 0.1) + (zR + 0.15)) / 2), '#1b1d21'));
  }
  if (s.rollbar) {
    const rz = s.rwZ - 0.25;
    for (const sx of [-1, 1]) B.trim.push(prep(cyl(0.05, 0.05, 0.62, 8, sx * (s.W / 2 - 0.2), s.deckY + 0.33, rz), '#222'));
    B.trim.push(prep(cyl(0.05, 0.05, s.W - 0.4, 8, 0, s.deckY + 0.64, rz, 'x'), '#222'));
    B.trim.push(prep(box(1.2, 0.1, 0.14, 0, s.roofY + 0.14, s.roofFZ - 0.2), '#15171b'));
    for (let k = -2; k <= 2; k++) B.head.push(prep(box(0.16, 0.07, 0.04, k * 0.23, s.roofY + 0.15, s.roofFZ - 0.12), '#fffbe6'));
  }
  if (s.bullbar) {
    B.trim.push(prep(box(s.W - 0.4, 0.08, 0.08, 0, s.noseBot + 0.35, zF + 0.12), '#2a2a2a'));
    B.trim.push(prep(box(s.W - 0.6, 0.08, 0.08, 0, s.noseBot + 0.08, zF + 0.1), '#2a2a2a'));
    for (const sx of [-0.45, 0.45]) B.trim.push(prep(box(0.08, 0.4, 0.08, sx, s.noseBot + 0.22, zF + 0.12), '#2a2a2a'));
  }
  if (s.neon) {
    for (const sx of [-1, 1]) B.glow.push(prep(box(0.03, 0.03, skirtLen + 0.4, sx * (s.W / 2 + 0.045), s.yb + 0.03, (s.fa + s.ra) / 2), '#ffffff'));
    B.glow.push(prep(box(s.W - 0.2, 0.025, 0.03, 0, hf.y - 0.09, hf.z + 0.01, hf.rx), '#ffffff'));
  }
  if (s.taxiSign) {
    B.trim.push(prep(box(0.8, 0.06, 0.3, 0, s.roofY + 0.08, (s.roofFZ + s.roofRZ) / 2), '#111'));
    B.decal.push(prep(box(0.72, 0.2, 0.24, 0, s.roofY + 0.2, (s.roofFZ + s.roofRZ) / 2)));
  }

  // ---- police liveries & light bars
  if (livery === 'police' || livery === 'swat') {
    const z0 = s.ra + s.wr + 0.22, z1 = s.fa - s.wr - 0.22;
    const panel = [];
    const N = 6;
    for (let i = 0; i <= N; i++) { const z = z0 + (z1 - z0) * i / N; panel.push([z, s.yb + 0.1]); }
    for (let i = N; i >= 0; i--) { const z = z0 + (z1 - z0) * i / N; panel.push([z, beltY(s, z) - (livery === 'swat' ? 0.35 : 0.06)]); }
    const poly = signedArea(panel) < 0 ? panel.slice().reverse() : panel;
    const px = () => s.W / 2 + 0.004;
    if (livery === 'police') {
      for (const side of [-1, 1]) B.paint2.push(prep(sidePolygon(poly, px, side)));
      // white roof
      const roofPanel = [[s.roofFZ - 0.08, s.roofY + CBS + 0.006], [s.roofRZ + 0.08, s.roofY + CBS + 0.006]];
      const rw = cDepth / 2 * s.taper;
      B.paint2.push(prep(quad([
        new THREE.Vector3(-rw, roofPanel[0][1], roofPanel[0][0]), new THREE.Vector3(rw, roofPanel[0][1], roofPanel[0][0]),
        new THREE.Vector3(rw, roofPanel[1][1], roofPanel[1][0]), new THREE.Vector3(-rw, roofPanel[1][1], roofPanel[1][0]),
      ], new THREE.Vector3(0, 1, 0))));
    } else {
      for (const side of [-1, 1]) {
        const band = [[z0 - 0.4, s.yb + 0.45], [z1 + 0.2, s.yb + 0.45], [z1 + 0.2, s.yb + 0.58], [z0 - 0.4, s.yb + 0.58]];
        B.paint2.push(prep(sidePolygon(signedArea(band) < 0 ? band.reverse() : band, px, side)));
      }
    }
    // decal text planes on doors
    const dz = (z0 + z1) / 2, dy = (s.yb + 0.1 + beltY(s, dz) - 0.06) / 2 + (livery === 'swat' ? 0.3 : 0);
    const dw = Math.min(1.5, (z1 - z0) * 0.8), dh = dw * 0.25;
    for (const side of [-1, 1]) {
      const x = side * (s.W / 2 + 0.01);
      const q = new THREE.PlaneGeometry(dw, dh);
      q.rotateY(side * Math.PI / 2);
      q.translate(x, dy, dz);
      // flip UV on one side so text reads correctly
      if (side < 0) { /* PlaneGeometry rotated -90 reads front-to-back already */ }
      B.decal.push(q);
    }
    // light bar
    const ly = s.roofY + CBS + 0.06, lz = (s.roofFZ + s.roofRZ) / 2 + 0.1;
    B.trim.push(prep(box(1.3, 0.07, 0.3, 0, ly, lz), '#1a1a1a'));
    B.red.push(prep(box(0.55, 0.12, 0.24, -0.33, ly + 0.08, lz)));
    B.blue.push(prep(box(0.55, 0.12, 0.24, 0.33, ly + 0.08, lz)));
    // push bar
    if (livery === 'police') {
      B.trim.push(prep(box(1.0, 0.3, 0.1, 0, s.noseBot + 0.22, zF + 0.1), '#141414'));
    }
  }

  const merged = {};
  for (const [k, list] of Object.entries(B)) {
    if (!list.length) continue;
    if (k === 'decal') {
      // decals keep UVs and are handled as simple meshes
      merged[k] = list;
      continue;
    }
    merged[k] = mergeGeometries(list, false);
  }
  const out = { spec: s, geo: merged };
  geoCache.set(key, out);
  return out;
}

// ---------------------------------------------------------------- wheels

const wheelCache = new Map();
function wheelGeometry(s) {
  const key = `${s.wr}|${s.ww}|${s.rim}`;
  if (wheelCache.has(key)) return wheelCache.get(key);
  const r = s.wr, w = s.ww;
  const rin = r * (s.rim === 'off' ? 0.58 : 0.66);
  const parts = [];
  const prof = [
    [rin, -w / 2], [r - 0.05, -w / 2], [r - 0.012, -w / 2 + 0.03], [r, -w / 2 + 0.07],
    [r, w / 2 - 0.07], [r - 0.012, w / 2 - 0.03], [r - 0.05, w / 2], [rin, w / 2],
  ].map((p) => new V2(p[0], p[1]));
  const tire = new THREE.LatheGeometry(prof, 22);
  tire.rotateZ(-Math.PI / 2);
  parts.push(prep(tire, '#161616'));
  if (s.rim === 'off') {
    // chunky tread blocks
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const g = box(w * 0.9, 0.05, 0.1, 0, 0, 0);
      g.translate(0, r + 0.005, 0);
      g.rotateX(a);
      parts.push(prep(g, '#1c1c1c'));
    }
  }
  const rimColor = { steel: '#8d9299', off: '#2b2b2b', disc: '#cfd3d8', aero: '#1e1f22' }[s.rim] || '#c9ccd1';
  const face = w / 2 - 0.02;
  const back = cyl(rin, rin, w * 0.9, 20, 0, 0, 0, 'x');
  parts.push(prep(back, '#2a2b2e'));
  const lip = new THREE.TorusGeometry(rin - 0.015, 0.022, 6, 24);
  lip.rotateY(Math.PI / 2);
  lip.translate(face, 0, 0);
  parts.push(prep(lip, rimColor));
  const hub = cyl(rin * 0.22, rin * 0.26, 0.06, 10, face, 0, 0, 'x');
  parts.push(prep(hub, rimColor));
  const spokes = { five: 5, multi: 10, aero: 6, off: 6, steel: 0, disc: 0 }[s.rim] ?? 5;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const sw = s.rim === 'multi' ? 0.04 : s.rim === 'off' ? 0.09 : 0.07;
    const g = box(0.04, rin * 0.82, sw, 0, 0, 0);
    g.translate(face - 0.01, rin * 0.41, 0);
    if (s.rim === 'aero') g.rotateX(0.35);
    const m = new THREE.Matrix4().makeRotationX(a);
    g.applyMatrix4(m);
    parts.push(prep(g, rimColor));
  }
  if (spokes === 0) {
    const disc = cyl(rin * 0.95, rin * 0.95, 0.03, 20, face - 0.02, 0, 0, 'x');
    parts.push(prep(disc, rimColor));
    for (let i = 0; i < (s.rim === 'steel' ? 6 : 5); i++) {
      const a = (i / 5) * Math.PI * 2;
      const g = cyl(0.035, 0.035, 0.04, 8, face, Math.cos(a) * rin * 0.55, Math.sin(a) * rin * 0.55, 'x');
      parts.push(prep(g, s.rim === 'steel' ? '#5b5f66' : '#111'));
    }
  }
  const g = mergeGeometries(parts, false);
  wheelCache.set(key, g);
  return g;
}

// ---------------------------------------------------------------- materials

let shared = null;
function sharedMaterials() {
  if (shared) return shared;
  const decalTex = {
    police: signTexture('POLICE', '#0b1a3a', 'rgba(0,0,0,0)'),
    swat: signTexture('S.W.A.T.', '#ffffff', 'rgba(0,0,0,0)'),
    taxi: signTexture('TAXI', '#111111', '#ffd000'),
  };
  shared = {
    trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1b2a3a, roughness: 0.08, metalness: 0.6, envMapIntensity: 1.2 }),
    head: new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.6, 1.6, 1.6) }),
    wheel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.55 }),
    policeWhite: new THREE.MeshStandardMaterial({
      vertexColors: true, color: 0xf2f4f7, roughness: 0.32, metalness: 0.3,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
    decal: {
      police: new THREE.MeshStandardMaterial({ map: decalTex.police, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, depthWrite: false }),
      swat: new THREE.MeshStandardMaterial({ map: decalTex.swat, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, depthWrite: false }),
      taxi: new THREE.MeshBasicMaterial({ map: decalTex.taxi }),
    },
    shadow: new THREE.MeshBasicMaterial({
      map: blobShadowTexture(), transparent: true, depthWrite: false, opacity: 0.75, color: 0x000000,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }),
    beam: new THREE.MeshBasicMaterial({
      map: beamTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35,
    }),
  };
  shared.glowTex = radialTexture();
  return shared;
}

// ---------------------------------------------------------------- public API

/**
 * Create a car. Returns an object with the root Object3D and handles for animation.
 * opts: { color, livery: 'police'|'swat'|'race'|null, accent, premium (clearcoat paint), neonColor }
 */
export function createCar(modelId, opts = {}) {
  const spec = SPECS[modelId];
  const { geo } = buildBody(modelId, opts.livery);
  const M = sharedMaterials();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const color = new THREE.Color(opts.color || '#cc2222');
  const paintMat = opts.premium
    ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06, vertexColors: true })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.3, vertexColors: true });
  const tailMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.1, 1.1, 1.1) });

  const add = (g, m, cast = true) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = cast;
    mesh.receiveShadow = false;
    body.add(mesh);
    return mesh;
  };
  add(geo.paint, paintMat);
  if (geo.paint2) {
    const m2 = opts.livery === 'police' || opts.livery === 'swat'
      ? M.policeWhite
      : new THREE.MeshStandardMaterial({
        color: new THREE.Color(opts.accent || '#ffffff'), vertexColors: true, roughness: 0.3, metalness: 0.4,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      });
    add(geo.paint2, m2, false);
  }
  add(geo.trim, M.trim);
  add(geo.glass, M.glass);
  add(geo.head, M.head, false);
  add(geo.tail, tailMat, false);
  let glowMat = null;
  if (geo.glow) {
    glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(opts.neonColor || '#35f2ff').multiplyScalar(2.2) });
    add(geo.glow, glowMat, false);
  }
  let red = null, blue = null;
  if (geo.red) {
    red = new THREE.MeshBasicMaterial({ color: 0xff2020 });
    blue = new THREE.MeshBasicMaterial({ color: 0x2060ff });
    add(geo.red, red, false);
    add(geo.blue, blue, false);
  }
  if (geo.decal) {
    const dm = opts.livery === 'swat' ? M.decal.swat : opts.livery === 'police' ? M.decal.police : M.decal.taxi;
    for (const g of geo.decal) add(g, dm, false);
  }

  // wheels
  const wg = wheelGeometry(spec);
  const wheels = [];
  const wx = spec.W / 2 - spec.ww / 2 + 0.02;
  for (const [z, front] of [[spec.fa, true], [spec.ra, false]]) {
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * wx, spec.wr, z);
      const spin = new THREE.Mesh(wg, M.wheel);
      spin.castShadow = true;
      if (side < 0) spin.rotation.y = Math.PI; // rim faces outward
      const holder = new THREE.Group();
      holder.add(spin);
      pivot.add(holder);
      root.add(pivot);
      wheels.push({ pivot, holder, spin, front, side });
    }
  }

  // blob shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(spec.W + 0.9, spec.L + 0.9), M.shadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  shadow.renderOrder = 1;
  root.add(shadow);

  // headlight beam (night)
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(11, 20), M.beam);
  beam.rotation.x = -Math.PI / 2;
  beam.rotation.z = Math.PI;
  beam.position.set(0, 0.06, spec.L / 2 + 10);
  beam.visible = false;
  beam.renderOrder = 2;
  root.add(beam);

  // light pool under police / neon underglow
  let pool = null;
  if (red || opts.underglow) {
    const pm = new THREE.MeshBasicMaterial({
      map: M.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      color: new THREE.Color(opts.underglow || '#ff2020'), opacity: 0.8,
    });
    pool = new THREE.Mesh(new THREE.PlaneGeometry(spec.W + (red ? 6 : 2.2), spec.L + (red ? 6 : 2.2)), pm);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.05;
    pool.renderOrder = 2;
    pool.visible = !red;
    root.add(pool);
  }

  return {
    root, body, wheels, spec, paintMat, tailMat, glowMat, red, blue, beam, shadow, pool,
    setColor(hex) { paintMat.color.set(hex); },
    dispose() {
      paintMat.dispose(); tailMat.dispose();
      red?.dispose(); blue?.dispose(); glowMat?.dispose(); pool?.material.dispose();
      shadow.geometry.dispose(); beam.geometry.dispose(); pool?.geometry.dispose();
    },
  };
}

export function carDims(modelId) {
  const s = SPECS[modelId];
  return { L: s.L, W: s.W, H: s.roofY };
}
