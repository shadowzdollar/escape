// Procedural city: districts, buildings, parks, a river with bridges, props,
// plus the road graph used by AI and a spatial hash for collisions.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITY } from './config.js';
import { mulberry32, clamp, rand, randInt, pick, valueNoise2D } from './utils.js';
import {
  asphaltTexture, groundTexture, sidewalkTexture, facadeTextures, radialTexture, signTexture,
} from './textures.js';

const { N, BLOCK, ROAD, SIDEWALK, CELL, RIVER_ROW, HALF } = CITY;
const RH = ROAD / 2;
export const rc = (i) => (i - N / 2) * CELL; // road-center coordinate for line i

const THEMES = {
  city: {
    ground: 'grass', road: '#393c41', sidewalk: '#bdb9b0', curb: '#9d9a93',
    facades: { office: { cw: 3.4, ch: 3.6 }, glass: { cw: 3.0, ch: 3.8 }, residential: { cw: 3.0, ch: 3.1 } },
    wall: ['#ece6da', '#d9cbb5', '#c9b49b', '#aab5c0', '#d4dbe0', '#e3cba8', '#b7a996', '#dcd6c9', '#a3b6c4', '#e6d8cd', '#c98f7b', '#8fa3ad'],
    glassTint: ['#9fc0dc', '#86a9c7', '#b1d0e2', '#7f9db6', '#a9c3cf', '#9cb7a8'],
    houseRoof: ['#8c3b2a', '#6d4c41', '#4a4e57', '#a0522d', '#5b6770'],
    flatRoof: ['#8c8f94', '#7b7e83', '#9a9da1', '#6f7378'],
    tree: 'round', maxH: 95, water: '#2f6f93', lineAlpha: 1, snowRoof: false,
  },
  desert: {
    ground: 'sand', road: '#4d463f', sidewalk: '#d2bf9a', curb: '#b9a47f',
    facades: { adobe: { cw: 3.2, ch: 3.4 }, residential: { cw: 3.0, ch: 3.1 }, office: { cw: 3.4, ch: 3.6 } },
    wall: ['#ecd2a6', '#dfbb8c', '#f2dfbd', '#d7a676', '#eac6a0', '#cc9e71', '#f4e3c6', '#e0b48a', '#c98c64'],
    glassTint: ['#b7cfd6', '#9fbcc4'],
    houseRoof: ['#b5653c', '#9c4f2e', '#c2703f'],
    flatRoof: ['#c8a67e', '#b9976f', '#d3b58f'],
    tree: 'palm', maxH: 42, water: '#2e9aa6', lineAlpha: 0.7, snowRoof: false,
  },
  snow: {
    ground: 'snow', road: '#4a4f56', sidewalk: '#dfe5ec', curb: '#c6ccd3',
    facades: { brick: { cw: 3.0, ch: 3.2 }, residential: { cw: 3.0, ch: 3.1 }, office: { cw: 3.4, ch: 3.6 } },
    wall: ['#b23a48', '#8c2f39', '#3d5a80', '#e0e1dd', '#98c1d9', '#7a6c5d', '#c9ada7', '#e9c46a', '#577590', '#f1ede4'],
    glassTint: ['#b8cfe0', '#a5bfd3'],
    houseRoof: ['#f4f7fb'],
    flatRoof: ['#eef2f7', '#e6ebf1'],
    tree: 'pine', maxH: 75, water: '#b9d6e6', lineAlpha: 0.55, snowRoof: true,
  },
};

