// Military escalation (wanted 6★-7★): tanks with turret cannons, an attack
// gunship firing homing missiles and dropping bombs. Every shot is telegraphed
// (laser sight / target ring) so skilled driving can avoid it.
import * as THREE from 'three';
import { WANTED } from './config.js';
import { clamp, wrapAngle, damp } from './utils.js';
import { radialTexture } from './textures.js';


export { createTank } from './tankModel.js';

// ------------------------------------------------------------------ gunship model
// Built once and shared: body, main rotor and tail rotor are each a single merged
// mesh (vertex-coloured), so a fleet of five costs ~15 draw calls instead of ~100.
let gunshipCache = null;
function gunshipParts() {
  if (gunshipCache) return gunshipCache;
  const OLIVE = '#3f4a2e', DARK = '#1c1e1a', GLASS = '#1d2c38';
  const part = (geo, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
    const g = (geo.index ? geo.toNonIndexed() : geo);
    if (g.attributes.uv) g.deleteAttribute('uv');
    g.scale(sx, sy, sz); g.translate(x, y, z);
    const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  };
  const body = [
    part(new THREE.CylinderGeometry(0.9, 0.7, 6, 10).rotateX(Math.PI / 2), OLIVE, 0, 0, 0, 1, 1.2, 1),
    part(new THREE.SphereGeometry(0.85, 10, 8), OLIVE, 0, 0, 3, 1, 1.1, 1.4),
    part(new THREE.SphereGeometry(0.75, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), GLASS, 0, 0.7, 1.6, 0.9, 0.9, 2.2),
    part(new THREE.CylinderGeometry(0.2, 0.45, 6, 8).rotateX(Math.PI / 2), OLIVE, 0, 0.35, -5.5),
    part(new THREE.BoxGeometry(0.12, 1.8, 1.0), OLIVE, 0, 1.1, -8.2),
    part(new THREE.BoxGeometry(2.4, 0.08, 0.6), OLIVE, 0, 0.4, -7.6),
    part(new THREE.BoxGeometry(4.6, 0.12, 1.0), OLIVE, 0, -0.2, -0.2),
    part(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6).rotateX(Math.PI / 2), DARK, 0, -0.9, 2.6),
    part(new THREE.CylinderGeometry(0.15, 0.2, 0.7), DARK, 0, 1.2, 0),
    ...[-1.6, 1.6, -2.2, 2.2].map((sx) => part(new THREE.CylinderGeometry(0.22, 0.22, 1.5, 8).rotateX(Math.PI / 2), DARK, sx, -0.45, 0)),
  ];
  const rotor = [];
  for (let k = 0; k < 4; k++) rotor.push(part(new THREE.BoxGeometry(0.35, 0.05, 13).rotateY((k / 4) * Math.PI), DARK));
  const tail = [];
  for (let k = 0; k < 2; k++) tail.push(part(new THREE.BoxGeometry(0.06, 2.0, 0.15).rotateX(k * Math.PI / 2), DARK));
  gunshipCache = {
    body: mergeList(body), rotor: mergeList(rotor), tail: mergeList(tail),
    mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.4 }),
  };
  return gunshipCache;
}

function mergeList(list) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

function createGunship() {
  const P = gunshipParts();
  const g = new THREE.Group();
  const body = new THREE.Mesh(P.body, P.mat);
  body.castShadow = true;
  const rotor = new THREE.Mesh(P.rotor, P.mat);
  rotor.position.y = 1.6;
  const tail = new THREE.Mesh(P.tail, P.mat);
  tail.position.set(0.2, 1.1, -8.3);
  g.add(body, rotor, tail);
  return { group: g, rotor, tail };
}

