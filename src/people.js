// Pedestrians, v2: articulated people (hips, knees, shoulders, elbows, neck) rendered
// with instancing, procedural gait + blended poses, and a behaviour model with
// personalities, groups, sitting, chatting, phones, crosswalk etiquette, attention,
// human reaction delays, dodging, realistic knock-downs and staged recovery.
import * as THREE from 'three';
import { CITY } from './config.js';
import { clamp, wrapAngle, pick, damp, lerp, smoothstep } from './utils.js';

const { ROAD, SIDEWALK, N } = CITY;
const MAX = 120;
const R = Math.random;

const SHIRTS = ['#c0392b', '#2e86de', '#16a085', '#e67e22', '#f1c40f', '#8e44ad', '#e84393', '#34495e', '#b9b9b9', '#27ae60', '#7f8c8d', '#b33939', '#227093', '#cd6133', '#40407a', '#cfc6b4'];
const WINTER = ['#2c3e50', '#6d214f', '#1e3799', '#3d3d3d', '#833471', '#006266', '#6F1E51', '#1B1464', '#5f3c2c'];
const PANTS = ['#1f2d45', '#2f3640', '#3d3d3d', '#4b3b2a', '#22223b', '#54595f', '#6b5b45', '#1b263b', '#2d3436', '#8d7b68'];
const SKIN = ['#f3cfa6', '#e8b88a', '#d49a6a', '#b07548', '#8d5524', '#6b3e1f', '#f7dcc0', '#c68642'];
const HAIR = ['#141414', '#2b1a10', '#4a2f1b', '#7a5230', '#b58a4c', '#d9b77a', '#8b8b8b', '#e5e5e5', '#6d2e15'];

const CS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