// ------------------------------------------------------------------ x-ray cutout
// Building fragments between the camera and the player are dithered away so the
// car is never hidden behind a tower.
export const cutout = {
  uCutPos: { value: new THREE.Vector3() },
  uCamPos: { value: new THREE.Vector3() },
  uCutOn: { value: 0 },
};
function applyCutout(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, cutout);
    sh.vertexShader = 'varying vec3 vWorldPosC;\n' + sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n  vWorldPosC = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWorldPosC;\nuniform vec3 uCutPos;\nuniform vec3 uCamPos;\nuniform float uCutOn;\n' +
      sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  if (uCutOn > 0.5) {
    vec3 toP = uCutPos - uCamPos;
    float dP = length(toP);
    vec3 dir = toP / dP;
    vec3 toF = vWorldPosC - uCamPos;
    float along = dot(toF, dir);
    if (along < dP - 2.5) {
      float perp = length(toF - dir * along);
      float r = 2.5 + 6.0 * clamp(along / dP, 0.0, 1.0);
      if (perp < r) {
        float edge = smoothstep(r * 0.82, r, perp);
        ivec2 q = ivec2(mod(gl_FragCoord.xy, 4.0));
        int bi = q.x + q.y * 4;
        float bayer[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
        if ((bayer[bi] + 0.5) / 16.0 > edge) discard;
      }
    }
  }`);
  };
  mat.customProgramCacheKey = () => 'cutout';
}

// ------------------------------------------------------------------ geometry bucket

class Bucket {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; }
  tri(a, b, c, uva, uvb, uvc, col) {
    this.p.push(...a, ...b, ...c);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    for (let k = 0; k < 3; k++) { this.n.push(nx, ny, nz); this.c.push(col.r, col.g, col.b); }
    this.uv.push(...uva, ...uvb, ...uvc);
  }
  // quad a,b,c,d with desired normal n; uvs per corner
  quad(a, b, c, d, n, uvs, col) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) {
      this.tri(a, b, c, uvs[0], uvs[1], uvs[2], col);
      this.tri(a, c, d, uvs[0], uvs[2], uvs[3], col);
    } else {
      this.tri(a, c, b, uvs[0], uvs[2], uvs[1], col);
      this.tri(a, d, c, uvs[0], uvs[3], uvs[2], col);
    }
  }
  get empty() { return this.p.length === 0; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}

const tmpColor = new THREE.Color();
const col = (hex) => new THREE.Color(hex);

// Horizontal quad with world-planar UVs.
function hquad(b, x0, z0, x1, z1, y, color, uvScale = 8) {
  b.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0],
    [[x0 / uvScale, z0 / uvScale], [x1 / uvScale, z0 / uvScale], [x1 / uvScale, z1 / uvScale], [x0 / uvScale, z1 / uvScale]], color);
}

// Box with facade UVs on sides (u along wall, v along height from yBase) and planar top.
function fbox(side, top, x0, x1, y0, y1, z0, z1, sideCol, topCol, f, yBase = y0, uo = 0, vo = 0) {
  const U = (d) => d / (8 * f.cw) + uo;
  const Vv = (y) => (y - yBase) / (8 * f.ch) + vo;
  const w = x1 - x0, d = z1 - z0;
  // -z face
  side.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1],
    [[U(0), Vv(y0)], [U(w), Vv(y0)], [U(w), Vv(y1)], [U(0), Vv(y1)]], sideCol);
  // +z face
  side.quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [0, 0, 1],
    [[U(0) + 0.37, Vv(y0)], [U(w) + 0.37, Vv(y0)], [U(w) + 0.37, Vv(y1)], [U(0) + 0.37, Vv(y1)]], sideCol);
  // -x face
  side.quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [-1, 0, 0],
    [[U(0) + 0.62, Vv(y0)], [U(d) + 0.62, Vv(y0)], [U(d) + 0.62, Vv(y1)], [U(0) + 0.62, Vv(y1)]], sideCol);
  // +x face
  side.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0],
    [[U(0) + 0.25, Vv(y0)], [U(d) + 0.25, Vv(y0)], [U(d) + 0.25, Vv(y1)], [U(0) + 0.25, Vv(y1)]], sideCol);
  if (top) hquad(top, x0, z0, x1, z1, y1, topCol);
}

// Plain box with planar-ish UVs (for concrete, roofs, props merged in buckets).
function pbox(b, x0, x1, y0, y1, z0, z1, color, topColor = color) {
  const s = 4;
  b.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], [[x0 / s, y0 / s], [x1 / s, y0 / s], [x1 / s, y1 / s], [x0 / s, y1 / s]], color);
  b.quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [0, 0, 1], [[x1 / s, y0 / s], [x0 / s, y0 / s], [x0 / s, y1 / s], [x1 / s, y1 / s]], color);
  b.quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [-1, 0, 0], [[z1 / s, y0 / s], [z0 / s, y0 / s], [z0 / s, y1 / s], [z1 / s, y1 / s]], color);
  b.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], [[z0 / s, y0 / s], [z1 / s, y0 / s], [z1 / s, y1 / s], [z0 / s, y1 / s]], color);
  hquad(b, x0, z0, x1, z1, y1, topColor, s);
}

// Gable roof prism along the longer axis.
function gableRoof(b, x0, x1, z0, z1, y0, h, roofCol, gableCol) {
  const alongX = (x1 - x0) >= (z1 - z0);
  const o = 0.4; // overhang
  if (alongX) {
    const zm = (z0 + z1) / 2;
    const A = [x0 - o, y0, z0 - o], B = [x1 + o, y0, z0 - o], C = [x1 + o, y0 + h, zm], D = [x0 - o, y0 + h, zm];
    b.quad(A, B, C, D, [0, 0.7, -0.7], [[0, 0], [1, 0], [1, 1], [0, 1]], roofCol);
    const E = [x0 - o, y0, z1 + o], F = [x1 + o, y0, z1 + o];
    b.quad(F, E, D, C, [0, 0.7, 0.7], [[0, 0], [1, 0], [1, 1], [0, 1]], roofCol);
    b.tri([x0, y0, z0], [x0, y0, z1], [x0, y0 + h, zm], [0, 0], [1, 0], [0.5, 1], gableCol);
    b.tri([x1, y0, z1], [x1, y0, z0], [x1, y0 + h, zm], [0, 0], [1, 0], [0.5, 1], gableCol);
  } else {
    const xm = (x0 + x1) / 2;
    const A = [x0 - o, y0, z1 + o], B = [x0 - o, y0, z0 - o], C = [xm, y0 + h, z0 - o], D = [xm, y0 + h, z1 + o];
    b.quad(A, B, C, D, [-0.7, 0.7, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], roofCol);
    const E = [x1 + o, y0, z0 - o], F = [x1 + o, y0, z1 + o];
    b.quad(E, F, D, C, [0.7, 0.7, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], roofCol);
    b.tri([x1, y0, z0], [x0, y0, z0], [xm, y0 + h, z0], [0, 0], [1, 0], [0.5, 1], gableCol);
    b.tri([x0, y0, z1], [x1, y0, z1], [xm, y0 + h, z1], [0, 0], [1, 0], [0.5, 1], gableCol);
  }
}

// ------------------------------------------------------------------ prop geometries

function propGeometries() {
  const g = {};
  const t = (geo, x, y, z) => { geo.translate(x, y, z); return geo; };
  const strip = (geo) => { const n = geo.index ? geo.toNonIndexed() : geo; if (n.attributes.uv) n.deleteAttribute('uv'); return n; };
  g.trunk = t(new THREE.CylinderGeometry(0.16, 0.26, 2.4, 6), 0, 1.2, 0);
  g.crown = t(new THREE.IcosahedronGeometry(1.7, 0), 0, 3.4, 0);
  g.pine = mergeGeometries([
    strip(t(new THREE.ConeGeometry(1.9, 3.2, 7), 0, 2.6, 0)),
    strip(t(new THREE.ConeGeometry(1.4, 2.6, 7), 0, 4.2, 0)),
    strip(t(new THREE.ConeGeometry(0.9, 1.9, 7), 0, 5.5, 0)),
  ]);
  g.palmTrunk = t(new THREE.CylinderGeometry(0.16, 0.24, 6.5, 6), 0, 3.25, 0);
  const leaves = [];
  for (let i = 0; i < 7; i++) {
    const l = new THREE.BoxGeometry(0.5, 0.06, 3.0);
    l.translate(0, 0, 1.5);
    l.rotateX(0.35);
    l.rotateY((i / 7) * Math.PI * 2);
    l.translate(0, 6.5, 0);
    leaves.push(strip(l));
  }
  g.palmLeaves = mergeGeometries(leaves);
  g.cactus = mergeGeometries([
    strip(t(new THREE.CylinderGeometry(0.3, 0.34, 3.2, 7), 0, 1.6, 0)),
    strip(t(new THREE.CylinderGeometry(0.18, 0.2, 1.2, 6), 0.6, 1.9, 0)),
    strip(t(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 6).rotateZ(Math.PI / 2), 0.35, 1.35, 0)),
    strip(t(new THREE.CylinderGeometry(0.16, 0.18, 0.9, 6), -0.55, 2.3, 0)),
    strip(t(new THREE.CylinderGeometry(0.17, 0.17, 0.45, 6).rotateZ(Math.PI / 2), -0.33, 1.9, 0)),
  ]);
  g.bush = t(new THREE.IcosahedronGeometry(0.9, 0), 0, 0.6, 0);
  g.lampPole = mergeGeometries([
    strip(t(new THREE.CylinderGeometry(0.08, 0.12, 6.4, 6), 0, 3.2, 0)),
    strip(t(new THREE.BoxGeometry(0.1, 0.1, 1.8), 0, 6.3, 0.85)),
  ]);
  g.lampHead = t(new THREE.BoxGeometry(0.34, 0.12, 0.6), 0, 6.22, 1.6);
  g.hydrant = mergeGeometries([
    strip(t(new THREE.CylinderGeometry(0.17, 0.2, 0.7, 8), 0, 0.35, 0)),
    strip(t(new THREE.SphereGeometry(0.17, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.7, 0)),
    strip(t(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 6).rotateZ(Math.PI / 2), 0, 0.45, 0)),
  ]);
  g.bench = mergeGeometries([
    strip(t(new THREE.BoxGeometry(1.8, 0.08, 0.5), 0, 0.45, 0)),
    strip(t(new THREE.BoxGeometry(1.8, 0.45, 0.08), 0, 0.72, -0.22)),
    strip(t(new THREE.BoxGeometry(0.08, 0.45, 0.45), -0.8, 0.22, 0)),
    strip(t(new THREE.BoxGeometry(0.08, 0.45, 0.45), 0.8, 0.22, 0)),
  ]);
  g.trash = t(new THREE.CylinderGeometry(0.3, 0.26, 0.95, 8), 0, 0.47, 0);
  g.cone = mergeGeometries([
    strip(t(new THREE.ConeGeometry(0.24, 0.75, 8), 0, 0.4, 0)),
    strip(t(new THREE.BoxGeometry(0.55, 0.05, 0.55), 0, 0.025, 0)),
  ]);
  g.container = t(new THREE.BoxGeometry(2.45, 2.6, 6.1), 0, 1.3, 0);
  g.jersey = (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.3, 0); s.lineTo(0.3, 0); s.lineTo(0.18, 0.3); s.lineTo(0.1, 0.85); s.lineTo(-0.1, 0.85); s.lineTo(-0.18, 0.3); s.closePath();
    const e = new THREE.ExtrudeGeometry(s, { depth: 3.0, bevelEnabled: false });
    e.translate(0, 0, -1.5);
    return strip(e);
  })();
  g.pool = new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2).translate(0, 0.2, 1.6);
  g.beacon = new THREE.SphereGeometry(0.35, 6, 4);
  g.neon = new THREE.BoxGeometry(1, 1, 1);
  g.snowPile = t(new THREE.SphereGeometry(1, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.4, 0.55, 1), 0, 0, 0);
  g.rock = t(new THREE.DodecahedronGeometry(1.0, 0), 0, 0.4, 0);
  return g;
}

// ------------------------------------------------------------------ City

export class City {
  constructor(map, { quality = 'high' } = {}) {
    this.map = map;
    this.theme = THEMES[map.theme];
    this.quality = quality;
    this.rng = mulberry32(map.seed);
    this.noise = valueNoise2D(map.seed + 7);
    this.group = new THREE.Group();
    this.group.name = 'city';
    this.boxes = [];     // static AABB colliders
    this.circles = [];   // round colliders (trees, poles, breakables)
    this.hashSize = 16;
    this.hash = new Map();
    this.stamp = 0;
    this.blocks = [];
    this.props = {};      // name -> {geo, mat, list:[{m, color}]}
    this.breakables = []; // collider circles that can be smashed
    this.debris = [];
    this.animated = [];
    this.night = map.time === 'night';
    this.build();
  }

  // ---------------------------------------------------------------- spatial hash
  _cells(x0, z0, x1, z1, fn) {
    const s = this.hashSize;
    const i0 = Math.floor(x0 / s), i1 = Math.floor(x1 / s);
    const j0 = Math.floor(z0 / s), j1 = Math.floor(z1 / s);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) fn(i * 73856093 ^ j * 19349663);
  }
  _insert(obj, x0, z0, x1, z1) {
    this._cells(x0, z0, x1, z1, (k) => {
      let a = this.hash.get(k);
      if (!a) { a = []; this.hash.set(k, a); }
      a.push(obj);
    });
  }
  addBox(x0, x1, z0, z1, kind = 'building', h = 10) {
    const b = { type: 'box', x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), kind, h, s: 0 };
    this.boxes.push(b);
    this._insert(b, b.x0, b.z0, b.x1, b.z1);
    return b;
  }
  addCircle(x, z, r, kind = 'pole', breakable = null) {
    const c = { type: 'circle', x, z, r, kind, breakable, alive: true, s: 0 };
    this.circles.push(c);
    this._insert(c, x - r, z - r, x + r, z + r);
    if (breakable) this.breakables.push(c);
    return c;
  }
  // Calls fn(collider) for each collider overlapping the square around (x,z).
  query(x, z, r, fn) {
    const st = ++this.stamp;
    this._cells(x - r, z - r, x + r, z + r, (k) => {
      const a = this.hash.get(k);
      if (!a) return;
      for (const o of a) {
        if (o.s === st) continue;
        o.s = st;
        if (o.type === 'circle' && !o.alive) continue;
        if (o.dead) continue;
        fn(o);
      }
    });
  }
  // true if point is inside a building/solid box (inflated by pad)
  pointBlocked(x, z, pad = 0) {
    let hit = false;
    this.query(x, z, pad + 1, (o) => {
      if (hit || o.type !== 'box') return;
      if (x > o.x0 - pad && x < o.x1 + pad && z > o.z0 - pad && z < o.z1 + pad) hit = true;
    });
    return hit;
  }
  segmentBlocked(ax, az, bx, bz, pad = 1.2) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(d / 3));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      if (this.pointBlocked(ax + (bx - ax) * t, az + (bz - az) * t, pad)) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- road graph
  nodeId(i, j) { return j * (N + 1) + i; }
  nodePos(id) { const i = id % (N + 1), j = Math.floor(id / (N + 1)); return { x: rc(i), z: rc(j), i, j }; }
  nearestNode(x, z) {
    const i = clamp(Math.round(x / CELL + N / 2), 0, N);
    const j = clamp(Math.round(z / CELL + N / 2), 0, N);
    return this.nodeId(i, j);
  }
  hasBridge(i) { return i % 4 === 0; }
  buildGraph() {
    this.adj = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const id = this.nodeId(i, j);
      const a = [];
      if (i > 0) a.push(this.nodeId(i - 1, j));
      if (i < N) a.push(this.nodeId(i + 1, j));
      if (j > 0 && !(j - 1 === RIVER_ROW && !this.hasBridge(i))) a.push(this.nodeId(i, j - 1));
      if (j < N && !(j === RIVER_ROW && !this.hasBridge(i))) a.push(this.nodeId(i, j + 1));
      this.adj[id] = a;
    }
  }
  // A* over the grid graph. Returns array of node ids (excluding start).
  findPath(from, to) {
    if (from === to) return [];
    const total = (N + 1) * (N + 1);
    const g = new Float32Array(total).fill(Infinity);
    const came = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);
    const h = (id) => { const a = this.nodePos(id), b = this.nodePos(to); return Math.abs(a.i - b.i) + Math.abs(a.j - b.j); };
    const open = [from];
    g[from] = 0;
    const f = new Float32Array(total).fill(Infinity);
    f[from] = h(from);
    let guard = 0;
    while (open.length && guard++ < 2000) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
      const cur = open[bi];
      open.splice(bi, 1);
      if (cur === to) break;
      closed[cur] = 1;
      for (const nb of this.adj[cur]) {
        if (closed[nb]) continue;
        const ng = g[cur] + 1;
        if (ng < g[nb]) {
          g[nb] = ng; came[nb] = cur; f[nb] = ng + h(nb);
          if (!open.includes(nb)) open.push(nb);
        }
      }
    }
    const path = [];
    let c = to;
    while (c !== -1 && c !== from) { path.push(c); c = came[c]; }
    if (c !== from) return [];
    return path.reverse();
  }

  // Is (x,z) on a drivable road surface (not a block)?
  isRoad(x, z) {
    if (Math.abs(x) > HALF || Math.abs(z) > HALF) return false;
    const fx = ((x - rc(0)) % CELL + CELL) % CELL;
    const fz = ((z - rc(0)) % CELL + CELL) % CELL;
    const onX = fx < RH || fx > CELL - RH;
    const onZ = fz < RH || fz > CELL - RH;
    if (!onX && !onZ) return false;
    // river crossing without bridge
    const bj = Math.floor((z - rc(0)) / CELL);
    if (bj === RIVER_ROW && !onZ) {
      const i = Math.round((x - rc(0)) / CELL);
      if (!this.hasBridge(i)) return false;
    }
    return true;
  }
  groundHeight(x, z) {
    if (Math.abs(x) > HALF || Math.abs(z) > HALF) return 0;
    const fx = ((x - rc(0)) % CELL + CELL) % CELL;
    const fz = ((z - rc(0)) % CELL + CELL) % CELL;
    if (fx < RH || fx > CELL - RH || fz < RH || fz > CELL - RH) return 0;
    const bj = Math.floor((z - rc(0)) / CELL);
    if (bj === RIVER_ROW) return 0;
    return 0.15;
  }
  // A random point on a road lane, between minD and maxD from (cx,cz).
  randomRoadSpot(rng, cx, cz, minD, maxD, tries = 40) {
    for (let t = 0; t < tries; t++) {
      const ang = rng() * Math.PI * 2;
      const d = minD + (maxD - minD) * rng();
      let x = cx + Math.cos(ang) * d, z = cz + Math.sin(ang) * d;
      // snap to the nearest road line
      const li = Math.round(x / CELL + N / 2), lj = Math.round(z / CELL + N / 2);
      const sx = rc(clamp(li, 0, N)), sz = rc(clamp(lj, 0, N));
      let dir;
      if (Math.abs(x - sx) < Math.abs(z - sz)) { x = sx; dir = rng() < 0.5 ? 0 : Math.PI; } else { z = sz; dir = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2; }
      if (Math.abs(x) > HALF - 6 || Math.abs(z) > HALF - 6) continue;
      if (!this.isRoad(x, z)) continue;
      const dd = Math.hypot(x - cx, z - cz);
      if (dd < minD || dd > maxD) continue;
      return { x, z, heading: dir };
    }
    return null;
  }

  // ---------------------------------------------------------------- build
  build() {
    const T = this.theme;
    const rng = this.rng;
    this.buildGraph();

    // materials
    this.tex = {
      asphalt: asphaltTexture(T.road, this.map.seed),
      ground: groundTexture(T.ground, this.map.seed + 1),
      sidewalk: sidewalkTexture(T.sidewalk, this.map.seed + 2),
      grass: groundTexture(this.map.theme === 'snow' ? 'snow' : this.map.theme === 'desert' ? 'sand' : 'grass', this.map.seed + 3),
      dirt: groundTexture(this.map.theme === 'snow' ? 'snow' : 'dirt', this.map.seed + 4),
    };
    this.facadeTex = {};
    for (const style of Object.keys(T.facades)) this.facadeTex[style] = facadeTextures(style, this.map.seed + style.length * 11);

    const M = this.materials = {
      asphalt: new THREE.MeshStandardMaterial({ map: this.tex.asphalt, roughness: this.night ? 0.45 : 0.92, metalness: this.night ? 0.25 : 0.0 }),
      ground: new THREE.MeshStandardMaterial({ map: this.tex.ground, roughness: 1 }),
      sidewalk: new THREE.MeshStandardMaterial({ map: this.tex.sidewalk, vertexColors: true, roughness: 0.9 }),
      grass: new THREE.MeshStandardMaterial({ map: this.tex.grass, vertexColors: true, roughness: 1 }),
      dirt: new THREE.MeshStandardMaterial({ map: this.tex.dirt, vertexColors: true, roughness: 1 }),
      parking: new THREE.MeshStandardMaterial({ map: this.tex.asphalt, vertexColors: true, roughness: 0.9 }),
      concrete: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 }),
      roof: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
      markings: new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.7, transparent: T.lineAlpha < 1, opacity: T.lineAlpha,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: T.lineAlpha >= 1,
      }),
      water: new THREE.MeshStandardMaterial({ color: T.water, roughness: this.map.theme === 'snow' ? 0.35 : 0.08, metalness: 0.2, transparent: true, opacity: 0.92 }),
    };
    applyCutout(M.roof);
    applyCutout(M.concrete);
    this.facadeMats = {};
    for (const [style, tx] of Object.entries(this.facadeTex)) {
      this.facadeMats[style] = new THREE.MeshStandardMaterial({
        map: tx.map, emissiveMap: tx.emissive, emissive: new THREE.Color(this.night ? 0xffe2b0 : 0x000000),
        emissiveIntensity: this.night ? 1.25 : 0, vertexColors: true, roughness: style === 'glass' ? 0.25 : 0.8,
        metalness: style === 'glass' ? 0.5 : 0.05,
      });
      applyCutout(this.facadeMats[style]);
    }

    // chunked buckets: chunk -> name -> Bucket
    this.chunks = new Map();
    const P = this.props = {};
    const pg = propGeometries();
    const addPropType = (name, geo, mat, { cast = true, colors = false } = {}) => {
      P[name] = { geo, mat, list: [], cast, colors };
    };
    const trim = new THREE.MeshStandardMaterial({ color: 0x3d4148, roughness: 0.6, metalness: 0.4 });
    addPropType('trunk', pg.trunk, new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 1 }));
    addPropType('crown', pg.crown, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), { colors: true });
    addPropType('pine', pg.pine, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), { colors: true });
    addPropType('palmTrunk', pg.palmTrunk, new THREE.MeshStandardMaterial({ color: 0x8b6b4a, roughness: 1 }));
    addPropType('palmLeaves', pg.palmLeaves, new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 0.9, side: THREE.DoubleSide }), { colors: true });
    addPropType('cactus', pg.cactus, new THREE.MeshStandardMaterial({ color: 0x4f7f3a, roughness: 0.9, flatShading: true }), { colors: true });
    addPropType('bush', pg.bush, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), { colors: true });
    addPropType('rock', pg.rock, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), { colors: true });
    addPropType('lampPole', pg.lampPole, trim);
    this.lampHeadMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.night ? 3.2 : 0.9, this.night ? 2.8 : 0.9, this.night ? 2.0 : 0.85) });
    addPropType('lampHead', pg.lampHead, this.lampHeadMat, { cast: false });
    addPropType('hydrant', pg.hydrant, new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.5, metalness: 0.3 }));
    addPropType('bench', pg.bench, new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.8 }));
    addPropType('trash', pg.trash, new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.6, metalness: 0.3 }));
    addPropType('cone', pg.cone, new THREE.MeshStandardMaterial({ color: 0xff6b1a, roughness: 0.6 }));
    addPropType('container', pg.container, new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.4 }), { colors: true });
    addPropType('jersey', pg.jersey, new THREE.MeshStandardMaterial({ color: 0xc9c6bf, roughness: 0.9 }));
    addPropType('snowPile', pg.snowPile, new THREE.MeshStandardMaterial({ color: 0xf4f8fc, roughness: 0.9, flatShading: true }), { cast: false });
    const poolMat = new THREE.MeshBasicMaterial({
      map: radialTexture('rgba(255,210,150,0.55)', 'rgba(255,210,150,0)'), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    addPropType('pool', pg.pool, poolMat, { cast: false });
    this.beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.2) });
    addPropType('beacon', pg.beacon, this.beaconMat, { cast: false });
    this.neonMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(this.night ? 2.6 : 0.9) });
    addPropType('neon', pg.neon, this.neonMat, { cast: false, colors: true });

    this.generateBlocks();
    this.buildRoads();
    this.buildRiver();
    this.buildBoundary();
    this.buildOutskirts();
    this.finalize();
  }

  bucket(chunkKey, name) {
    let c = this.chunks.get(chunkKey);
    if (!c) { c = {}; this.chunks.set(chunkKey, c); }
    if (!c[name]) c[name] = new Bucket();
    return c[name];
  }

  prop(name, x, y, z, rotY = 0, scale = 1, color = null, sx = scale, sy = scale, sz = scale) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
      new THREE.Vector3(sx, sy, sz),
    );
    const list = this.props[name].list;
    list.push({ m, color });
    return list.length - 1;
  }

  tree(x, z, y = 0.15, collide = true) {
    const rng = this.rng;
    const T = this.theme;
    const s = rand(rng, 0.8, 1.25);
    const kind = T.tree;
    if (kind === 'pine') {
      this.prop('trunk', x, y, z, 0, s * 0.8);
      this.prop('pine', x, y, z, rng() * 6, s, pick(rng, ['#2d5a3d', '#35684a', '#264d36', '#3f6e4f']));
    } else if (kind === 'palm') {
      this.prop('palmTrunk', x, y, z, 0, s);
      this.prop('palmLeaves', x, y, z, rng() * 6, s, pick(rng, ['#4f8a3a', '#5d9a45', '#6a9b3c']));
    } else {
      this.prop('trunk', x, y, z, 0, s);
      const autumn = rng() < 0.12;
      this.prop('crown', x, y, z, rng() * 6, s, autumn ? pick(rng, ['#d98c2b', '#c4572a']) : pick(rng, ['#4c8c3a', '#5a9a44', '#3f7a33', '#6aa84f', '#4f8f5a']));
    }
    if (collide) this.addCircle(x, z, 0.45 * s, 'tree');
  }

  smallTree(x, z, y) {
    const rng = this.rng;
    if (this.theme.tree === 'palm') this.prop('cactus', x, y, z, rng() * 6, rand(rng, 0.7, 1.1), pick(rng, ['#4f7f3a', '#5a8a42']));
    else this.prop('bush', x, y, z, rng() * 6, rand(rng, 0.7, 1.3), this.theme.tree === 'pine' ? '#e8eef4' : pick(rng, ['#3f7a33', '#4c8c3a', '#5a9a44']));
  }

  lamp(x, z, rotY) {
    const a = this.prop('lampPole', x, 0.15, z, rotY);
    const b = this.prop('lampHead', x, 0.15, z, rotY);
    let c = -1;
    if (this.night) c = this.prop('pool', x, 0, z, rotY);
    this.addCircle(x, z, 0.3, 'lamp', { parts: [['lampPole', a], ['lampHead', b], ...(c >= 0 ? [['pool', c]] : [])], kind: 'lamp' });
  }

  breakableProp(name, x, z, rotY, r) {
    const idx = this.prop(name, x, 0.15, z, rotY);
    this.addCircle(x, z, r, name, { parts: [[name, idx]], kind: name, rotY });
  }

  // ---------------------------------------------------------------- blocks
  generateBlocks() {
    const rng = this.rng;
    const T = this.theme;
    const theme = this.map.theme;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        if (j === RIVER_ROW) continue;
        const x0 = rc(i) + RH, x1 = rc(i + 1) - RH;
        const z0 = rc(j) + RH, z1 = rc(j + 1) - RH;
        const ci = i + 0.5 - N / 2, cj = j + 0.5 - N / 2;
        const d = Math.max(Math.abs(ci), Math.abs(cj)) / (N / 2);
        const n = this.noise(i * 0.45, j * 0.45);
        let type;
        const r = rng();
        if (i === N / 2 - 1 && j === N / 2 - 1) type = 'bank';
        else if (theme !== 'desert' && i <= 3 && j >= N - 5) type = 'industrial';
        else if (theme === 'desert' && i >= N - 4 && j <= 3) type = 'industrial';
        else if (r < 0.08 && !(i === N / 2 - 1 && j === N / 2 - 1)) type = 'park';
        else if (r < 0.12) type = 'plaza';
        else if (r < 0.15) type = 'parking';
        else if (d < 0.3 + (n - 0.5) * 0.25) type = 'downtown';
        else if (d < 0.66 + (n - 0.5) * 0.3) type = 'midtown';
        else type = 'suburb';
        if (theme === 'desert' && type === 'downtown' && d > 0.2) type = 'midtown';
        const chunk = `${Math.floor(i / 2)},${Math.floor(j / 2)}`;
        const blk = { i, j, x0, x1, z0, z1, type, d, chunk };
        this.blocks.push(blk);
        this.buildBlock(blk);
      }
    }
  }

  buildBlock(b) {
    const rng = this.rng;
    const T = this.theme;
    const { x0, x1, z0, z1, chunk } = b;
    const sw = this.bucket(chunk, 'sidewalk');
    const curb = this.bucket(chunk, 'concrete');
    const Y = 0.15;
    // slab: sidewalk top + curb sides
    hquad(sw, x0, z0, x1, z1, Y, col('#ffffff'), 4);
    const cc = col(T.curb);
    curb.quad([x0, 0, z0], [x1, 0, z0], [x1, Y, z0], [x0, Y, z0], [0, 0, -1], [[0, 0], [1, 0], [1, 1], [0, 1]], cc);
    curb.quad([x1, 0, z1], [x0, 0, z1], [x0, Y, z1], [x1, Y, z1], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]], cc);
    curb.quad([x0, 0, z1], [x0, 0, z0], [x0, Y, z0], [x0, Y, z1], [-1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], cc);
    curb.quad([x1, 0, z0], [x1, 0, z1], [x1, Y, z1], [x1, Y, z0], [1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], cc);

    const ix0 = x0 + SIDEWALK, ix1 = x1 - SIDEWALK, iz0 = z0 + SIDEWALK, iz1 = z1 - SIDEWALK;

    // sidewalk lamps + street trees
    const edgeProps = (type) => {
      const spacing = 19;
      const sides = [
        { ax: x0 + 0.9, az: z0 + 4, bx: x0 + 0.9, bz: z1 - 4, rot: -Math.PI / 2 },
        { ax: x1 - 0.9, az: z0 + 4, bx: x1 - 0.9, bz: z1 - 4, rot: Math.PI / 2 },
        { ax: x0 + 4, az: z0 + 0.9, bx: x1 - 4, bz: z0 + 0.9, rot: Math.PI },
        { ax: x0 + 4, az: z1 - 0.9, bx: x1 - 4, bz: z1 - 0.9, rot: 0 },
      ];
      for (const s of sides) {
        const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
        const n = Math.floor(len / spacing);
        for (let k = 0; k <= n; k++) {
          const t = n === 0 ? 0.5 : k / n;
          const x = s.ax + (s.bx - s.ax) * t, z = s.az + (s.bz - s.az) * t;
          if (k % 2 === 0) this.lamp(x, z, s.rot);
          else if (type !== 'downtown' && type !== 'industrial' && rng() < 0.7) this.tree(x, z);
          else if (rng() < 0.35) this.breakableProp(pick(rng, ['hydrant', 'trash', 'bench']), x, z, s.rot + Math.PI, 0.35);
        }
      }
    };
    edgeProps(b.type);

    switch (b.type) {
      case 'downtown': this.buildDowntown(b, ix0, ix1, iz0, iz1); break;
      case 'midtown': this.buildMidtown(b, ix0, ix1, iz0, iz1); break;
      case 'suburb': this.buildSuburb(b, ix0, ix1, iz0, iz1); break;
      case 'industrial': this.buildIndustrial(b, ix0, ix1, iz0, iz1); break;
      case 'park': this.buildPark(b, ix0, ix1, iz0, iz1); break;
      case 'plaza': this.buildPlaza(b, ix0, ix1, iz0, iz1); break;
      case 'parking': this.buildParking(b, ix0, ix1, iz0, iz1); break;
      case 'bank': this.buildBank(b, ix0, ix1, iz0, iz1); break;
    }
  }

  facadeStyleFor(kind) {
    const f = Object.keys(this.theme.facades);
    if (kind === 'tower') return f.includes('glass') ? (this.rng() < 0.65 ? 'glass' : 'office') : 'office';
    if (kind === 'house') return f.includes('adobe') ? 'adobe' : f.includes('brick') ? (this.rng() < 0.5 ? 'brick' : 'residential') : 'residential';
    if (kind === 'warehouse') return f.includes('brick') ? 'brick' : 'office';
    return this.rng() < 0.5 ? f[0] : f[Math.min(2, f.length - 1)] === 'glass' ? 'residential' : pick(this.rng, f);
  }

  building(b, x0, x1, z0, z1, h, kind) {
    const rng = this.rng;
    const T = this.theme;
    const style = this.facadeStyleFor(kind);
    const f = T.facades[style];
    const side = this.bucket(b.chunk, 'f_' + style);
    const roof = this.bucket(b.chunk, 'roof');
    const Y = 0.15;
    const wallCol = col(style === 'glass' ? pick(rng, T.glassTint) : pick(rng, T.wall));
    const roofCol = col(T.snowRoof ? pick(rng, T.flatRoof) : pick(rng, T.flatRoof));
    const uo = Math.floor(rng() * 8) / 8, vo = Math.floor(rng() * 8) / 8;
    this.addBox(x0, x1, z0, z1, 'building', h);
    let tiers = [[x0, x1, z0, z1, Y, Y + h]];
    if (h > 45 && kind === 'tower') {
      const inset1 = Math.min(3.5, (x1 - x0) * 0.12), inset2 = inset1 * 2.2;
      const h1 = h * rand(rng, 0.55, 0.7), h2 = h * rand(rng, 0.82, 0.9);
      tiers = [
        [x0, x1, z0, z1, Y, Y + h1],
        [x0 + inset1, x1 - inset1, z0 + inset1, z1 - inset1, Y + h1, Y + h2],
        [x0 + inset2, x1 - inset2, z0 + inset2, z1 - inset2, Y + h2, Y + h],
      ];
    }
    for (const [a0, a1, c0, c1, y0, y1] of tiers) {
      fbox(side, roof, a0, a1, y0, y1, c0, c1, wallCol, roofCol, f, Y, uo, vo);
      // parapet
      if (kind !== 'house') {
        const p = 0.35, ph = 0.8;
        const pc = col('#8a8d92');
        pbox(roof, a0, a1, y1, y1 + ph, c0, c0 + p, pc);
        pbox(roof, a0, a1, y1, y1 + ph, c1 - p, c1, pc);
        pbox(roof, a0, a0 + p, y1, y1 + ph, c0, c1, pc);
        pbox(roof, a1 - p, a1, y1, y1 + ph, c0, c1, pc);
      }
    }
    // roof details
    const top = tiers[tiers.length - 1];
    const [t0, t1, s0, s1, , ty] = top;
    const w = t1 - t0, d = s1 - s0;
    if (kind !== 'house') {
      const ac = col('#b5b8bc');
      const nAc = randInt(rng, 1, 4);
      for (let k = 0; k < nAc; k++) {
        const ax = rand(rng, t0 + 2, t1 - 4), az = rand(rng, s0 + 2, s1 - 4);
        pbox(roof, ax, ax + rand(rng, 1.5, 3), ty, ty + rand(rng, 1, 2), az, az + rand(rng, 1.5, 3), ac);
      }
      if (rng() < 0.35 && w > 10) {
        // water tank / stair house
        const sx = rand(rng, t0 + 2, t1 - 6), sz = rand(rng, s0 + 2, s1 - 6);
        pbox(roof, sx, sx + 4, ty, ty + 3, sz, sz + 3.5, col('#9a9590'));
      }
      if (kind === 'tower' && h > 60) {
        const cx = (t0 + t1) / 2, cz = (s0 + s1) / 2;
        pbox(roof, cx - 0.2, cx + 0.2, ty, ty + 10, cz - 0.2, cz + 0.2, col('#666'));
        this.prop('beacon', cx, ty + 10.3, cz, 0, 1);
        if (rng() < 0.5) {
          // helipad marking
          const m = this.bucket(b.chunk, 'markings');
          hquad(m, cx - 5, cz - 5, cx + 5, cz + 5, ty + 0.05, col('#2e3238'), 4);
          hquad(m, cx - 1.8, cz - 3, cx - 0.9, cz + 3, ty + 0.07, col('#f2f2f2'), 4);
          hquad(m, cx + 0.9, cz - 3, cx + 1.8, cz + 3, ty + 0.07, col('#f2f2f2'), 4);
          hquad(m, cx - 0.9, cz - 0.45, cx + 0.9, cz + 0.45, ty + 0.07, col('#f2f2f2'), 4);
        }
      }
    }
    return { style, wallCol };
  }

  shopfront(b, x0, x1, z0, z1, faces) {
    // colored awnings + signs on the ground floor
    const rng = this.rng;
    const roof = this.bucket(b.chunk, 'roof');
    const colors = ['#e63946', '#2a9d8f', '#e9c46a', '#f4a261', '#264653', '#8338ec', '#ff006e', '#3a86ff', '#06d6a0'];
    const neonColors = ['#ff2d95', '#00f0ff', '#ffe600', '#7cff00', '#ff6a00', '#b026ff'];
    for (const face of faces) {
      const c = col(pick(rng, colors));
      const y = 3.4;
      if (face === 'z0') pbox(roof, x0 + 1, x1 - 1, y, y + 0.25, z0 - 1.4, z0, c);
      if (face === 'z1') pbox(roof, x0 + 1, x1 - 1, y, y + 0.25, z1, z1 + 1.4, c);
      if (face === 'x0') pbox(roof, x0 - 1.4, x0, y, y + 0.25, z0 + 1, z1 - 1, c);
      if (face === 'x1') pbox(roof, x1, x1 + 1.4, y, y + 0.25, z0 + 1, z1 - 1, c);
      // neon sign
      const nc = pick(rng, neonColors);
      const len = rand(rng, 3, 6);
      if (face === 'z0') this.prop('neon', (x0 + x1) / 2, 4.6, z0 - 0.15, 0, 1, nc, len, 0.6, 0.2);
      if (face === 'z1') this.prop('neon', (x0 + x1) / 2, 4.6, z1 + 0.15, 0, 1, nc, len, 0.6, 0.2);
      if (face === 'x0') this.prop('neon', x0 - 0.15, 4.6, (z0 + z1) / 2, Math.PI / 2, 1, nc, len, 0.6, 0.2);
      if (face === 'x1') this.prop('neon', x1 + 0.15, 4.6, (z0 + z1) / 2, Math.PI / 2, 1, nc, len, 0.6, 0.2);
      if (this.night && rng() < 0.5) {
        // vertical blade sign
        const vc = pick(rng, neonColors);
        if (face === 'z0') this.prop('neon', x0 + 2, 8, z0 - 0.6, 0, 1, vc, 0.25, 4, 1.0);
        if (face === 'x1') this.prop('neon', x1 + 0.6, 8, z0 + 2, 0, 1, vc, 1.0, 4, 0.25);
      }
    }
  }

  buildDowntown(b, ix0, ix1, iz0, iz1) {
    const rng = this.rng;
    const T = this.theme;
    const pz = this.bucket(b.chunk, 'sidewalk');
    const alley = rng() < 0.4;
    const alongX = rng() < 0.5;
    const hMax = T.maxH;
    const hFor = () => clamp((22 + (1 - b.d) * hMax * rand(this.rng, 0.35, 1.0)), 18, hMax);
    if (alley) {
      const g = 9;
      if (alongX) {
        const zm = (iz0 + iz1) / 2;
        this.building(b, ix0, ix1, iz0, zm - g / 2, hFor(), 'tower');
        this.building(b, ix0, ix1, zm + g / 2, iz1, hFor(), 'tower');
        this.addAlleyProps(b, ix0, ix1, zm - g / 2, zm + g / 2, true);
      } else {
        const xm = (ix0 + ix1) / 2;
        this.building(b, ix0, xm - g / 2, iz0, iz1, hFor(), 'tower');
        this.building(b, xm + g / 2, ix1, iz0, iz1, hFor(), 'tower');
        this.addAlleyProps(b, xm - g / 2, xm + g / 2, iz0, iz1, false);
      }
    } else if (rng() < 0.45) {
      // single big tower with a plaza ring
      const m = 3;
      this.building(b, ix0 + m, ix1 - m, iz0 + m, iz1 - m, hFor() * 1.15, 'tower');
    } else {
      const xm = (ix0 + ix1) / 2 + rand(rng, -5, 5), zm = (iz0 + iz1) / 2 + rand(rng, -5, 5);
      const gap = 1.0;
      this.building(b, ix0, xm - gap, iz0, zm - gap, hFor(), 'tower');
      this.building(b, xm + gap, ix1, iz0, zm - gap, hFor() * 0.8, 'mid');
      this.building(b, ix0, xm - gap, zm + gap, iz1, hFor() * 0.7, 'mid');
      this.building(b, xm + gap, ix1, zm + gap, iz1, hFor(), 'tower');
    }
    void pz;
  }

  addAlleyProps(b, x0, x1, z0, z1, alongX) {
    const rng = this.rng;
    // alley pavement
    const pk = this.bucket(b.chunk, 'parking');
    hquad(pk, x0, z0, x1, z1, 0.16, col('#8f8f8f'));
    for (let k = 0; k < 3; k++) {
      const t = rand(rng, 0.2, 0.8);
      const x = alongX ? x0 + (x1 - x0) * t : (rng() < 0.5 ? x0 + 1 : x1 - 1);
      const z = alongX ? (rng() < 0.5 ? z0 + 1 : z1 - 1) : z0 + (z1 - z0) * t;
      this.breakableProp(rng() < 0.6 ? 'trash' : 'cone', x, z, rng() * 6, 0.35);
    }
  }

  buildMidtown(b, ix0, ix1, iz0, iz1) {
    const rng = this.rng;
    const nx = randInt(rng, 2, 3), nz = randInt(rng, 2, 3);
    const W = (ix1 - ix0) / nx, D = (iz1 - iz0) / nz;
    const alleyX = rng() < 0.3 ? randInt(rng, 1, nx - 1) : -1;
    for (let a = 0; a < nx; a++) {
      for (let c = 0; c < nz; c++) {
        let x0 = ix0 + a * W, x1 = x0 + W, z0 = iz0 + c * D, z1 = z0 + D;
        // interior lots are pushed to the edges; leave courtyards
        const edge = a === 0 || a === nx - 1 || c === 0 || c === nz - 1;
        if (!edge) { this.tree((x0 + x1) / 2, (z0 + z1) / 2); continue; }
        if (alleyX >= 0 && (a === alleyX - 1)) x1 -= 4.5;
        if (alleyX >= 0 && (a === alleyX)) x0 += 4.5;
        x0 += 0.6; x1 -= 0.6; z0 += 0.6; z1 -= 0.6;
        const h = rand(rng, 9, 30) * (1.1 - b.d * 0.4);
        this.building(b, x0, x1, z0, z1, h, 'mid');
        const faces = [];
        if (c === 0) faces.push('z0');
        if (c === nz - 1) faces.push('z1');
        if (a === 0) faces.push('x0');
        if (a === nx - 1) faces.push('x1');
        if (rng() < 0.75) this.shopfront(b, x0, x1, z0, z1, faces.slice(0, 1));
      }
    }
    if (alleyX >= 0) {
      const ax = ix0 + alleyX * W;
      this.addAlleyProps(b, ax - 4.5, ax + 4.5, iz0, iz1, false);
    }
  }

  buildSuburb(b, ix0, ix1, iz0, iz1) {
    const rng = this.rng;
    const T = this.theme;
    const g = this.bucket(b.chunk, 'grass');
    hquad(g, ix0, iz0, ix1, iz1, 0.16, col('#ffffff'));
    const n = 3;
    const W = (ix1 - ix0) / n, D = (iz1 - iz0) / n;
    const roof = this.bucket(b.chunk, 'roof');
    for (let a = 0; a < n; a++) {
      for (let c = 0; c < n; c++) {
        const cx = ix0 + (a + 0.5) * W, cz = iz0 + (c + 0.5) * D;
        if (a === 1 && c === 1) {
          // backyard pool or trees
          if (rng() < 0.4 && this.map.theme !== 'snow') {
            const w = this.bucket(b.chunk, 'markings');
            hquad(w, cx - 4, cz - 2.5, cx + 4, cz + 2.5, 0.2, col('#e8e8e8'), 4);
            hquad(w, cx - 3.5, cz - 2, cx + 3.5, cz + 2, 0.22, col('#3fb6e0'), 4);
          } else {
            this.tree(cx - 3, cz + 2); this.tree(cx + 3, cz - 2);
          }
          continue;
        }
        const hw = rand(rng, 3.8, 5.2), hd = rand(rng, 3.8, 5.2);
        const h = rand(rng, 3.4, 6.5);
        const x0 = cx - hw, x1 = cx + hw, z0 = cz - hd, z1 = cz + hd;
        const { wallCol } = this.building(b, x0, x1, z0, z1, h, 'house');
        const rc_ = col(pick(rng, T.houseRoof));
        if (this.map.theme === 'desert' && rng() < 0.6) {
          // flat adobe roof with a parapet
          const pc = wallCol.clone().multiplyScalar(0.92);
          pbox(roof, x0, x1, 0.15 + h, 0.15 + h + 0.6, z0, z0 + 0.3, pc);
          pbox(roof, x0, x1, 0.15 + h, 0.15 + h + 0.6, z1 - 0.3, z1, pc);
        } else {
          gableRoof(roof, x0, x1, z0, z1, 0.15 + h, rand(rng, 1.8, 3.0), rc_, wallCol);
        }
        // door
        const door = this.bucket(b.chunk, 'concrete');
        const dz = c === 0 ? z0 - 0.02 : z1 + 0.02;
        door.quad([cx - 0.5, 0.15, dz], [cx + 0.5, 0.15, dz], [cx + 0.5, 2.3, dz], [cx - 0.5, 2.3, dz], [0, 0, c === 0 ? -1 : 1], [[0, 0], [1, 0], [1, 1], [0, 1]], col('#5a3d2b'));
        // garden
        if (rng() < 0.7) this.smallTree(cx + (rng() < 0.5 ? -1 : 1) * (hw + 1.6), cz + rand(rng, -2, 2), 0.16);
        if (rng() < 0.4) this.tree(cx + (rng() < 0.5 ? -1 : 1) * (hw + 2.5), cz + (rng() < 0.5 ? -1 : 1) * (hd + 1.8));
        if (this.map.theme === 'snow' && rng() < 0.5) this.prop('snowPile', cx + rand(rng, -5, 5), 0.16, cz + (c === 0 ? -hd - 2 : hd + 2), rng() * 6, rand(rng, 0.8, 1.4));
      }
    }
  }

  buildIndustrial(b, ix0, ix1, iz0, iz1) {
    const rng = this.rng;
    const d = this.bucket(b.chunk, 'dirt');
    hquad(d, ix0, iz0, ix1, iz1, 0.16, col('#ffffff'));
    const roof = this.bucket(b.chunk, 'roof');
    // one or two warehouses
    const split = rng() < 0.5;
    if (split) {
      this.building(b, ix0 + 2, ix1 - 2, iz0 + 2, iz0 + 20, rand(this.rng, 9, 13), 'warehouse');
    } else {
      this.building(b, ix0 + 2, ix0 + 24, iz0 + 2, iz1 - 16, rand(this.rng, 9, 14), 'warehouse');
    }
    // loading dock stripes
    const m = this.bucket(b.chunk, 'markings');
    for (let k = 0; k < 4; k++) {
      const x = ix0 + 8 + k * 9;
      hquad(m, x, iz1 - 8, x + 0.4, iz1 - 2, 0.2, col('#f2c14e'), 4);
    }
    // containers as solid obstacles
    const ccols = ['#c1121f', '#1d4e89', '#2a9d8f', '#f4a261', '#6c757d', '#e76f51', '#386641'];
    const cx0 = split ? ix0 + 4 : ix0 + 30, cz0 = split ? iz0 + 26 : iz0 + 4;
    const cols = split ? 5 : 3, rows = split ? 2 : 4;
    for (let a = 0; a < cols; a++) {
      for (let c = 0; c < rows; c++) {
        if (rng() < 0.25) continue;
        const x = cx0 + a * 4.6, z = cz0 + c * 7.6;
        if (x > ix1 - 2 || z > iz1 - 4) continue;
        const stack = randInt(rng, 1, 3);
        for (let s = 0; s < stack; s++) this.prop('container', x + 1.2, 0.15 + s * 2.6, z + 3, 0, 1, pick(rng, ccols));
        this.addBox(x, x + 2.45, z, z + 6.1, 'container', stack * 2.6);
      }
    }
    // storage tanks
    if (!split && rng() < 0.8) {
      const tx = ix1 - 8, tz = iz1 - 12;
      const tank = new THREE.CylinderGeometry(4, 4, 9, 14);
      tank.translate(tx, 4.65, tz);
      this.extraGeo = this.extraGeo || [];
      this.extraGeo.push(tank);
      this.addCircle(tx, tz, 4.1, 'tank');
    }
    void roof;
  }

  buildPark(b, ix0, ix1, iz0, iz1) {
    const rng = this.rng;
    const g = this.bucket(b.chunk, 'grass');
    const cx = (ix0 + ix1) / 2, cz = (iz0 + iz1) / 2;
    hquad(g, ix0, iz0, ix1, iz1, 0.16, col('#ffffff'));
    // cross paths (drivable shortcuts)
    const p = this.bucket(b.chunk, 'sidewalk');
    hquad(p, cx - 3, iz0, cx + 3, iz1, 0.17, col('#e0dbd0'), 4);
    hquad(p, ix0, cz - 3, ix1, cz + 3, 0.17, col('#e0dbd0'), 4);
    // central feature: fountain or pond
    const roof = this.bucket(b.chunk, 'concrete');
    const water = this.bucket(b.chunk, 'water');
    if (rng() < 0.5 || this.map.theme === 'desert') {
      // fountain
      const r = 4;
      const seg = 12;
      for (let k = 0; k < seg; k++) {
        const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
        const ax = cx + Math.cos(a0) * r, az = cz + Math.sin(a0) * r, bx = cx + Math.cos(a1) * r, bz = cz + Math.sin(a1) * r;
        roof.quad([ax, 0.15, az], [bx, 0.15, bz], [bx, 0.9, bz], [ax, 0.9, az], [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)], [[0, 0], [1, 0], [1, 1], [0, 1]], col('#d8d2c6'));
        water.tri([cx, 0.75, cz], [bx, 0.75, bz], [ax, 0.75, az], [0, 0], [1, 0], [0, 1], col('#ffffff'));
      }
      pbox(roof, cx - 0.5, cx + 0.5, 0.15, 2.6, cz - 0.5, cz + 0.5, col('#d8d2c6'));
      this.addCircle(cx, cz, r + 0.2, 'fountain');
      this.fountains = this.fountains || [];
      this.fountains.push({ x: cx, z: cz });
    } else {
      // pond (solid water: can't drive through)
      const r = 7;
      const seg = 16;
      const ox = cx + (rng() < 0.5 ? -12 : 12), oz = cz + (rng() < 0.5 ? -12 : 12);
      for (let k = 0; k < seg; k++) {
        const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
        water.tri([ox, 0.19, oz], [ox + Math.cos(a1) * r, 0.19, oz + Math.sin(a1) * r], [ox + Math.cos(a0) * r, 0.19, oz + Math.sin(a0) * r], [0, 0], [1, 0], [0, 1], col('#ffffff'));
      }
      this.addCircle(ox, oz, r, 'pond');
    }
    // trees scattered away from paths
    for (let k = 0; k < 16; k++) {
      const x = rand(rng, ix0 + 2, ix1 - 2), z = rand(rng, iz0 + 2, iz1 - 2);
      if (Math.abs(x - cx) < 5 || Math.abs(z - cz) < 5) continue;
      if (Math.hypot(x - cx, z - cz) < 9) continue;
      if (rng() < 0.75) this.tree(x, z); else this.smallTree(x, z, 0.16);
    }
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      this.breakableProp('bench', cx + Math.cos(a) * 8, cz + Math.sin(a) * 8, -a + Math.PI / 2, 0.5);
    }
  }

  buildPlaza(b, ix0, ix1, iz0, iz1) {
    const rng = this.rng;
    const p = this.bucket(b.chunk, 'sidewalk');
    hquad(p, ix0, iz0, ix1, iz1, 0.16, col('#e7e1d6'), 6);
    const cx = (ix0 + ix1) / 2, cz = (iz0 + iz1) / 2;
    const c = this.bucket(b.chunk, 'concrete');
    // statue on a plinth
    pbox(c, cx - 2, cx + 2, 0.15, 1.6, cz - 2, cz + 2, col('#bdb6a8'));
    pbox(c, cx - 0.6, cx + 0.6, 1.6, 5.5, cz - 0.6, cz + 0.6, col(this.map.theme === 'desert' ? '#b08d57' : '#6b8f71'));
    this.addBox(cx - 2, cx + 2, cz - 2, cz + 2, 'statue', 5);
    // planters with trees on a ring
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const x = cx + Math.cos(a) * 16, z = cz + Math.sin(a) * 16;
      pbox(c, x - 1.2, x + 1.2, 0.15, 0.7, z - 1.2, z + 1.2, col('#a9a296'));
      this.tree(x, z, 0.7, false);
      this.addCircle(x, z, 1.3, 'planter');
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      this.breakableProp('bench', cx + Math.cos(a) * 9, cz + Math.sin(a) * 9, -a, 0.5);
    }
    for (let k = 0; k < 6; k++) this.breakableProp('cone', rand(rng, ix0 + 2, ix1 - 2), rand(rng, iz0 + 2, iz0 + 6), 0, 0.3);
  }

  // Classical bank: the heist location. Faces +x toward the avenue at x = 0.
  buildBank(b, ix0, ix1, iz0, iz1) {
    const Y = 0.15;
    const stone = col(this.map.theme === 'desert' ? '#ecd9b6' : '#ebe4d6');
    const trim = col('#c9a74a');
    const roof = this.bucket(b.chunk, 'roof');
    const c = this.bucket(b.chunk, 'concrete');
    const plaza = this.bucket(b.chunk, 'sidewalk');
    hquad(plaza, ix0, iz0, ix1, iz1, 0.16, col('#e9e3d6'), 6);
    const bx0 = ix0 + 6, bx1 = ix1 - 11, bz0 = iz0 + 7, bz1 = iz1 - 7;
    const zc = (iz0 + iz1) / 2;
    const H = 15;
    const style = this.theme.facades.office ? 'office' : Object.keys(this.theme.facades)[0];
    const f = this.theme.facades[style];
    fbox(this.bucket(b.chunk, 'f_' + style), roof, bx0, bx1, Y, Y + H, bz0, bz1, stone, col('#b9b3a6'), f, Y);
    this.addBox(bx0, bx1, bz0, bz1, 'building', H);
    pbox(roof, bx0 - 0.4, bx1 + 0.4, Y + H, Y + H + 0.8, bz0 - 0.4, bz1 + 0.4, stone);
    pbox(roof, bx0 - 0.05, bx1 + 0.05, Y + H - 1.2, Y + H - 0.9, bz0 - 0.05, bz1 + 0.05, trim);
    const sw = 22;
    for (let k = 0; k < 4; k++) {
      pbox(c, bx1, bx1 + 7 - k * 1.4, Y, Y + 0.25 * (k + 1), zc - sw / 2 + k * 0.3, zc + sw / 2 - k * 0.3, stone);
    }
    const py = Y + 1.0;
    const px0 = bx1, px1 = bx1 + 4.4;
    const colH = 10.5;
    this.extraGeo = this.extraGeo || [];
    for (let k = 0; k < 6; k++) {
      const z = zc - 9 + k * 3.6;
      const g = new THREE.CylinderGeometry(0.55, 0.65, colH, 14);
      g.translate(px1 - 0.9, py + colH / 2, z);
      this.extraGeo.push(g);
      pbox(c, px1 - 1.6, px1 - 0.2, py, py + 0.5, z - 0.7, z + 0.7, stone);
      pbox(c, px1 - 1.6, px1 - 0.2, py + colH - 0.4, py + colH, z - 0.7, z + 0.7, stone);
      this.addCircle(px1 - 0.9, z, 0.7, 'column');
    }
    const ey = py + colH;
    pbox(roof, px0, px1 + 0.3, ey, ey + 1.6, zc - sw / 2, zc + sw / 2, stone);
    pbox(roof, px0, px1 + 0.35, ey + 0.2, ey + 0.35, zc - sw / 2, zc + sw / 2, trim);
    gableRoof(roof, px0, px1 + 0.3, zc - sw / 2, zc + sw / 2, ey + 1.6, 3.2, stone, stone);
    c.quad([bx1 + 0.02, py, zc - 2], [bx1 + 0.02, py, zc + 2], [bx1 + 0.02, py + 5.5, zc + 2], [bx1 + 0.02, py + 5.5, zc - 2], [1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], col('#1c1a17'));
    pbox(c, bx1, bx1 + 0.15, py, py + 5.9, zc - 2.4, zc - 2, trim);
    pbox(c, bx1, bx1 + 0.15, py, py + 5.9, zc + 2, zc + 2.4, trim);
    pbox(c, bx1, bx1 + 0.15, py + 5.5, py + 5.9, zc - 2.4, zc + 2.4, trim);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.3), new THREE.MeshStandardMaterial({
      map: signTexture('FIRST NATIONAL BANK', '#c9a74a', '#ebe4d6'), roughness: 0.4, metalness: 0.3,
    }));
    sign.rotation.y = Math.PI / 2;
    sign.position.set(px1 + 0.32, ey + 0.95, zc);
    this.group.add(sign);
    for (const dz of [-3.2, 3.2]) this.prop('beacon', bx1 + 0.4, py + 6.4, zc + dz, 0, 1.3);
    this.lamp(ix1 - 0.9, zc - 12, Math.PI / 2);
    this.lamp(ix1 - 0.9, zc + 12, Math.PI / 2);
    for (const dz of [-8, 8]) this.tree(ix1 - 3, zc + dz * 2.2, 0.15);
    this.bank = { doorX: bx1 + 0.3, doorZ: zc, stepX: bx1 + 7.5, carX: -4, carZ: zc + 1.5 };
  }

  buildParking(b, ix0, ix1, iz0, iz1) {
    const rng = this.rng;
    const pk = this.bucket(b.chunk, 'parking');
    hquad(pk, ix0, iz0, ix1, iz1, 0.16, col('#d0d0d0'));
    const m = this.bucket(b.chunk, 'markings');
    for (let row = 0; row < 3; row++) {
      const z = iz0 + 6 + row * 17;
      for (let k = 0; k <= 16; k++) {
        const x = ix0 + 3 + k * 2.9;
        if (x > ix1 - 2) break;
        hquad(m, x, z, x + 0.15, z + 5, 0.2, col('#f0f0f0'), 4);
      }
    }
    for (let k = 0; k < 4; k++) this.lamp(ix0 + 8 + k * 12, (iz0 + iz1) / 2, rng() * 6);
  }

  // ---------------------------------------------------------------- roads
  buildRoads() {
    const T = this.theme;
    const rz0 = rc(RIVER_ROW) + RH, rz1 = rc(RIVER_ROW + 1) - RH;
    const size = HALF * 2;
    const tex = this.tex.asphalt;
    tex.repeat.set(1, 1);
    const roadMat = this.materials.asphalt;
    const addRoadPlane = (x0, x1, z0, z1) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
      g.rotateX(-Math.PI / 2);
      g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
      const uv = g.attributes.uv;
      const pos = g.attributes.position;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, pos.getX(k) / 14, pos.getZ(k) / 14);
      const mesh = new THREE.Mesh(g, roadMat);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    };
    addRoadPlane(-HALF, HALF, -HALF, rz0);
    addRoadPlane(-HALF, HALF, rz1, HALF);
    for (let i = 0; i <= N; i++) if (this.hasBridge(i)) addRoadPlane(rc(i) - RH, rc(i) + RH, rz0, rz1);
    void size;

    // lane markings
    const yellow = col(this.map.theme === 'snow' ? '#e0c060' : '#f2c14e');
    const white = col('#f4f4f4');
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        // segment from node (i,j) to (i+1,j) along x
        const bucketKey = `${Math.floor(Math.min(i, N - 1) / 2)},${Math.floor(Math.min(j, N - 1) / 2)}`;
        const m = this.bucket(bucketKey, 'markings');
        if (i < N) {
          const a = rc(i) + RH + 1.5, bb = rc(i + 1) - RH - 1.5, z = rc(j);
          hquad(m, a, z - 0.28, bb, z - 0.14, 0.02, yellow, 4);
          hquad(m, a, z + 0.14, bb, z + 0.28, 0.02, yellow, 4);
          for (let x = a + 1; x < bb - 3; x += 7) {
            hquad(m, x, z - 4.1, x + 3, z - 3.9, 0.02, white, 4);
            hquad(m, x, z + 3.9, x + 3, z + 4.1, 0.02, white, 4);
          }
          // crosswalks at both ends
          for (const xe of [rc(i) + RH + 0.2, rc(i + 1) - RH - 1.3]) {
            for (let s = -RH + 1; s < RH - 0.5; s += 1.2) hquad(m, xe, z + s, xe + 1.1, z + s + 0.6, 0.02, white, 4);
          }
        }
        if (j < N) {
          const bridgeGap = j === RIVER_ROW && !this.hasBridge(i);
          if (!bridgeGap) {
            const a = rc(j) + RH + 1.5, bb = rc(j + 1) - RH - 1.5, x = rc(i);
            hquad(m, x - 0.28, a, x - 0.14, bb, 0.02, yellow, 4);
            hquad(m, x + 0.14, a, x + 0.28, bb, 0.02, yellow, 4);
            for (let z = a + 1; z < bb - 3; z += 7) {
              hquad(m, x - 4.1, z, x - 3.9, z + 3, 0.02, white, 4);
              hquad(m, x + 3.9, z, x + 4.1, z + 3, 0.02, white, 4);
            }
            for (const ze of [rc(j) + RH + 0.2, rc(j + 1) - RH - 1.3]) {
              for (let s = -RH + 1; s < RH - 0.5; s += 1.2) hquad(m, x + s, ze, x + s + 0.6, ze + 1.1, 0.02, white, 4);
            }
          }
        }
      }
    }
    void T;
  }

  buildRiver() {
    const T = this.theme;
    const z0 = rc(RIVER_ROW) + RH, z1 = rc(RIVER_ROW + 1) - RH;
    const WY = -1.6;
    // water plane
    const wg = new THREE.PlaneGeometry(4000, z1 - z0);
    wg.rotateX(-Math.PI / 2);
    wg.translate(0, WY, (z0 + z1) / 2);
    const water = new THREE.Mesh(wg, this.materials.water);
    water.receiveShadow = true;
    this.group.add(water);
    this.waterMesh = water;
    // river bed/banks walls (visual) + colliders for each stretch between bridges
    const c = this.bucket('river', 'concrete');
    const wallC = col(this.map.theme === 'desert' ? '#c9a878' : '#9a9a96');
    const bridges = [];
    for (let i = 0; i <= N; i++) if (this.hasBridge(i)) bridges.push(i);
    const xs = [-2000];
    for (const i of bridges) { xs.push(rc(i) - RH); xs.push(rc(i) + RH); }
    xs.push(2000);
    for (let k = 0; k < xs.length; k += 2) {
      const a = xs[k], bx = xs[k + 1];
      if (bx - a < 0.5) continue;
      // bank walls
      c.quad([a, WY - 1, z0], [bx, WY - 1, z0], [bx, 0.02, z0], [a, 0.02, z0], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]], wallC);
      c.quad([bx, WY - 1, z1], [a, WY - 1, z1], [a, 0.02, z1], [bx, 0.02, z1], [0, 0, -1], [[0, 0], [1, 0], [1, 1], [0, 1]], wallC);
      // railings (jersey barriers) along the banks
      const ca = Math.max(a, -HALF), cb = Math.min(bx, HALF);
      for (let x = ca + 1.5; x < cb - 1.4; x += 3.05) {
        this.prop('jersey', x, 0, z0 - 0.35, Math.PI / 2);
        this.prop('jersey', x, 0, z1 + 0.35, Math.PI / 2);
      }
      if (cb > ca) this.addBox(ca, cb, z0 - 0.7, z1 + 0.7, 'river', 1);
    }
    // bridge decks: side faces, railings, piers
    for (const i of bridges) {
      const x0 = rc(i) - RH, x1 = rc(i) + RH;
      c.quad([x0, -1.0, z0], [x0, -1.0, z1], [x0, 0.01, z1], [x0, 0.01, z0], [-1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], col('#b5b2ab'));
      c.quad([x1, -1.0, z1], [x1, -1.0, z0], [x1, 0.01, z0], [x1, 0.01, z1], [1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], col('#b5b2ab'));
      pbox(c, x0 - 0.1, x0 + 0.4, 0, 1.1, z0, z1, col('#d4d0c8'));
      pbox(c, x1 - 0.4, x1 + 0.1, 0, 1.1, z0, z1, col('#d4d0c8'));
      pbox(c, x0 + 2, x1 - 2, WY - 1, -1.0, (z0 + z1) / 2 - 1.5, (z0 + z1) / 2 + 1.5, col('#8f8c86'));
      // lamp posts on bridges
      for (const z of [z0 + 10, z1 - 10]) {
        this.prop('lampPole', x0 + 0.2, 1.1 - 0.15, z, -Math.PI / 2);
        this.prop('lampHead', x0 + 0.2, 1.1 - 0.15, z, -Math.PI / 2);
        this.prop('lampPole', x1 - 0.2, 1.1 - 0.15, z, Math.PI / 2);
        this.prop('lampHead', x1 - 0.2, 1.1 - 0.15, z, Math.PI / 2);
      }
    }
    void T;
  }

  buildBoundary() {
    // concrete wall and barriers ring around the city
    const c = this.bucket('edge', 'concrete');
    const H = HALF;
    const wc = col(this.map.theme === 'desert' ? '#cdb58f' : this.map.theme === 'snow' ? '#dfe4ea' : '#b9b6ae');
    const t = 1.2, h = 3.2;
    pbox(c, -H - t, H + t, 0, h, -H - t, -H, wc);
    pbox(c, -H - t, H + t, 0, h, H, H + t, wc);
    pbox(c, -H - t, -H, 0, h, -H, H, wc);
    pbox(c, H, H + t, 0, h, -H, H, wc);
    // hazard stripes on the wall face
    const m = this.bucket('edge', 'markings');
    for (let x = -H; x < H; x += 4) {
      m.quad([x, 0.3, -H + 0.01], [x + 2, 0.3, -H + 0.01], [x + 2, 0.9, -H + 0.01], [x, 0.9, -H + 0.01], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]], col('#f2c14e'));
      m.quad([x + 2, 0.3, H - 0.01], [x, 0.3, H - 0.01], [x, 0.9, H - 0.01], [x + 2, 0.9, H - 0.01], [0, 0, -1], [[0, 0], [1, 0], [1, 1], [0, 1]], col('#f2c14e'));
      m.quad([-H + 0.01, 0.3, x + 2], [-H + 0.01, 0.3, x], [-H + 0.01, 0.9, x], [-H + 0.01, 0.9, x + 2], [1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], col('#f2c14e'));
      m.quad([H - 0.01, 0.3, x], [H - 0.01, 0.3, x + 2], [H - 0.01, 0.9, x + 2], [H - 0.01, 0.9, x], [-1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], col('#f2c14e'));
    }
    this.addBox(-H - 20, H + 20, -H - 20, -H, 'wall', h);
    this.addBox(-H - 20, H + 20, H, H + 20, 'wall', h);
    this.addBox(-H - 20, -H, -H, H, 'wall', h);
    this.addBox(H, H + 20, -H, H, 'wall', h);
  }

  buildOutskirts() {
    const rng = this.rng;
    // ground outside the city (split so the river channel stays open)
    const rz0 = rc(RIVER_ROW) + RH, rz1 = rc(RIVER_ROW + 1) - RH;
    const E = 2000;
    const addGround = (x0, x1, z0, z1) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
      g.rotateX(-Math.PI / 2);
      g.translate((x0 + x1) / 2, -0.05, (z0 + z1) / 2);
      const uv = g.attributes.uv, pos = g.attributes.position;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, pos.getX(k) / 12, pos.getZ(k) / 12);
      const ground = new THREE.Mesh(g, this.materials.ground);
      ground.receiveShadow = true;
      this.group.add(ground);
    };
    addGround(-E, E, -E, rz0);
    addGround(-E, E, rz1, E);
    // scattered trees / rocks outside the wall
    for (let k = 0; k < 700; k++) {
      const a = rng() * Math.PI * 2;
      const r = HALF + 8 + Math.pow(rng(), 1.5) * 260;
      const x = Math.cos(a) * r * 1.2, z = Math.sin(a) * r * 1.2;
      if (Math.abs(x) < HALF + 6 && Math.abs(z) < HALF + 6) continue;
      const rz0 = rc(RIVER_ROW) + RH - 4, rz1 = rc(RIVER_ROW + 1) - RH + 4;
      if (z > rz0 && z < rz1) continue;
      if (rng() < 0.8) this.tree(x, z, -0.05, false);
      else this.prop('rock', x, -0.05, z, rng() * 6, rand(rng, 0.8, 2.4), pick(rng, this.map.theme === 'desert' ? ['#b88a5a', '#a0754a'] : ['#8a8a86', '#77736e']));
    }
  }

  // ---------------------------------------------------------------- finalize meshes
  finalize() {
    const mats = {
      sidewalk: this.materials.sidewalk, grass: this.materials.grass, dirt: this.materials.dirt,
      parking: this.materials.parking, concrete: this.materials.concrete, roof: this.materials.roof,
      markings: this.materials.markings, water: this.materials.water,
    };
    for (const [style, m] of Object.entries(this.facadeMats)) mats['f_' + style] = m;
    for (const [, buckets] of this.chunks) {
      for (const [name, b] of Object.entries(buckets)) {
        if (b.empty) continue;
        const mesh = new THREE.Mesh(b.geometry(), mats[name]);
        const isFacade = name.startsWith('f_');
        mesh.castShadow = isFacade || name === 'roof' || name === 'concrete';
        mesh.receiveShadow = true;
        if (name === 'markings') mesh.renderOrder = 1;
        this.group.add(mesh);
      }
    }
    if (this.extraGeo) {
      const m = new THREE.Mesh(mergeGeometries(this.extraGeo.map((g) => { g.deleteAttribute('uv'); return g; })), new THREE.MeshStandardMaterial({ color: 0xe6e0d4, roughness: 0.55, metalness: 0.15 }));
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
    }
    // instanced props, split into spatial chunks so off-screen ones are culled
    this.instanced = {};
    this.propRef = {};
    const CH = CELL * 2;
    for (const [name, p] of Object.entries(this.props)) {
      if (!p.list.length) continue;
      if (name === 'pool' && !this.night) continue;
      const groups = new Map();
      const refs = this.propRef[name] = new Array(p.list.length);
      p.list.forEach((it, k) => {
        const e = it.m.elements;
        const key = `${Math.floor(e[12] / CH)},${Math.floor(e[14] / CH)}`;
        let g = groups.get(key);
        if (!g) { g = []; groups.set(key, g); }
        g.push(k);
      });
      for (const [key, idxs] of groups) {
        const im = new THREE.InstancedMesh(p.geo, p.mat, idxs.length);
        idxs.forEach((k, li) => {
          const it = p.list[k];
          im.setMatrixAt(li, it.m);
          if (p.colors) im.setColorAt(li, tmpColor.set(it.color || '#ffffff'));
          refs[k] = { im, li };
        });
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.castShadow = p.cast;
        im.receiveShadow = name !== 'pool' && name !== 'neon';
        im.computeBoundingSphere();
        this.group.add(im);
        this.instanced[name + '|' + key] = im;
      }
    }
  }

  // ---------------------------------------------------------------- runtime
  // Smash a breakable prop. Returns the debris spawn description for effects.
  smash(c, vx, vz) {
    if (!c.alive) return null;
    c.alive = false;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const pieces = [];
    for (const [name, idx] of c.breakable.parts) {
      const ref = this.propRef[name]?.[idx];
      if (!ref) continue;
      const { im, li } = ref;
      const m = new THREE.Matrix4();
      im.getMatrixAt(li, m);
      (c.saved ||= []).push([im, li, m.clone()]);
      im.setMatrixAt(li, zero);
      im.instanceMatrix.needsUpdate = true;
      if (name === 'pool') continue;
      const mesh = new THREE.Mesh(this.props[name].geo, this.props[name].mat);
      m.decompose(mesh.position, mesh.quaternion, mesh.scale);
      mesh.castShadow = true;
      this.group.add(mesh);
      const sp = Math.hypot(vx, vz);
      pieces.push(mesh);
      this.debris.push({
        mesh, vx: vx * 0.7 + (Math.random() - 0.5) * 3, vy: 3 + sp * 0.15 + Math.random() * 3, vz: vz * 0.7 + (Math.random() - 0.5) * 3,
        ax: (Math.random() - 0.5) * 8, az: (Math.random() - 0.5) * 8, life: 5,
      });
    }
    return { kind: c.breakable.kind, x: c.x, z: c.z };
  }

  resetBreakables() {
    for (const c of this.breakables) {
      if (c.alive) continue;
      c.alive = true;
      for (const [im, li, m] of c.saved || []) {
        im.setMatrixAt(li, m);
        im.instanceMatrix.needsUpdate = true;
      }
      c.saved = null;
    }
    for (const d of this.debris) this.group.remove(d.mesh);
    this.debris = [];
  }

  update(dt, time) {
    for (let k = this.debris.length - 1; k >= 0; k--) {
      const d = this.debris[k];
      d.life -= dt;
      d.vy -= 20 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      if (d.mesh.position.y < 0.15) {
        d.mesh.position.y = 0.15;
        d.vy *= -0.3; d.vx *= 0.6; d.vz *= 0.6; d.ax *= 0.6; d.az *= 0.6;
      }
      d.mesh.rotation.x += d.ax * dt;
      d.mesh.rotation.z += d.az * dt;
      if (d.life < 1) d.mesh.scale.multiplyScalar(Math.max(0, 1 - dt * 3));
      if (d.life <= 0) {
        this.group.remove(d.mesh);
        this.debris.splice(k, 1);
      }
    }
    // aviation beacons blink
    if (this.beaconMat) {
      const on = Math.sin(time * 3) > 0.3;
      this.beaconMat.color.setRGB(on ? 3 : 0.3, on ? 0.2 : 0.03, on ? 0.2 : 0.03);
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const m of Object.values(this.materials)) m.dispose();
    for (const m of Object.values(this.facadeMats)) m.dispose();
    for (const t of Object.values(this.tex)) t.dispose();
    for (const f of Object.values(this.facadeTex)) { f.map.dispose(); f.emissive.dispose(); }
    for (const p of Object.values(this.props)) p.mat.dispose?.();
  }
}