// ------------------------------------------------------------------ Military manager
export class Military {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.warnings = [];
    this.scorch = [];
    this.gunships = [];
    this.gunTimer = 0;
    this.tankTimer = 3;
    this.missileMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.4, metalness: 0.5 });
    this.shellMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    this.bombMat = new THREE.MeshStandardMaterial({ color: 0x2b2f26, roughness: 0.5, metalness: 0.5 });
    this.missileGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8).rotateX(Math.PI / 2);
    this.shellGeo = new THREE.SphereGeometry(0.22, 8, 6);
    this.bombGeo = new THREE.CapsuleGeometry(0.3, 0.8, 4, 8);
    this.ringTex = radialTexture('rgba(255,40,40,0)', 'rgba(255,40,40,0.9)');
    this.scorchTex = radialTexture('rgba(10,8,6,0.85)', 'rgba(10,8,6,0)');
  }

  get level() { return this.game.wantedLevel; }

  reset() {
    const s = this.game.scene;
    for (const p of this.projectiles) s.remove(p.mesh);
    for (const w of this.warnings) s.remove(w.obj);
    for (const d of this.scorch) s.remove(d);
    this.projectiles = []; this.warnings = []; this.scorch = [];
    for (const h of this.gunships) s.remove(h.group);
    this.gunships = [];
    this.gunTimer = 0;
    this.announced = {};
    this.tankTimer = 3;
    this.clearBlock();
    this.blockTimer = 5;
  }

  // ---------------------------------------------------------------- tanks
  spawnTank() {
    const g = this.game, p = g.player;
    const spot = g.city.randomRoadSpot(Math.random, p.x, p.z, 110, 180);
    if (!spot) return;
    let h = spot.heading;
    const toP = Math.atan2(p.x - spot.x, p.z - spot.z);
    if (Math.abs(wrapAngle(h - toP)) > Math.PI / 2) h += Math.PI;
    const t = g.police.makeCop('tank', spot.x, spot.z, h);
    t.mil = { yaw: 0, cool: 3 + Math.random() * 2, aimT: 0, aim: null };
    t.vx = t.vz = 0;
  }

  updateTank(t, dt) {
    const g = this.game, p = g.player, c = t.car;
    const m = t.mil;
    // tracks crawl with distance travelled, barrel recoils after each shot
    const crawl = Math.floor((t.wheelSpin * t.car.spec.wr) / (c.pitch / 2));
    c.linksA.visible = (crawl & 1) === 0; c.linksB.visible = !c.linksA.visible;
    m.recoil = damp(m.recoil || 0, 0, 5, dt);
    c.barrel.position.z = 2.25 - m.recoil * 0.7;
    if (m.flash > 0) { m.flash -= dt; c.muzzleMat.opacity = Math.max(0, m.flash / 0.12); }
    if (!t.alive) { c.muzzleMat.opacity = 0; return; }
    const dx = p.x - t.x, dz = p.z - t.z, dist = Math.hypot(dx, dz);
    // turret tracks the player's predicted position
    const lead = dist / 80;
    const ax = p.x + p.vx * lead, az = p.z + p.vz * lead;
    const want = wrapAngle(Math.atan2(ax - t.x, az - t.z) - t.heading);
    m.yaw += clamp(wrapAngle(want - m.yaw), -1.3 * dt, 1.3 * dt);
    c.turret.rotation.y = m.yaw;
    m.cool -= dt;
    if (m.aimT > 0) {
      m.aimT -= dt;
      c.muzzleMat.opacity = 0.15 + Math.max(0, Math.sin(g.time * 30)) * 0.25;
      this.updateLaser(m.laser, this.muzzlePos(t), m.aim);
      if (m.aimT <= 0) {
        this.removeWarning(m.laser);
        c.muzzleMat.opacity = 0;
        this.fireShell(t, m.aim);
        m.cool = t.ai.mode === 'fort' ? 2.4 + Math.random() * 1.2 : 4.5 + Math.random() * 2;
      }
    } else if (g.state === 'playing' && m.cool <= 0 && dist < (t.ai.mode === 'fort' ? 165 : 110) && Math.abs(wrapAngle(want - m.yaw)) < 0.08
      && !g.city.segmentBlocked(t.x, t.z, p.x, p.z, 0.8)) {
      m.aimT = 0.85;
      m.aim = new THREE.Vector3(ax, 0.9, az);
      m.laser = this.addLaser();
      g.audio.warnBeep?.();
    }
  }

  muzzlePos(t) {
    t.root.updateMatrixWorld(true);
    return t.car.muzzle.getWorldPosition(new THREE.Vector3());
  }

  fireShell(t, aim) {
    const g = this.game;
    const from = this.muzzlePos(t);
    const dir = aim.clone().sub(from);
    const len = dir.length();
    dir.normalize();
    const mesh = new THREE.Mesh(this.shellGeo, this.shellMat);
    mesh.position.copy(from);
    g.scene.add(mesh);
    this.projectiles.push({ kind: 'shell', mesh, vel: dir.multiplyScalar(85), life: len / 85 + 0.3, owner: t, radius: 8, power: 36 });
    g.effects.explosionSmall?.(from.x, from.y, from.z);
    t.mil.recoil = 1; t.mil.flash = 0.12;
    g.audio.cannon?.(Math.hypot(t.x - g.player.x, t.z - g.player.z));
    // recoil
    t.applyImpulse(-Math.sin(t.heading + t.mil.yaw) * 8, -Math.cos(t.heading + t.mil.yaw) * 8, t.x, t.z);
  }

  // ---------------------------------------------------------------- military roadblock
  // Two tanks across the road ahead, concrete barriers with one narrow gap
  // (spiked), sandbag walls, amber beacons and soldiers. Tanks fire head-on.
  spawnTankBlock() {
    const g = this.game, p = g.player, city = g.city;
    if (p.speed < 6) return false;
    const ax = Math.abs(p.vx) > Math.abs(p.vz);
    const dir = ax ? Math.sign(p.vx) : Math.sign(p.vz);
    let node = null;
    for (const cells of [3, 2, 4]) {
      const tx = ax ? p.x + dir * 74 * cells : p.x, tz = ax ? p.z : p.z + dir * 74 * cells;
      const n = city.nodePos(city.nearestNode(tx, tz));
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d > 110 && d < 270 && city.isRoad(n.x, n.z) && Math.abs(ax ? n.z - p.z : n.x - p.x) < 20) { node = n; break; }
    }
    if (!node) return false;
    // centre of the block, on the approach side of the intersection
    const bx = ax ? node.x - dir * 16 : node.x, bz = ax ? node.z : node.z - dir * 16;
    const face = ax ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (dir > 0 ? Math.PI : 0); // toward the player
    const toward = -dir; // unit step along the travel axis toward the player
    const at = (along, across) => (ax ? { x: bx + toward * along, z: bz + across } : { x: bx + across, z: bz + toward * along });
    const blk = { meshes: [], boxes: [], beacons: [], soldiers: [], tanks: [], t: 0, x: bx, z: bz };
    const add = (m) => { g.scene.add(m); blk.meshes.push(m); return m; };
    // tanks
    for (const [k, across] of [[0, -4.3], [1, 4.3]]) {
      const pos = at(0, across);
      const t = g.police.makeCop('tank', pos.x, pos.z, face);
      t.vx = t.vz = 0;
      t.ai.mode = 'fort';
      t.ai.fortUntil = g.police.time + 55;
      t.mil = { yaw: 0, cool: 1.2 + k * 1.1, aimT: 0, aim: null };
      blk.tanks.push(t);
    }
    // barriers across the road, one lane-wide gap
    const concrete = new THREE.MeshStandardMaterial({ color: 0xc9c6bf, roughness: 0.9 });
    const stripe = new THREE.MeshStandardMaterial({ color: 0xff7a00, roughness: 0.6 });
    const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.2) });
    blk.mats = [concrete, stripe, beaconMat];
    const slots = [-6.2, -3.1, 0, 3.1, 6.2];
    const gap = Math.random() < 0.5 ? 1 : 3; // never dead-centre
    const bAlong = 8;
    for (let i = 0; i < slots.length; i++) {
      if (i === gap) continue;
      const c = at(bAlong, slots[i]);
      const wall = add(new THREE.Mesh(new THREE.BoxGeometry(ax ? 0.7 : 3.0, 1.05, ax ? 3.0 : 0.7), concrete));
      wall.position.set(c.x, 0.52, c.z);
      wall.castShadow = wall.receiveShadow = true;
      const band = add(new THREE.Mesh(new THREE.BoxGeometry(ax ? 0.72 : 3.02, 0.22, ax ? 3.02 : 0.72), stripe));
      band.position.set(c.x, 0.75, c.z);
      const bcn = add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), beaconMat));
      bcn.position.set(c.x, 1.2, c.z);
      blk.beacons.push(bcn);
      const hw = ax ? 0.35 : 1.5, hd = ax ? 1.5 : 0.35;
      blk.boxes.push(city.addBox(c.x - hw, c.x + hw, c.z - hd, c.z + hd, 'barrier', 1.1));
    }
    // spike strip laid in the gap, just in front of the barriers
    const gc = at(bAlong + 3.5, slots[gap]);
    g.police.addSpikes(gc.x, gc.z, ax);
    const sp = g.police.spikes[g.police.spikes.length - 1];
    sp.mesh.position.set(gc.x, 0, gc.z);
    sp.x = gc.x; sp.z = gc.z;
    sp.hx = ax ? 0.5 : 1.6; sp.hz = ax ? 1.6 : 0.5;
    sp.mesh.scale.set(1, 1, 0.36);
    // sandbag walls on both kerbs
    const sand = new THREE.MeshStandardMaterial({ color: 0x9c8559, roughness: 1, flatShading: true });
    blk.mats.push(sand);
    for (const across of [-8.6, 8.6]) {
      for (let r = 0; r < 3; r++) {
        const c = at(r * 1.1 - 1, across);
        const bag = add(new THREE.Mesh(new THREE.BoxGeometry(ax ? 1.0 : 1.8, 0.9, ax ? 1.8 : 1.0), sand));
        bag.position.set(c.x, 0.45, c.z);
        bag.castShadow = true;
      }
    }
    // soldiers behind the barrier
    for (const across of [-6.5, -1.5, 1.5, 6.5]) {
      const c = at(bAlong - 2.2, across + (Math.random() - 0.5));
      const s = g.people.make(c.x, c.z, {
        mode: 'guard', soldier: true, heading: face, guardHeading: face, backpack: false, umbrella: false, longSleeve: true, hair: 'cap',
        shirt: new THREE.Color('#4b5a32'), pants: new THREE.Color('#3f4a2c'), hatC: new THREE.Color('#556b2f'), timer: 60,
      });
      blk.soldiers.push(s);
    }
    this.block = blk;
    g.ui.toast('MILITARY ROADBLOCK AHEAD!', 'bad');
    g.audio.warnBeep?.();
    return true;
  }

  updateBlock(dt) {
    const g = this.game, b = this.block, p = g.player;
    b.t += dt;
    const on = Math.sin(b.t * 7) > 0;
    for (const m of b.beacons) m.visible = on;
    const d = Math.hypot(p.x - b.x, p.z - b.z);
    if (b.t > 75 || (b.t > 12 && d > 260)) this.clearBlock();
  }

  clearBlock() {
    const b = this.block;
    if (!b) return;
    for (const m of b.meshes) { this.game.scene.remove(m); m.geometry.dispose(); }
    for (const m of b.mats || []) m.dispose();
    for (const bx of b.boxes) bx.dead = true;
    this.block = null;
  }

  // ---------------------------------------------------------------- gunship
  spawnGunship() {
    const g = this.game, p = g.player;
    const m = createGunship();
    g.scene.add(m.group);
    const k = this.gunships.length;
    const a = Math.random() * Math.PI * 2;
    this.gunships.push({
      ...m, x: p.x + Math.cos(a) * 190, z: p.z + Math.sin(a) * 190, y: 26 + (k % 3) * 5, vx: 0, vz: 0, heading: 0, t: k * 2.1,
      cool: 3 + k * 1.3, aimT: 0, bombCool: 6 + k * 2, laser: null, hp: 180,
      orbitR: 36 + (k % 3) * 9, orbitDir: k % 2 ? -1 : 1, slot: k,
    });
    if (!this.announced?.gunships) { (this.announced ||= {}).gunships = true; g.ui.toast('ATTACK HELICOPTERS INBOUND', 'bad'); }
  }

  get gunship() { return this.gunships[0] || null; }

  rotorVolume() {
    const p = this.game.player;
    let v = 0;
    for (const h of this.gunships) v += Math.max(0, 1 - Math.hypot(h.x - p.x, h.z - p.z) / 180) * 0.15;
    return Math.min(0.4, v);
  }

  // A helicopter that has been shot down: spins, smokes and falls, then explodes.
  // Returns true once it has hit the ground.
  updateFalling(h, dt) {
    const g = this.game;
    h.fallV = (h.fallV || 0) + 14 * dt;
    h.y -= h.fallV * dt;
    h.x += (h.vx || 0) * dt * 0.5; h.z += (h.vz || 0) * dt * 0.5;
    h.spin = (h.spin || 0) + dt * 7;
    h.group.position.set(h.x, h.y, h.z);
    h.group.rotation.set(0.5, h.heading + h.spin, 0.35, 'YXZ');
    h.rotor.rotation.y += dt * 10;
    g.effects.damageSmoke(h.x, h.y, h.z, true);
    if (h.y <= 1.5) {
      g.explode(h.x, h.z, 12, 50, null, true);
      this.addScorch(h.x, h.z, 12);
      return true;
    }
    return false;
  }

  updateGunship(h, dt) {
    const g = this.game, p = g.player;
    if (h.falling) return;
    h.t += dt;
    // each helicopter holds its own slot on a ring around the player
    const n = this.gunships.length;
    const ang = h.t * 0.3 * h.orbitDir + (h.slot / Math.max(1, n)) * Math.PI * 2;
    const tx = p.x + Math.cos(ang) * h.orbitR + p.vx * 0.6, tz = p.z + Math.sin(ang) * h.orbitR + p.vz * 0.6;
    const ax = (tx - h.x) * 1.0 - h.vx * 1.3, az = (tz - h.z) * 1.0 - h.vz * 1.3;
    h.vx += ax * dt; h.vz += az * dt;
    const sp = Math.hypot(h.vx, h.vz);
    if (sp > 65) { h.vx *= 65 / sp; h.vz *= 65 / sp; }
    h.x += h.vx * dt; h.z += h.vz * dt;
    const faceP = Math.atan2(p.x - h.x, p.z - h.z);
    h.heading += wrapAngle(faceP - h.heading) * Math.min(1, dt * 2);
    // bank into turns, pitch with acceleration
    const fx = Math.sin(h.heading), fz = Math.cos(h.heading);
    const acc_f = ax * fx + az * fz, acc_r = ax * fz - az * fx;
    h.group.position.set(h.x, h.y + Math.sin(h.t * 1.1) * 0.5, h.z);
    h.group.rotation.set(clamp(acc_f * 0.01, -0.3, 0.3) + 0.12, h.heading, clamp(acc_r * 0.012, -0.4, 0.4), 'YXZ');
    h.rotor.rotation.y += dt * 30;
    h.tail.rotation.x += dt * 45;
    if (g.state !== 'playing') return;
    // missiles
    h.cool -= dt;
    const dist = Math.hypot(p.x - h.x, p.z - h.z);
    if (h.aimT > 0) {
      h.aimT -= dt;
      h.aim.set(p.x + p.vx * 0.9, 0.8, p.z + p.vz * 0.9);
      this.updateLaser(h.laser, new THREE.Vector3(h.x, h.y - 0.6, h.z), h.aim);
      if (h.aimT <= 0) {
        this.removeWarning(h.laser);
        this.fireMissile(h);
        h.cool = (n > 2 ? 5.5 : 3.6) + Math.random() * 2;
      }
    } else if (h.cool <= 0 && dist < 120 && this.warnings.filter((w) => w.kind === 'laser').length < 3) {
      h.aimT = 0.9;
      h.aim = new THREE.Vector3(p.x, 0.8, p.z);
      h.laser = this.addLaser();
      g.audio.warnBeep?.();
    }
    // bombs at the highest level
    if (WANTED[this.level]?.bombs) {
      h.bombCool -= dt;
      if (h.bombCool <= 0) {
        h.bombCool = (n > 2 ? 9 : 5) + Math.random() * 4;
        this.dropBomb(h);
      }
    }
  }

  fireMissile(h) {
    const g = this.game;
    const sides = this.gunships.length > 2 ? [h.slot % 2 ? 1 : -1] : [-1, 1]; // big fleets fire singles
    for (const side of sides) {
      const from = new THREE.Vector3(h.x + Math.cos(h.heading) * 1.8 * side, h.y - 0.6, h.z - Math.sin(h.heading) * 1.8 * side);
      const dir = h.aim.clone().sub(from).normalize();
      const mesh = new THREE.Mesh(this.missileGeo, this.missileMat);
      mesh.position.copy(from);
      g.scene.add(mesh);
      this.projectiles.push({ kind: 'missile', mesh, vel: dir.multiplyScalar(38), life: 4.5, radius: 7, power: 22, delay: side > 0 ? 0.25 : 0 });
    }
    g.audio.missile?.();
  }

  dropBomb(h) {
    const g = this.game, p = g.player;
    const T = 1.8;
    const target = new THREE.Vector3(p.x + p.vx * T, 0.2, p.z + p.vz * T);
    const from = new THREE.Vector3(h.x, h.y - 1, h.z);
    const G = 12;
    const vel = new THREE.Vector3((target.x - from.x) / T, (target.y - from.y + 0.5 * G * T * T) / T, (target.z - from.z) / T);
    const mesh = new THREE.Mesh(this.bombGeo, this.bombMat);
    mesh.position.copy(from);
    g.scene.add(mesh);
    const ring = this.addRing(target.x, target.z, 10);
    this.projectiles.push({ kind: 'bomb', mesh, vel, life: T + 0.5, radius: 10, power: 42, gravity: G, ring });
    g.audio.bombWhistle?.();
  }

  // ---------------------------------------------------------------- warnings
  addLaser() {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.9 }));
    line.frustumCulled = false;
    this.game.scene.add(line);
    const w = { obj: line, kind: 'laser' };
    this.warnings.push(w);
    return w;
  }

  updateLaser(w, a, b) {
    if (!w) return;
    const pos = w.obj.geometry.attributes.position;
    pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, b.x, b.y, b.z);
    pos.needsUpdate = true;
    w.obj.material.opacity = 0.5 + Math.sin(this.game.time * 40) * 0.4;
  }

  addRing(x, z, r) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map: this.ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    m.position.set(x, 0.12, z);
    m.renderOrder = 3;
    this.game.scene.add(m);
    const w = { obj: m, kind: 'ring', t: 0 };
    this.warnings.push(w);
    return w;
  }

  removeWarning(w) {
    if (!w) return;
    this.game.scene.remove(w.obj);
    w.obj.geometry.dispose();
    w.obj.material.dispose();
    const i = this.warnings.indexOf(w);
    if (i >= 0) this.warnings.splice(i, 1);
  }

  addScorch(x, z, r) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.4, r * 1.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map: this.scorchTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    }));
    m.position.set(x, 0.05 + this.game.city.groundHeight(x, z), z);
    m.rotation.y = Math.random() * 6;
    m.renderOrder = 1;
    this.game.scene.add(m);
    this.scorch.push(m);
    if (this.scorch.length > 18) { const o = this.scorch.shift(); this.game.scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const g = this.game;
    const W = WANTED[this.level] || {};
    if (g.state === 'playing') {
      const wantShips = W.gunships || 0;
      if (this.gunships.length < wantShips) {
        this.gunTimer -= dt;
        if (this.gunTimer <= 0) { this.spawnGunship(); this.gunTimer = 2.2; }
      }
      if (W.tanks && !this.announced?.tanks) { (this.announced ||= {}).tanks = true; g.ui.toast('ARMY TANKS DEPLOYED', 'bad'); }
      if (W.tankBlocks && !this.block) {
        this.blockTimer -= dt;
        if (this.blockTimer <= 0) this.blockTimer = this.spawnTankBlock() ? 26 : 2;
      }
      if (W.tanks) {
        const tanks = g.police.cops.filter((c) => c.copType === 'tank' && c.alive && c.ai.mode !== 'fort').length;
        this.tankTimer -= dt;
        if (tanks < W.tanks && this.tankTimer <= 0) { this.spawnTank(); this.tankTimer = 9; }
      }
    }
    for (const c of g.police.cops) if (c.copType === 'tank') this.updateTank(c, dt);
    if (this.block) this.updateBlock(dt);
    for (let i = this.gunships.length - 1; i >= 0; i--) {
      const h = this.gunships[i];
      if (h.falling) {
        if (this.updateFalling(h, dt)) { g.scene.remove(h.group); this.gunships.splice(i, 1); this.gunTimer = 20; }
      } else this.updateGunship(h, dt);
    }
    for (const w of this.warnings) {
      if (w.kind === 'ring') {
        w.t += dt;
        const s = 0.6 + Math.sin(w.t * 12) * 0.08 + Math.min(0.4, w.t * 0.3);
        w.obj.scale.set(s, 1, s);
      }
    }
    this.updateProjectiles(dt);
  }

  updateProjectiles(dt) {
    const g = this.game, p = g.player, city = g.city;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (pr.delay > 0) { pr.delay -= dt; continue; }
      pr.life -= dt;
      const pos = pr.mesh.position;
      if (pr.kind === 'missile') {
        // limited-rate homing toward the player's predicted position
        const target = new THREE.Vector3(p.x + p.vx * 0.4, 0.8, p.z + p.vz * 0.4);
        const want = target.sub(pos).normalize();
        const sp = Math.min(70, pr.vel.length() + 35 * dt);
        const cur = pr.vel.clone().normalize();
        const turn = Math.min(1, 1.3 * dt / Math.max(0.001, cur.angleTo(want)));
        cur.lerp(want, turn).normalize();
        pr.vel.copy(cur.multiplyScalar(sp));
        g.effects.missileTrail?.(pos.x, pos.y, pos.z);
      }
      if (pr.gravity) pr.vel.y -= pr.gravity * dt;
      pos.addScaledVector(pr.vel, dt);
      pr.mesh.lookAt(pos.clone().add(pr.vel));
      if (pr.kind === 'bomb') pr.mesh.rotateX(Math.PI / 2);
      // impact tests
      let hit = pr.life <= 0 || pos.y <= city.groundHeight(pos.x, pos.z) + 0.15;
      if (!hit) {
        city.query(pos.x, pos.z, 1, (o) => {
          if (hit || o.type !== 'box') return;
          if (pos.x > o.x0 && pos.x < o.x1 && pos.z > o.z0 && pos.z < o.z1 && pos.y < (o.h || 10) + 0.5) hit = true;
        });
      }
      if (!hit && pr.kind !== 'bomb') {
        for (const v of g.vehicles) {
          if (v === pr.owner) continue;
          if (Math.abs(v.x - pos.x) < v.L / 2 + 1 && Math.abs(v.z - pos.z) < v.L / 2 + 1 && pos.y < 3) { hit = true; break; }
        }
      }
      if (hit) {
        g.scene.remove(pr.mesh);
        if (pr.ring) this.removeWarning(pr.ring);
        this.projectiles.splice(i, 1);
        g.explode(pos.x, pos.z, pr.radius, pr.power, pr.owner);
        this.addScorch(pos.x, pos.z, pr.radius);
      }
    }
  }
}