// ------------------------------------------------------------------ geometry
function vcol(geo, v) {
  const n = geo.attributes.position.count;
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(v), 3));
  return geo;
}
function strip(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
function merge(list) {
  list = list.map(strip);
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  const hasCol = list.every((g) => g.attributes.color);
  const col = hasCol ? new Float32Array(n * 3) : null;
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (col) col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

function buildGeometry() {
  const g = {};
  g.pelvis = new THREE.BoxGeometry(0.32, 0.2, 0.2); g.pelvis.translate(0, 0.02, 0);
  // tapered torso: shoulders wider than the waist
  const t = new THREE.CylinderGeometry(0.27, 0.21, 0.52, 4, 1); t.rotateY(Math.PI / 4); t.scale(1, 1, 0.62); t.translate(0, 0.26, 0);
  g.torso = t;
  // head + neck + eyes + nose (eyes darkened with vertex colour)
  const head = new THREE.SphereGeometry(0.105, 12, 10); head.scale(0.95, 1.15, 1.05); head.translate(0, 0.16, 0.01);
  const neck = new THREE.CylinderGeometry(0.045, 0.05, 0.08, 8); neck.translate(0, 0.03, 0);
  const eyeL = new THREE.BoxGeometry(0.03, 0.018, 0.01); eyeL.translate(0.036, 0.18, 0.108);
  const eyeR = new THREE.BoxGeometry(0.03, 0.018, 0.01); eyeR.translate(-0.036, 0.18, 0.108);
  const nose = new THREE.BoxGeometry(0.02, 0.035, 0.03); nose.translate(0, 0.15, 0.115);
  for (const x of [head, neck, nose]) vcol(x, 1);
  for (const x of [eyeL, eyeR]) vcol(x, 0.08);
  g.head = merge([head, neck, eyeL, eyeR, nose]);
  // hair styles (relative to the neck base)
  const short = new THREE.SphereGeometry(0.112, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55); short.scale(0.97, 1.05, 1.1); short.translate(0, 0.185, -0.005);
  g.hairShort = short;
  const longBack = new THREE.BoxGeometry(0.2, 0.26, 0.07); longBack.translate(0, 0.1, -0.09);
  g.hairLong = merge([short.clone(), longBack]);
  const capTop = new THREE.SphereGeometry(0.115, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5); capTop.scale(1, 0.85, 1.08); capTop.translate(0, 0.2, 0);
  const brim = new THREE.BoxGeometry(0.17, 0.015, 0.12); brim.translate(0, 0.205, 0.13);
  g.cap = merge([capTop, brim]);
  g.upperArm = new THREE.CylinderGeometry(0.052, 0.045, 0.29, 7); g.upperArm.translate(0, -0.145, 0);
  g.forearm = new THREE.CylinderGeometry(0.044, 0.036, 0.25, 7); g.forearm.translate(0, -0.125, 0);
  g.hand = new THREE.SphereGeometry(0.045, 7, 5); g.hand.scale(0.8, 1.2, 0.6); g.hand.translate(0, -0.04, 0);
  g.thigh = new THREE.CylinderGeometry(0.075, 0.06, 0.45, 7); g.thigh.translate(0, -0.225, 0);
  // shin + shoe: shoe darkened via vertex colour, so the instance colour = trousers
  const shin = new THREE.CylinderGeometry(0.058, 0.045, 0.45, 7); shin.translate(0, -0.225, 0);
  const shoe = new THREE.BoxGeometry(0.1, 0.07, 0.25); shoe.translate(0, -0.47, 0.05);
  vcol(shin, 1); vcol(shoe, 0.16);
  g.shin = merge([shin, shoe]);
  g.backpack = new THREE.BoxGeometry(0.28, 0.34, 0.14);
  g.phone = new THREE.BoxGeometry(0.07, 0.13, 0.012);
  const canopy = new THREE.ConeGeometry(0.55, 0.28, 8, 1, true); canopy.translate(0, 0.14, 0);
  const stick = new THREE.CylinderGeometry(0.01, 0.01, 0.8, 4); stick.translate(0, -0.3, 0);
  vcol(canopy, 1); vcol(stick, 0.2);
  g.umbrella = merge([canopy, stick]);
  g.bag = new THREE.IcosahedronGeometry(0.2, 1); g.bag.scale(1, 1.15, 0.9);
  return g;
}

const JOINTS = ['lean', 'torsoYaw', 'headYaw', 'headPitch', 'shL', 'shR', 'rollL', 'rollR', 'elL', 'elR', 'hipL', 'hipR', 'knL', 'knR', 'hipRollL', 'hipRollR', 'drop'];
function zeroPose() { const p = {}; for (const j of JOINTS) p[j] = 0; return p; }

export class People {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.target = 45;
    this.toastT = 0;
    this.t = 0;
    const G = buildGeometry();
    const plain = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.02 });
    const vc = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.02, vertexColors: true });
    const cloth = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide, vertexColors: true });
    const mk = (geo, mat, count = MAX, shadow = true) => {
      const im = new THREE.InstancedMesh(geo, mat, count);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = shadow;
      im.frustumCulled = false;
      im.count = 0;
      im.setColorAt(0, new THREE.Color());
      im.instanceColor.array.fill(1); // untinted by default (phones, bags)
      game.scene.add(im);
      return im;
    };
    this.P = {
      pelvis: mk(G.pelvis, plain), torso: mk(G.torso, plain), head: mk(G.head, vc),
      hairShort: mk(G.hairShort, plain, MAX, false), hairLong: mk(G.hairLong, plain, MAX, false), cap: mk(G.cap, plain, MAX, false),
      uArmL: mk(G.upperArm, plain), uArmR: mk(G.upperArm, plain), fArmL: mk(G.forearm, plain, MAX, false), fArmR: mk(G.forearm, plain, MAX, false),
      handL: mk(G.hand, plain, MAX, false), handR: mk(G.hand, plain, MAX, false),
      thighL: mk(G.thigh, plain), thighR: mk(G.thigh, plain), shinL: mk(G.shin, vc), shinR: mk(G.shin, vc),
      backpack: mk(G.backpack, plain, 60, false), phone: mk(G.phone, new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.3, metalness: 0.6 }), 60, false),
      umbrella: mk(G.umbrella, cloth, 80), bag: mk(G.bag, new THREE.MeshStandardMaterial({ color: 0x6b7f3a, roughness: 0.9 }), 8),
    };
    this.m = Array.from({ length: 8 }, () => new THREE.Matrix4());
    this.tmp = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.v = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.c = new THREE.Color();
    this.blockMap = null;
    this.grid = new Map();
    this.vehicles = [];
  }

  setCity(city) {
    this.blockMap = new Map();
    for (const b of city.blocks) this.blockMap.set(`${b.i},${b.j}`, b);
    this.benchSeats = [];
    for (const c of city.breakables) {
      if (c.breakable.kind !== 'bench') continue;
      const r = c.breakable.rotY || 0;
      for (const side of [-0.45, 0.45]) {
        this.benchSeats.push({ bench: c, x: c.x + Math.cos(r) * side + Math.sin(r) * 0.12, z: c.z - Math.sin(r) * side + Math.cos(r) * 0.12, heading: r, taken: null });
      }
    }
    this.reset();
  }

  reset() {
    for (const s of this.benchSeats || []) s.taken = null;
    this.list = [];
    this.write();
  }

  // ---------------------------------------------------------------- creation
  make(x, z, extra = {}) {
    const map = this.game.map?.id;
    const child = !!extra.child;
    const height = child ? 1.05 + R() * 0.25 : 1.58 + R() * 0.32;
    const hat = map === 'snow' ? R() < 0.6 : R() < 0.15;
    const winter = map === 'snow';
    const p = {
      x, z, y: 0.15, heading: R() * Math.PI * 2, speed: 0, vx: 0, vz: 0, vy: 0,
      height, s: height / 1.82, build: child ? 0.9 : 0.85 + R() * 0.35,
      shirt: this.c.set(pick(R, winter ? WINTER : SHIRTS)).clone(),
      pants: this.c.set(pick(R, PANTS)).clone(),
      skin: this.c.set(pick(R, SKIN)).clone(),
      hairC: this.c.set(pick(R, HAIR)).clone(),
      hatC: this.c.set(pick(R, ['#c0392b', '#2c3e50', '#f1c40f', '#ecf0f1', '#27ae60', '#8e44ad'])).clone(),
      longSleeve: winter || map === 'night' || R() < 0.45,
      hair: hat ? 'cap' : R() < 0.4 ? 'long' : R() < 0.08 ? 'none' : 'short',
      backpack: !child && R() < 0.22,
      umbrella: map === 'night' && !child && R() < 0.65,
      // personality
      walk: child ? 1.25 : (map === 'night' ? 1.35 : map === 'snow' ? 1.05 : 1.2) + R() * 0.35,
      curiosity: R(), nerve: R(), reaction: 0.18 + R() * 0.35,
      // state
      mode: 'walk', timer: 0, path: [], block: null, k: 0, dir: R() < 0.5 ? 1 : -1, lane: 1.5,
      phase: R() * 6.28, pose: zeroPose(), gait: 0, run: 0,
      look: null, lookT: 0, fallP: 0, fallV: 0, fallDir: -1, getupT: 0,
      phoneOut: false, phoneT: 0, react: null, leader: null, followers: [], cluster: null, seat: null,
      bags: false, script: false, startle: 0, child,
      ...extra,
    };
    if (extra.child) { p.height = height; p.s = height / 1.82; }
    p.lane = p.dir > 0 ? 1.0 + R() * 0.3 : 2.0 - R() * 0.3;
    this.list.push(p);
    return p;
  }

  cornerPos(b, k, inset = 1.5) {
    const [sx, sz] = CS[k];
    return { x: sx < 0 ? b.x0 + inset : b.x1 - inset, z: sz < 0 ? b.z0 + inset : b.z1 - inset };
  }

  randomBlock(minD, maxD) {
    const g = this.game, fx = g.focus.x, fz = g.focus.z;
    for (let t = 0; t < 14; t++) {
      const b = g.city.blocks[Math.floor(R() * g.city.blocks.length)];
      const d = Math.hypot((b.x0 + b.x1) / 2 - fx, (b.z0 + b.z1) / 2 - fz);
      if (d > minD - 30 && d < maxD + 30) return b;
    }
    return null;
  }

  spawn(minD, maxD) {
    const g = this.game, fx = g.focus.x, fz = g.focus.z;
    const night = g.map?.time === 'night';
    const r = R();
    // bench sitters
    if (r < 0.1 && this.benchSeats?.length) {
      const seat = this.benchSeats[Math.floor(R() * this.benchSeats.length)];
      const d = Math.hypot(seat.x - fx, seat.z - fz);
      if (!seat.taken && seat.bench.alive && d > minD && d < maxD) {
        const p = this.make(seat.x, seat.z, { mode: 'sit', heading: seat.heading, seat, timer: 15 + R() * 40 });
        p.y = 0.15;
        seat.taken = p;
        p.phoneOut = R() < 0.35;
        p.block = this.nearestBlock(p.x, p.z);
        return;
      }
    }
    const b = this.randomBlock(minD, maxD);
    if (!b) return;
    const open = b.type === 'plaza' || b.type === 'park';
    const k = Math.floor(R() * 4);
    const a = this.cornerPos(b, k), c = this.cornerPos(b, (k + 1) % 4);
    const tt = 0.15 + R() * 0.7;
    const sx = a.x + (c.x - a.x) * tt, sz = a.z + (c.z - a.z) * tt;
    const d = Math.hypot(sx - fx, sz - fz);
    if (d < minD || d > maxD) return;
    if (r < 0.2 && !night) {
      // chatting group of 2-3 standing on the pavement / plaza
      const n = R() < 0.6 ? 2 : 3;
      const cx = open ? (b.x0 + b.x1) / 2 + (R() - 0.5) * 20 : sx, cz = open ? (b.z0 + b.z1) / 2 + (R() - 0.5) * 20 : sz;
      if (g.city.pointBlocked(cx, cz, 1.4)) return;
      const cluster = { x: cx, z: cz, speaker: 0, t: 0, life: 20 + R() * 30, members: [] };
      for (let m = 0; m < n; m++) {
        const ang = (m / n) * Math.PI * 2 + R() * 0.4;
        const p = this.make(cx + Math.sin(ang) * 0.55, cz + Math.cos(ang) * 0.55, { mode: 'talk', cluster, block: b });
        p.heading = Math.atan2(cx - p.x, cz - p.z);
        cluster.members.push(p);
      }
      return;
    }
    const leader = this.make(sx, sz, { block: b, mode: open && R() < 0.5 ? 'wander' : 'walk' });
    leader.dir = 1;
    leader.lane = 1.0 + R() * 0.3;
    leader.k = (k + 1) % 4;
    leader.heading = Math.atan2(c.x - a.x, c.z - a.z);
    leader.path = leader.mode === 'walk' ? [this.cornerPos(b, leader.k, leader.lane)] : [];
    if (r < 0.38) {
      // a friend walking alongside
      const f = this.make(sx, sz, { leader, side: -0.72, mode: 'follow', heading: leader.heading });
      leader.followers.push(f);
      leader.walk = f.walk = Math.min(leader.walk, f.walk);
    } else if (r < 0.48 && !night) {
      // parent holding a child's hand
      const ch = this.make(sx, sz, { leader, side: 0.48, child: true, mode: 'follow', heading: leader.heading });
      leader.followers.push(ch);
      leader.walk = Math.min(leader.walk, 1.1);
      leader.holdingChild = ch;
    }
    if (R() < 0.12) { leader.phoneOut = true; leader.phoneT = 6 + R() * 10; }
  }

  // ---------------------------------------------------------------- routing
  nextLeg(p) {
    const b = p.block;
    if (!b) { this.recover(p); return; }
    if (p.mode === 'wander') {
      const x = b.x0 + SIDEWALK + 3 + R() * (b.x1 - b.x0 - 2 * SIDEWALK - 6);
      const z = b.z0 + SIDEWALK + 3 + R() * (b.z1 - b.z0 - 2 * SIDEWALK - 6);
      if (!this.game.city.pointBlocked(x, z, 0.8)) p.path = [{ x, z }];
      if (R() < 0.4) this.idle(p, 2 + R() * 4, R() < 0.5 ? 'phone' : 'look');
      return;
    }
    // at a corner: pause to window-shop, cross the street, or carry on around the block
    const roll = R();
    if (roll < 0.08 && !p.followers.length) { this.idle(p, 3 + R() * 5, R() < 0.5 ? 'window' : 'phone'); return; }
    const [sx, sz] = CS[p.k];
    if (roll < 0.42) {
      const alongX = R() < 0.5;
      const ni = b.i + (alongX ? sx : 0), nj = b.j + (alongX ? 0 : sz);
      const nb = this.blockMap.get(`${ni},${nj}`);
      if (nb && ni >= 0 && nj >= 0 && ni < N && nj < N) {
        const ex = sx < 0 ? b.x0 : b.x1, ez = sz < 0 ? b.z0 : b.z1;
        const jitter = (R() - 0.5) * 0.3;
        let curb, far, nk;
        if (alongX) {
          const zc = ez - sz * (0.8 + jitter);
          curb = { x: ex - sx * 0.35, z: zc }; far = { x: ex + sx * (ROAD + 0.4), z: zc, cross: true };
          nk = [1, 0, 3, 2][p.k];
        } else {
          const xc = ex - sx * (0.8 + jitter);
          curb = { x: xc, z: ez - sz * 0.35 }; far = { x: xc, z: ez + sz * (ROAD + 0.4), cross: true };
          nk = [3, 2, 1, 0][p.k];
        }
        p.path = [curb, far, this.cornerPos(nb, nk, p.lane)];
        p.block = nb; p.k = nk;
        p.mode = 'walk';
        p.wantCross = true;
        return;
      }
    }
    p.k = (p.k + p.dir + 4) % 4;
    p.path = [this.cornerPos(b, p.k, p.lane)];
  }

  idle(p, time, kind) {
    p.mode = 'idle';
    p.idleKind = kind;
    p.timer = time;
    if (kind === 'phone') { p.phoneOut = true; p.phoneT = time; }
    if (kind === 'window' && p.block) {
      const b = p.block;
      const dx0 = p.x - b.x0, dx1 = b.x1 - p.x, dz0 = p.z - b.z0, dz1 = b.z1 - p.z;
      const m = Math.min(dx0, dx1, dz0, dz1);
      p.faceTo = m === dx0 ? Math.PI / 2 : m === dx1 ? -Math.PI / 2 : m === dz0 ? 0 : Math.PI;
    }
  }

  recover(p) {
    if (p.copFoot && !p.dead) { p.mode = 'copFoot'; p.path = []; return; }
    const b = this.nearestBlock(p.x, p.z);
    this.detach(p);
    p.mode = 'walk';
    p.wantCross = false;
    p.film = false;
    if (!b) { p.path = []; return; }
    p.block = b;
    if (b.type === 'plaza' || b.type === 'park') { p.mode = 'wander'; p.path = []; return; }
    let best = 0, bd = 1e9;
    for (let k = 0; k < 4; k++) {
      const c = this.cornerPos(b, k, p.lane);
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < bd) { bd = d; best = k; }
    }
    p.k = best;
    p.path = [this.cornerPos(b, best, p.lane)];
  }

  nearestBlock(x, z) {
    let best = null, bd = 1e9;
    for (const b of this.game.city.blocks) {
      const d = Math.hypot(clamp(x, b.x0, b.x1) - x, clamp(z, b.z0, b.z1) - z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // ---------------------------------------------------------------- external events
  detach(p) {
    if (p.seat) { p.seat.taken = null; p.seat = null; }
    if (p.cluster) { p.cluster.members = p.cluster.members.filter((m) => m !== p); p.cluster = null; }
    if (p.leader) {
      p.leader.followers = p.leader.followers.filter((f) => f !== p);
      if (p.leader.holdingChild === p) p.leader.holdingChild = null;
      p.leader = null;
    }
    for (const f of p.followers) f.leader = null;
    p.followers = [];
    p.holdingChild = null;
  }

  knock(p, vx, vz, strength = 1) {
    if (p.script || p.mode === 'down') return;
    this.detach(p);
    const sp = Math.hypot(vx, vz);
    const fwdDot = vx * Math.sin(p.heading) + vz * Math.cos(p.heading);
    p.fallDir = fwdDot < 0 ? -1 : 1; // hit from the front -> falls on the back
    p.mode = 'down';
    p.vx = vx * 0.55 + (R() - 0.5) * 1.5; p.vz = vz * 0.55 + (R() - 0.5) * 1.5;
    p.vy = 1.8 + Math.min(5.5, sp * 0.14) * strength;
    p.fallV = p.fallDir * (3 + sp * 0.35);
    p.spinV = (R() - 0.5) * sp * 0.25;
    p.timer = 2.2 + R() * 1.8;
    p.path = [];
    p.phoneOut = false; p.film = false;
  }

  flee(p, fx, fz, time = 4) {
    if (p.script || p.mode === 'down' || p.mode === 'getup') return;
    this.detach(p);
    p.mode = 'flee';
    p.fleeDir = Math.atan2(p.x - fx, p.z - fz) + (R() - 0.5) * 0.9;
    p.timer = time;
    p.panicArms = R() < 0.5;
    p.phoneOut = false; p.film = false;
    p.look = { x: fx, z: fz }; p.lookT = 1.5;
  }

  // Loud event (crash): startle, then look; curious people come to stare.
  onNoise(x, z, loud = 1) {
    for (const p of this.list) {
      if (p.script || p.copFoot || p.mode === 'down' || p.mode === 'getup' || p.mode === 'flee' || p.mode === 'dodge' || p.mode === 'guard') continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d > 30 * loud) continue;
      const kind = d < 12 && p.nerve > 0.6 ? 'panic' : p.curiosity > 0.7 && !p.leader && p.mode !== 'sit' ? 'rubberneck' : 'startle';
      p.react = { t: p.reaction + d / 340, kind, x, z };
    }
  }

  onExplosion(x, z, r) {
    for (const p of this.list) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < r) {
        const k = (1 - d / r) * 13 + 4;
        this.knock(p, (p.x - x) / (d || 1) * k, (p.z - z) / (d || 1) * k, 1.4);
      } else if (d < r * 4.5 && p.mode !== 'guard' && !p.copFoot) p.react = { t: p.reaction * 0.5 + d / 340, kind: 'panic', x, z };
    }
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const g = this.game;
    this.t += dt;
    this.toastT -= dt;
    const fx = g.focus.x, fz = g.focus.z;
    const want = Math.round(this.target * (g.map?.time === 'night' ? 0.7 : 1));
    if (this.list.length < want) this.spawn(g.state === 'playing' ? 45 : 22, 125);

    this.grid.clear();
    for (const p of this.list) {
      const k = `${Math.floor(p.x / 3)},${Math.floor(p.z / 3)}`;
      let a = this.grid.get(k); if (!a) { a = []; this.grid.set(k, a); } a.push(p);
    }
    this.vehicles = [];
    for (const v of g.vehicles) if (Math.abs(v.x - fx) < 170 && Math.abs(v.z - fz) < 170) this.vehicles.push(v);
    this.attentionT = (this.attentionT || 0) - dt;
    const scan = this.attentionT <= 0;
    if (scan) this.attentionT = 0.4;

    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (!p.script && Math.hypot(p.x - fx, p.z - fz) > 175) { this.detach(p); this.list.splice(i, 1); continue; }
      const far = Math.abs(p.x - fx) > 95 || Math.abs(p.z - fz) > 95;
      p.lodAcc = (p.lodAcc || 0) + dt;
      if (far && p.lodAcc < 0.12 && !p.script) continue; // distant: update ~8x/s
      const step = p.lodAcc;
      p.lodAcc = 0;
      if (!p.script) {
        if (scan) this.attention(p);
        this.think(p, step);
      }
      this.animate(p, step);
    }
    this.write();
  }

  neighbours(p, fn) {
    const cx = Math.floor(p.x / 3), cz = Math.floor(p.z / 3);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = this.grid.get(`${cx + i},${cz + j}`);
      if (a) for (const o of a) if (o !== p) fn(o);
    }
  }

  // What catches the eye: sirens, speeding cars, the chase itself.
  attention(p) {
    if (p.mode === 'down' || p.mode === 'getup' || p.mode === 'dodge' || p.mode === 'guard' || p.copFoot) return;
    let best = null, bs = 0;
    for (const v of this.vehicles) {
      const d = Math.hypot(v.x - p.x, v.z - p.z);
      if (d > 45) continue;
      const loud = (v.kind === 'police' ? 2.2 : v.kind === 'player' ? 1.6 : 0.4) + v.speed * 0.04;
      const score = loud / (d + 5);
      if (score > bs) { bs = score; best = v; }
    }
    if (best && bs > 0.06) {
      p.look = best; p.lookT = 1.5;
      // some bystanders stop to watch (and film) the police chase
      if (best.kind === 'police' && best.speed > 8 && p.curiosity > 0.72 && !p.leader && !p.followers.length && !p.cluster
        && (p.mode === 'walk' || p.mode === 'idle' || p.mode === 'wander') && Math.hypot(best.x - p.x, best.z - p.z) < 30) {
        p.mode = 'watch'; p.timer = 3 + R() * 4; p.film = R() < 0.6; p.watchX = best.x; p.watchZ = best.z;
      }
    }
  }

  think(p, dt) {
    if (p.lookT > 0) { p.lookT -= dt; if (p.lookT <= 0) p.look = null; }
    if (p.startle > 0) p.startle -= dt;

    // delayed reactions (humans are not instant)
    if (p.react && p.mode !== 'down' && p.mode !== 'getup') {
      p.react.t -= dt;
      if (p.react.t <= 0) {
        const r = p.react; p.react = null;
        p.look = { x: r.x, z: r.z }; p.lookT = 3;
        if (r.kind === 'panic') { p.startle = 0.35; this.flee(p, r.x, r.z, 4 + R() * 4); }
        else if (r.kind === 'rubberneck') { this.detach(p); p.startle = 0.5; p.mode = 'rubberneck'; p.watchX = r.x; p.watchZ = r.z; p.timer = 10 + R() * 5; }
        else p.startle = 0.6;
      }
    }

    if (p.mode !== 'down' && p.mode !== 'getup') this.carDanger(p, dt);

    switch (p.mode) {
      case 'down': return this.updateDown(p, dt);
      case 'getup': return this.updateGetup(p, dt);
      case 'dodge':
        p.timer -= dt;
        this.moveDir(p, p.fleeDir, 5.6, dt, 14);
        if (p.timer <= 0) this.flee(p, p.dodgeX, p.dodgeZ, 1.5 + R() * 2);
        return;
      case 'flee':
        p.timer -= dt;
        this.moveDir(p, p.fleeDir, 3.6 + p.nerve * 1.4, dt, 5);
        if (p.timer <= 0) { p.mode = 'calm'; p.timer = 2.5 + R() * 3; }
        return;
      case 'calm': // catch breath, look back, then carry on
        p.timer -= dt;
        p.speed = damp(p.speed, 0, 4, dt);
        if (p.timer <= 0) this.recover(p);
        return;
      case 'dazed':
        p.timer -= dt;
        this.moveDir(p, p.fleeDir, 0.65, dt, 2);
        if (p.timer <= 0) this.recover(p);
        return;
      case 'sit':
        p.speed = 0;
        if (p.seat) {
          p.x = damp(p.x, p.seat.x, 8, dt); p.z = damp(p.z, p.seat.z, 8, dt); p.heading = p.seat.heading;
          if (!p.seat.bench.alive) { this.flee(p, p.x - Math.sin(p.heading), p.z - Math.cos(p.heading), 3); return; }
        }
        p.timer -= dt;
        if (p.timer <= 0) {
          const h = p.heading;
          this.detach(p);
          p.x += Math.sin(h) * 0.5; p.z += Math.cos(h) * 0.5;
          this.recover(p);
        }
        return;
      case 'talk': {
        const c = p.cluster;
        p.speed = damp(p.speed, 0, 5, dt);
        if (!c) { this.recover(p); return; }
        if (p === c.members[0]) {
          c.t += dt; c.life -= dt;
          if (c.t > 2.5 + (c.speaker % 3)) { c.t = 0; c.speaker = Math.floor(R() * c.members.length); }
          if (c.life <= 0) for (const m of [...c.members]) { m.cluster = null; this.recover(m); }
        }
        const face = Math.atan2(c.x - p.x, c.z - p.z);
        p.heading += wrapAngle(face - p.heading) * Math.min(1, dt * 3);
        return;
      }
      case 'watch':
      case 'rubberneck': {
        p.timer -= dt;
        const d = Math.hypot(p.watchX - p.x, p.watchZ - p.z);
        if (p.mode === 'rubberneck' && d > 9) this.moveTo(p, p.watchX, p.watchZ, 1.6, dt);
        else {
          p.speed = damp(p.speed, 0, 5, dt);
          if (p.mode === 'rubberneck') p.film = p.curiosity > 0.82;
          const face = Math.atan2(p.watchX - p.x, p.watchZ - p.z);
          p.heading += wrapAngle(face - p.heading) * Math.min(1, dt * 2.5);
        }
        if (p.timer <= 0) this.recover(p);
        return;
      }
      case 'idle':
        p.timer -= dt;
        p.speed = damp(p.speed, 0, 5, dt);
        if (p.faceTo !== undefined) p.heading += wrapAngle(p.faceTo - p.heading) * Math.min(1, dt * 3);
        if (p.timer <= 0) {
          p.phoneOut = false; p.faceTo = undefined;
          p.mode = p.block && (p.block.type === 'plaza' || p.block.type === 'park') ? 'wander' : 'walk';
        }
        return;
      case 'follow': return this.updateFollow(p, dt);
      case 'waitCross': return this.updateWaitCross(p, dt);
      case 'copFoot': return this.updateCopFoot(p, dt);
      case 'guard': {
        // soldier at a military roadblock: hold position, face the threat
        p.speed = damp(p.speed, 0, 6, dt);
        const tgt = this.game.player;
        const face = tgt && Math.hypot(tgt.x - p.x, tgt.z - p.z) < 120 ? Math.atan2(tgt.x - p.x, tgt.z - p.z) : p.guardHeading;
        p.heading += wrapAngle(face - p.heading) * Math.min(1, dt * 3);
        if (tgt) { p.look = tgt; p.lookT = 0.5; }
        p.timer -= dt;
        if (p.timer <= 0) this.recover(p);
        return;
      }
    }

    // walk / wander
    if (p.phoneT > 0) { p.phoneT -= dt; if (p.phoneT <= 0) p.phoneOut = false; } else if (R() < dt * 0.012) { p.phoneOut = true; p.phoneT = 5 + R() * 10; }
    if (!p.path.length) { this.nextLeg(p); return; }
    const wp = p.path[0];
    const d = Math.hypot(wp.x - p.x, wp.z - p.z);
    if (d < 0.45) {
      p.path.shift();
      if (p.wantCross && p.path.length && p.path[0].cross) { p.mode = 'waitCross'; p.timer = 0.5 + R() * 0.8; p.scan = R() * 2; }
      if (!p.path.length) p.wantCross = false;
      return;
    }
    let speed = p.walk * (p.phoneOut ? 0.78 : 1);
    if (wp.cross) speed *= 1.2; // brisk on the road
    this.moveTo(p, wp.x, wp.z, speed, dt);
  }

  // Police officer on foot: chase the player, stop to aim and fire bursts when in
  // clear line of sight, grab the player when close enough to arrest.
  updateCopFoot(p, dt) {
    const g = this.game, t = g.player;
    p.shootCool = (p.shootCool ?? 1) - dt;
    if (p.fireT > 0) { p.fireT -= dt; if (p.fireT <= 0) p.firing = false; }
    if (!t || g.state !== 'playing') { p.speed = damp(p.speed, 0, 5, dt); p.aiming = false; return; }
    const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
    p.look = t; p.lookT = 0.5;
    const los = d < 45 && !g.city.segmentBlocked(p.x, p.z, t.x, t.z, 0.4);
    p.arresting = false;
    if (t.kind === 'avatar' && d < 2.3 && los) {
      // close enough to grab
      p.aiming = false; p.arresting = true;
      p.heading += wrapAngle(Math.atan2(dx, dz) - p.heading) * Math.min(1, dt * 8);
      if (d > 0.9) this.moveTo(p, t.x, t.z, 2.2, dt, true); else p.speed = damp(p.speed, 0, 8, dt);
      return;
    }
    if (los && d < (t.kind === 'avatar' ? 22 : 30)) {
      p.speed = damp(p.speed, 0, 6, dt);
      const face = Math.atan2(dx, dz);
      p.heading += wrapAngle(face - p.heading) * Math.min(1, dt * 7);
      p.aiming = true;
      if (p.shootCool <= 0 && Math.abs(wrapAngle(face - p.heading)) < 0.25) {
        g.combat.copShoot(p, t);
        p.firing = true; p.fireT = 0.22;
        p.burst = (p.burst || 0) + 1;
        p.shootCool = p.burst >= 3 ? 1.8 + Math.random() * 1.5 : 0.3 + Math.random() * 0.25;
        if (p.burst >= 3) p.burst = 0;
      }
      return;
    }
    p.aiming = false;
    this.moveTo(p, t.x, t.z, 5.6, dt, true);
  }

  updateWaitCross(p, dt) {
    // stand at the kerb, look both ways, go when there's a gap
    p.speed = damp(p.speed, 0, 6, dt);
    p.timer -= dt;
    p.scan += dt;
    const target = p.path[0];
    if (!target) { p.mode = 'walk'; return; }
    const face = Math.atan2(target.x - p.x, target.z - p.z);
    p.heading += wrapAngle(face - p.heading) * Math.min(1, dt * 4);
    p.headScan = Math.sin(p.scan * 1.7) * 1.05;
    if (p.timer > 0) return;
    const mx = (p.x + target.x) / 2, mz = (p.z + target.z) / 2;
    for (const v of this.vehicles) {
      const sp = v.speed;
      if (sp < 1.5) { if (Math.hypot(v.x - mx, v.z - mz) < 5) return; continue; }
      const rx = mx - v.x, rz = mz - v.z;
      const t = clamp((rx * v.vx + rz * v.vz) / (sp * sp), 0, 3.2);
      const cx = v.x + v.vx * t - mx, cz = v.z + v.vz * t - mz;
      if (cx * cx + cz * cz < 64 && Math.hypot(rx, rz) < 45) return;
    }
    p.headScan = 0;
    p.mode = 'walk';
    for (const f of p.followers) f.headScan = 0;
  }

  updateFollow(p, dt) {
    const L = p.leader;
    if (!L || !this.list.includes(L)) { p.leader = null; this.recover(p); return; }
    const rx = -Math.cos(L.heading), rz = Math.sin(L.heading); // leader's right
    const tx = L.x + rx * p.side + Math.sin(L.heading) * 0.2, tz = L.z + rz * p.side + Math.cos(L.heading) * 0.2;
    const d = Math.hypot(tx - p.x, tz - p.z);
    if (L.speed < 0.3) {
      p.headScan = L.mode === 'waitCross' ? L.headScan * 0.8 : 0;
      if (d > 0.35) this.moveTo(p, tx, tz, 0.9, dt, true);
      else { p.speed = damp(p.speed, 0, 6, dt); p.heading += wrapAngle(L.heading - p.heading) * Math.min(1, dt * 3); }
      return;
    }
    this.moveTo(p, tx, tz, clamp(L.speed + (d - 0.1) * 1.5, 0, 3.2), dt, true);
    if (d < 0.6) p.heading += wrapAngle(L.heading - p.heading) * Math.min(1, dt * 4);
    // friends glance at each other while chatting
    p.chatYaw = !p.child && Math.sin(this.t * 0.7 + p.phase) > 0.45 ? (p.side > 0 ? -0.6 : 0.6) : 0;
    L.chatYaw = !p.child && Math.sin(this.t * 0.7 + p.phase + 1.3) > 0.55 ? (p.side > 0 ? 0.6 : -0.6) : 0;
  }

  carDanger(p, dt) {
    for (const v of this.vehicles) {
      const rx = p.x - v.x, rz = p.z - v.z;
      const d2 = rx * rx + rz * rz;
      if (d2 > 900) continue;
      const sp2 = v.vx * v.vx + v.vz * v.vz;
      const sin = Math.sin(v.heading), cos = Math.cos(v.heading);
      const fwd = rx * sin + rz * cos, side = rx * cos - rz * sin;
      if (Math.abs(fwd) < v.L / 2 + 0.25 && Math.abs(side) < v.W / 2 + 0.25) {
        if (sp2 > 7) {
          if (p.copFoot) { p.hp = (p.hp ?? 40) - Math.sqrt(sp2) * 3; if (p.hp <= 0 && !p.dead) { p.dead = true; this.game.onOfficerDown?.(p, v); } }
          this.knock(p, v.vx, v.vz);
          if (!p.copFoot) this.game.onPedestrianHit?.(p, v);
        } else {
          const d = Math.sqrt(d2) || 1;
          p.x += (rx / d) * 0.06; p.z += (rz / d) * 0.06;
        }
        return;
      }
      if (sp2 < 30 || p.mode === 'dodge') continue;
      const t = -(rx * v.vx + rz * v.vz) / sp2;
      if (t < 0 || t > 1.5) continue;
      const cx = rx + v.vx * t, cz = rz + v.vz * t;
      if (cx * cx + cz * cz < 6.5) {
        // human reaction time before diving clear: slow reactors can get clipped
        p.danger = (p.danger || 0) + dt;
        if (p.danger < p.reaction) { p.look = v; p.lookT = 1; p.startle = 0.3; return; }
        p.danger = 0;
        this.detach(p);
        const sp = Math.sqrt(sp2);
        const nx = -v.vz / sp, nz = v.vx / sp;
        const s = nx * rx + nz * rz >= 0 ? 1 : -1;
        p.mode = 'dodge';
        p.fleeDir = Math.atan2(nx * s, nz * s);
        p.timer = 0.5 + R() * 0.2;
        p.dodgeX = v.x; p.dodgeZ = v.z;
        p.look = v; p.lookT = 2;
        p.phoneOut = false; p.film = false;
        return;
      }
    }
    p.danger = 0;
  }

  // Steering: seek + personal space + street-furniture avoidance, human turn rate.
  moveTo(p, tx, tz, speed, dt, loose = false) {
    const dx = tx - p.x, dz = tz - p.z;
    const d = Math.hypot(dx, dz) || 1;
    let sx = dx / d, sz = dz / d;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    this.neighbours(p, (o) => {
      if (o.mode === 'down' || o === p.leader || o.leader === p || (p.leader && o.leader === p.leader)) return;
      const ox = p.x - o.x, oz = p.z - o.z;
      const od = Math.hypot(ox, oz);
      if (od < 1.1 && od > 0.001) {
        const k = (1.1 - od) * 1.6;
        sx += (ox / od) * k; sz += (oz / od) * k;
        if (ox * fx + oz * fz < 0) { sx += -fz * 0.35; sz += fx * 0.35; } // keep right when passing
      }
    });
    this.game.city.query(p.x + fx * 0.9, p.z + fz * 0.9, 1, (o) => {
      if (o.type !== 'circle') return;
      const ox = p.x - o.x, oz = p.z - o.z;
      const od = Math.hypot(ox, oz) || 0.01;
      if (od < o.r + 0.95) {
        const sgn = (ox * fz - oz * fx) >= 0 ? 1 : -1;
        sx += fz * sgn * 1.2 + (ox / od) * 0.4; sz += -fx * sgn * 1.2 + (oz / od) * 0.4;
      }
    });
    const want = Math.atan2(sx, sz);
    const turn = (loose ? 7 : 4.5) * dt;
    p.heading += clamp(wrapAngle(want - p.heading), -turn, turn);
    const align = Math.max(0.25, Math.cos(wrapAngle(want - p.heading)));
    p.speed = damp(p.speed, speed * align, 3.5, dt);
    const nx = p.x + Math.sin(p.heading) * p.speed * dt, nz = p.z + Math.cos(p.heading) * p.speed * dt;
    if (this.game.city.pointBlocked(nx, nz, 0.3)) { p.speed *= 0.3; p.path = []; return; }
    p.x = nx; p.z = nz;
  }

  moveDir(p, dir, speed, dt, turnRate = 6) {
    p.heading += clamp(wrapAngle(dir - p.heading), -turnRate * dt, turnRate * dt);
    p.speed = damp(p.speed, speed, 6, dt);
    const nx = p.x + Math.sin(p.heading) * p.speed * dt, nz = p.z + Math.cos(p.heading) * p.speed * dt;
    if (this.game.city.pointBlocked(nx, nz, 0.35)) { p.fleeDir += (R() < 0.5 ? 1 : -1) * 1.4; p.speed *= 0.5; return; }
    p.x = nx; p.z = nz;
  }

  updateDown(p, dt) {
    const city = this.game.city;
    p.vy -= 18 * dt;
    p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
    const gy = city.groundHeight(p.x, p.z);
    const air = p.y > gy + 0.02;
    if (!air) {
      p.y = gy;
      if (p.vy < -3) { p.vy *= -0.25; p.fallV *= 0.5; } else p.vy = 0;
      const f = Math.exp(-4.5 * dt);
      p.vx *= f; p.vz *= f;
    }
    if (city.pointBlocked(p.x, p.z, 0.3)) { p.x -= p.vx * dt * 2; p.z -= p.vz * dt * 2; p.vx *= -0.3; p.vz *= -0.3; }
    // tumble in the air, then settle flat on the back / front
    p.fallP += p.fallV * dt;
    p.heading += (p.spinV || 0) * dt;
    if (!air) {
      const target = p.fallDir * Math.PI / 2;
      p.fallP = damp(wrapAngle(p.fallP - target) + target, target, 10, dt);
      p.fallV = damp(p.fallV, 0, 8, dt);
      p.spinV = damp(p.spinV || 0, 0, 6, dt);
    }
    p.speed = 0;
    p.timer -= dt;
    if (p.dead) { p.timer = 1; return; }
    if (p.timer <= 0 && !air && Math.hypot(p.vx, p.vz) < 0.5) {
      p.mode = 'getup';
      p.getupT = 0;
      if (p.fallDir > 0) { p.heading += Math.PI; p.fallP = -Math.PI / 2; p.fallDir = -1; } // roll onto the back first
    }
  }

  updateGetup(p, dt) {
    p.getupT += dt / 1.9; // sit up -> kneel -> stand
    p.fallP = lerp(-Math.PI / 2, 0, smoothstep(0, 0.5, p.getupT));
    p.speed = 0;
    if (p.getupT >= 1) {
      p.fallP = 0;
      p.mode = 'dazed';
      p.timer = 2 + R() * 2.5;
      p.fleeDir = p.heading + (R() - 0.5) * 2;
      p.limp = R() < 0.6;
    }
  }

  // ---------------------------------------------------------------- animation
  animate(p, dt) {
    const T = zeroPose();
    const t = this.t;
    const mode = p.mode;
    p.run = damp(p.run, smoothstep(2.2, 3.6, p.speed), 6, dt);
    p.gait = damp(p.gait, clamp(p.speed / 1.0, 0, 1), 8, dt);
    const cadence = lerp(4.3, 2.4, p.run) / Math.max(0.6, p.height / 1.75);
    const limp = p.limp && mode === 'dazed' ? (Math.sin(p.phase) > 0 ? 0.55 : 1.45) : 1;
    p.phase += p.speed * cadence * dt * limp;

    // relaxed standing posture
    T.rollL = 0.07; T.rollR = -0.07; T.elL = -0.12; T.elR = -0.12;
    T.lean = 0.04 + p.run * 0.22;
    const active = mode !== 'down' && mode !== 'getup' && mode !== 'flee' && mode !== 'dodge';
    if (p.umbrella && active) { T.shR = -0.55; T.elR = -1.5; T.rollR = -0.15; }
    if (p.phoneOut && !p.film && active) {
      T.shR = -0.5; T.elR = -1.75; T.rollR = -0.12; T.headPitch = 0.42;
      if (!p.umbrella) { T.shL = -0.42; T.elL = -1.6; T.rollL = 0.28; }
    }
    if (p.film && active) { T.shR = -1.35; T.elR = -0.35; T.rollR = 0.18; T.shL = -1.3; T.elL = -0.45; T.rollL = -0.18; T.headPitch = -0.05; }
    if (p.holdingChild && active) { T.shL = 0.1; T.rollL = 0.3; T.elL = -0.1; }
    if (p.child && p.leader) { T.shR = -0.6; T.rollR = -0.3; T.elR = -0.15; }
    if (p.bags) { T.shL = -0.25; T.shR = -0.25; T.rollL = 0.35; T.rollR = -0.35; T.elL = -0.3; T.elR = -0.3; }
    switch (mode) {
      case 'sit':
        T.hipL = T.hipR = -1.52; T.knL = T.knR = 1.52; T.drop = 0.47; T.lean = -0.12;
        if (!p.phoneOut) { T.shL = T.shR = -0.45; T.elL = T.elR = -0.95; T.rollL = 0.12; T.rollR = -0.12; }
        T.hipRollL = 0.08; T.hipRollR = 0.08;
        T.headYaw = Math.sin(t * 0.3 + p.phase) * 0.5;
        break;
      case 'talk': {
        const c = p.cluster;
        if (c && c.members[c.speaker] === p) {
          T.shR = -0.55 + Math.sin(t * 3.1 + p.phase) * 0.25; T.elR = -1.25 + Math.sin(t * 2.3) * 0.3; T.rollR = -0.2;
          T.shL = -0.2 + Math.sin(t * 2.2 + 1) * 0.15; T.elL = -0.8;
          T.headPitch = Math.sin(t * 2.7 + p.phase) * 0.08;
        } else if (p.curiosity > 0.5) {
          T.shL = T.shR = -0.32; T.elL = T.elR = -2.05; T.rollL = -0.38; T.rollR = 0.38; // arms crossed
          T.headPitch = Math.max(0, Math.sin(t * 1.9 + p.phase)) * 0.12; // nodding
        } else T.headPitch = Math.sin(t * 1.1 + p.phase) * 0.05;
        T.hipRollL = 0.05 + Math.sin(t * 0.5 + p.phase) * 0.03;
        break;
      }
      case 'waitCross': T.headYaw = p.headScan || 0; break;
      case 'guard': T.shR = -1.05; T.elR = -1.25; T.rollR = 0.1; T.shL = -0.95; T.elL = -1.65; T.rollL = -0.35; T.hipRollL = 0.1; T.hipRollR = 0.1; T.lean = 0.08; break;
      case 'follow': if (p.headScan) T.headYaw = p.headScan; break;
      case 'dodge': T.shL = T.shR = -1.9; T.elL = T.elR = -1.2; T.rollL = 0.5; T.rollR = -0.5; T.lean = 0.35; break;
      case 'flee':
        if (p.panicArms) { T.shL = T.shR = -2.55; T.elL = T.elR = -2.3; T.rollL = 0.55; T.rollR = -0.55; T.headPitch = 0.25; }
        break;
      case 'calm':
        T.lean = 0.35; T.shL = T.shR = -0.25; T.elL = T.elR = -0.5; T.rollL = 0.2; T.rollR = -0.2; T.drop = 0.07;
        T.knL = T.knR = 0.25; T.hipL = T.hipR = -0.2;
        T.headYaw = Math.sin(t * 0.9 + p.phase) * 0.9;
        break;
      case 'dazed': T.shR = -2.5; T.elR = -2.2; T.rollR = -0.55; T.headPitch = 0.2; T.lean = 0.12; break;
      case 'down': {
        const air = p.y > 0.35;
        const flail = Math.sin(t * 13 + p.phase) * (air ? 0.9 : 0.04);
        T.shL = -1.2 + flail; T.shR = -1.3 - flail; T.rollL = 1.1; T.rollR = -1.1; T.elL = T.elR = -0.3;
        T.hipL = -0.3 + flail * 0.5; T.hipR = -0.1 - flail * 0.5; T.knL = 0.5; T.knR = 0.2; T.hipRollL = 0.25; T.hipRollR = 0.2;
        break;
      }
      case 'getup': {
        const k = p.getupT;
        if (k < 0.5) { T.hipL = T.hipR = -1.4; T.knL = T.knR = 1.6; T.shL = T.shR = 0.5; T.elL = T.elR = -0.2; T.drop = 0.85 - k; }
        else if (k < 0.82) { T.hipL = -1.5; T.knL = 1.6; T.hipR = 0.1; T.knR = 1.7; T.drop = 0.42; T.lean = 0.35; T.shR = -0.3; T.elR = -1.0; }
        else { T.drop = 0.08; T.lean = 0.2; }
        T.headPitch = 0.15;
        break;
      }
      case 'idle':
        if (p.idleKind === 'look') T.headYaw = Math.sin(t * 0.8 + p.phase) * 0.9;
        if (p.idleKind === 'window') { T.shL = T.shR = 0.18; T.elL = T.elR = -0.35; T.rollL = -0.1; T.rollR = 0.1; }
        T.hipRollL = 0.04 + Math.sin(t * 0.4 + p.phase) * 0.03; // weight shift
        break;
    }
    if (p.startle > 0 && mode !== 'down' && mode !== 'getup') {
      T.shL = T.shR = -2.0; T.elL = T.elR = -1.9; T.rollL = 0.45; T.rollR = -0.45; T.lean = -0.18; T.drop = 0.05;
    }
    // head tracking, clamped to a human range, torso helps a little
    if (p.look && mode !== 'down' && mode !== 'getup' && mode !== 'waitCross' && mode !== 'sit') {
      const yaw = clamp(wrapAngle(Math.atan2(p.look.x - p.x, p.look.z - p.z) - p.heading), -1.3, 1.3);
      T.headYaw = yaw; T.torsoYaw = clamp(yaw * 0.3, -0.35, 0.35);
    } else if (p.chatYaw && mode !== 'waitCross') T.headYaw = p.chatYaw;

    // blend toward the target pose: smooth transitions between behaviours
    const rate = mode === 'down' ? 16 : mode === 'dodge' || p.startle > 0 ? 14 : 7;
    for (const j of JOINTS) p.pose[j] = damp(p.pose[j], T[j], rate, dt);

    if (mode !== 'down' && mode !== 'getup' && !p.script) p.y = damp(p.y, this.game.city.groundHeight(p.x, p.z), 12, dt);
  }

  // ---------------------------------------------------------------- rendering
  write() {
    const P = this.P;
    const fxv = this.game.focus.x, fzv = this.game.focus.z;
    const vis = this.visible || (this.visible = []);
    vis.length = 0;
    for (const p of this.list) if (!p.rig && Math.abs(p.x - fxv) < 95 && Math.abs(p.z - fzv) < 95) vis.push(p);
    const n = Math.min(vis.length, MAX);
    const [root, pel, tor, hd, arm, fore, leg, scratch] = this.m;
    const { tmp, q, e, v, s } = this;
    const counts = { backpack: 0, phone: 0, umbrella: 0, bag: 0, hairShort: 0, hairLong: 0, cap: 0 };
    const extra = new THREE.Matrix4();
    const local = (out, x, y, z, rx, ry, rz, order = 'XYZ', sx = 1, sy = 1, sz = 1) => {
      e.set(rx, ry, rz, order);
      q.setFromEuler(e);
      return out.compose(v.set(x, y, z), q, s.set(sx, sy, sz));
    };
    for (let i = 0; i < n; i++) {
      const p = vis[i];
      const J = p.pose;
      const G = p.gait, run = p.run, ph = p.phase;
      const sn = Math.sin(ph), cs = Math.cos(ph);
      // gait layered on the blended pose
      const aHip = lerp(0.42, 0.95, run) * G, aKnee = lerp(0.55, 1.5, run) * G, aArm = lerp(0.38, 0.95, run) * G;
      const hipL = J.hipL - sn * aHip, hipR = J.hipR + sn * aHip;
      const knL = J.knL + 0.06 * G + aKnee * Math.max(0, Math.sin(ph + 1.1)) ** 1.5;
      const knR = J.knR + 0.06 * G + aKnee * Math.max(0, Math.sin(ph + 1.1 + Math.PI)) ** 1.5;
      const armsFree = !(p.mode === 'flee' && p.panicArms) && p.mode !== 'dodge' && !p.film && !p.bags;
      const leftBusy = p.holdingChild || (p.phoneOut && !p.umbrella);
      const rightBusy = p.phoneOut || p.umbrella || (p.child && p.leader);
      const shL = J.shL + (armsFree && !leftBusy ? sn * aArm : 0);
      const shR = J.shR + (armsFree && !rightBusy ? -sn * aArm : 0);
      const elL = J.elL - (armsFree && !leftBusy ? lerp(0.15, 1.35, run) * G : 0);
      const elR = J.elR - (armsFree && !rightBusy ? lerp(0.15, 1.35, run) * G : 0);
      const bob = (Math.abs(cs) * 0.035 + run * Math.abs(cs) * 0.05) * G;
      const sway = sn * 0.025 * G * (1 - run);
      const pelYaw = sn * 0.12 * G, pelRoll = -sn * 0.05 * G;

      // root: position, heading, fall (tumble about the feet), body scale
      const lift = Math.abs(Math.sin(p.fallP)) * 0.14;
      e.set(p.fallP, p.heading, 0, 'YXZ');
      q.setFromEuler(e);
      root.compose(v.set(p.x, p.y + lift, p.z), q, s.set(p.s, p.s, p.s));
      pel.multiplyMatrices(root, local(tmp, sway, 0.95 - J.drop + bob, 0, 0, pelYaw, pelRoll));
      P.pelvis.setMatrixAt(i, scratch.multiplyMatrices(pel, local(tmp, 0, 0, 0, 0, 0, 0, 'XYZ', p.build, 1, p.build)));
      // legs: hip -> knee
      leg.multiplyMatrices(pel, local(tmp, 0.09 * p.build, 0, 0, hipL, 0, J.hipRollL));
      P.thighL.setMatrixAt(i, leg);
      P.shinL.setMatrixAt(i, scratch.multiplyMatrices(leg, local(tmp, 0, -0.45, 0, knL, 0, 0)));
      leg.multiplyMatrices(pel, local(tmp, -0.09 * p.build, 0, 0, hipR, 0, -J.hipRollR));
      P.thighR.setMatrixAt(i, leg);
      P.shinR.setMatrixAt(i, scratch.multiplyMatrices(leg, local(tmp, 0, -0.45, 0, knR, 0, 0)));
      // torso counter-rotates against the pelvis
      tor.multiplyMatrices(pel, local(tmp, 0, 0.1, 0, J.lean, -pelYaw * 1.3 + J.torsoYaw, -pelRoll * 0.6, 'YXZ'));
      P.torso.setMatrixAt(i, scratch.multiplyMatrices(tor, local(tmp, 0, 0, 0, 0, 0, 0, 'XYZ', p.build, 1, p.build)));
      // head: stabilised against the lean, then look direction
      hd.multiplyMatrices(tor, local(tmp, 0, 0.52, 0, J.headPitch - J.lean * 0.6, J.headYaw - J.torsoYaw, 0, 'YXZ'));
      P.head.setMatrixAt(i, hd);
      if (p.hair !== 'none') {
        const key = p.hair === 'long' ? 'hairLong' : p.hair === 'cap' ? 'cap' : 'hairShort';
        P[key].setMatrixAt(counts[key], hd);
        P[key].setColorAt(counts[key], p.hair === 'cap' ? p.hatC : p.hairC);
        counts[key]++;
      }
      // arms: shoulder -> elbow -> hand
      const shW = 0.2 * p.build + 0.035;
      for (const side of [1, -1]) {
        const L = side > 0;
        arm.multiplyMatrices(tor, local(tmp, side * shW, 0.46, 0, L ? shL : shR, 0, L ? J.rollL : J.rollR));
        (L ? P.uArmL : P.uArmR).setMatrixAt(i, arm);
        fore.multiplyMatrices(arm, local(tmp, 0, -0.29, 0, L ? elL : elR, 0, 0));
        (L ? P.fArmL : P.fArmR).setMatrixAt(i, fore);
        scratch.multiplyMatrices(fore, local(tmp, 0, -0.25, 0, 0, 0, 0));
        (L ? P.handL : P.handR).setMatrixAt(i, scratch);
        if (!L && (p.phoneOut || p.film) && counts.phone < 60) {
          P.phone.setMatrixAt(counts.phone++, extra.multiplyMatrices(scratch, local(tmp, 0, -0.06, 0.04, -0.3, 0, 0)));
        }
        if (p.bags && counts.bag < 8) {
          P.bag.setMatrixAt(counts.bag++, extra.multiplyMatrices(scratch, local(tmp, 0, -0.2, 0, 0, 0, 0)));
        }
      }
      if (p.backpack && counts.backpack < 60) {
        P.backpack.setMatrixAt(counts.backpack, scratch.multiplyMatrices(tor, local(tmp, 0, 0.3, -0.16 * p.build, 0, 0, 0)));
        P.backpack.setColorAt(counts.backpack++, p.pants);
      }
      if (p.umbrella && counts.umbrella < 80 && p.mode !== 'down' && p.mode !== 'getup' && p.mode !== 'flee' && p.mode !== 'dodge') {
        P.umbrella.setMatrixAt(counts.umbrella, scratch.multiplyMatrices(tor, local(tmp, -0.12, 1.05, 0.12, 0.08, 0, 0.08)));
        P.umbrella.setColorAt(counts.umbrella++, p.shirt);
      }
      P.pelvis.setColorAt(i, p.pants); P.torso.setColorAt(i, p.shirt); P.head.setColorAt(i, p.skin);
      P.uArmL.setColorAt(i, p.shirt); P.uArmR.setColorAt(i, p.shirt);
      const fc = p.longSleeve ? p.shirt : p.skin;
      P.fArmL.setColorAt(i, fc); P.fArmR.setColorAt(i, fc);
      P.handL.setColorAt(i, p.skin); P.handR.setColorAt(i, p.skin);
      P.thighL.setColorAt(i, p.pants); P.thighR.setColorAt(i, p.pants);
      P.shinL.setColorAt(i, p.pants); P.shinR.setColorAt(i, p.pants);
    }
    for (const [k, im] of Object.entries(P)) {
      im.count = counts[k] ?? n;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }
}
