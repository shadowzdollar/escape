// Police: spawning by wanted level, pursuit AI with road-graph pathing,
// roadblocks with spike strips, and a helicopter.
import * as THREE from 'three';
import { Vehicle } from './vehicle.js';
import { COP_TYPES, WANTED, CITY } from './config.js';
import { clamp, wrapAngle, damp, pick } from './utils.js';
import { radialTexture } from './textures.js';
import { rc } from './city.js';

const { CELL, N } = CITY;

export class Police {
  constructor(game) {
    this.game = game;
    this.cops = [];
    this.spikes = [];
    this.heli = null;
    this.spawnTimer = 2;
    this.roadblockTimer = 14;
    this.time = 0;
    this.spikeMat = new THREE.MeshStandardMaterial({ color: 0x202020, roughness: 0.6, metalness: 0.6 });
    this.spikeTipMat = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.3, metalness: 0.9 });
  }

  get level() { return this.game.wantedLevel; }

  reset() {
    for (const c of this.cops) this.remove(c, false);
    this.cops = [];
    for (const s of this.spikes) this.game.scene.remove(s.mesh);
    this.spikes = [];
    if (this.heli) { this.game.scene.remove(this.heli.group); this.heli = null; }
    this.spawnTimer = 2.5;
    this.roadblockTimer = 14;
  }

  remove(cop, splice = true) {
    this.game.scene.remove(cop.root);
    cop.car.dispose();
    if (splice) this.cops.splice(this.cops.indexOf(cop), 1);
    this.game.vehicles.delete(cop);
  }

  makeCop(type, x, z, heading) {
    const t = COP_TYPES[type];
    const v = new Vehicle({
      model: t.model, stats: t, kind: 'police', livery: t.livery,
      color: type === 'swat' ? '#1f2329' : type === 'interceptor' ? '#0d1422' : '#101828',
    });
    v.copType = type;
    v.place(x, z, heading);
    v.ai = { path: [], repath: 0, stuck: 0, reverseT: 0, los: false, mode: 'chase', phase: Math.random() * 6, wreckT: 0 };
    this.game.scene.add(v.root);
    this.game.vehicles.add(v);
    v.car.beam.visible = this.game.isNight;
    if (v.car.pool) v.car.pool.visible = this.game.isNight;
    // arrive at speed so they are a threat immediately
    const sp = t.speed * 0.6;
    v.vx = Math.sin(heading) * sp; v.vz = Math.cos(heading) * sp;
    this.cops.push(v);
    return v;
  }

  spawnChaser() {
    const g = this.game, p = g.player;
    const W = WANTED[this.level];
    const spot = g.city.randomRoadSpot(Math.random, p.x, p.z, 95, 170);
    if (!spot) return;
    // prefer facing toward the player along the road
    const toP = Math.atan2(p.x - spot.x, p.z - spot.z);
    let h = spot.heading;
    if (Math.abs(wrapAngle(h - toP)) > Math.PI / 2) h += Math.PI;
    // avoid overlapping an existing vehicle
    for (const v of g.vehicles) if (Math.hypot(v.x - spot.x, v.z - spot.z) < 8) return;
    const laneOff = 3.8;
    // right-hand lane of the chosen direction
    this.makeCop(pick(Math.random, W.types), spot.x - Math.cos(h) * laneOff, spot.z + Math.sin(h) * laneOff, h);
  }

  spawnRoadblock() {
    const g = this.game, p = g.player;
    if (p.speed < 8) return;
    // project ahead along the dominant travel axis, snap to an intersection
    const ax = Math.abs(p.vx) > Math.abs(p.vz);
    const dir = ax ? Math.sign(p.vx) : Math.sign(p.vz);
    const ahead = CELL * (2 + Math.floor(Math.random() * 2));
    const tx = ax ? p.x + dir * ahead : p.x, tz = ax ? p.z : p.z + dir * ahead;
    const node = g.city.nodePos(g.city.nearestNode(tx, tz));
    const d = Math.hypot(node.x - p.x, node.z - p.z);
    if (d < 90 || d > 260) return;
    if (!g.city.isRoad(node.x, node.z)) return;
    // block placed on the approach side of the intersection
    const bx = ax ? node.x - dir * 12 : node.x;
    const bz = ax ? node.z : node.z - dir * 12;
    const perp = ax ? 0 : Math.PI / 2; // car heading across the road
    for (const off of [-3.4, 3.4]) {
      const x = ax ? bx : bx + off, z = ax ? bz + off : bz;
      const cop = this.makeCop(this.level >= 4 && Math.random() < 0.5 ? 'swat' : 'patrol', x, z, perp + (off > 0 ? Math.PI : 0));
      cop.vx = cop.vz = 0;
      cop.ai.mode = 'block';
    }
    // spike strip in front of the block (toward the player)
    const sx = ax ? bx - dir * 9 : bx, sz = ax ? bz : bz - dir * 9;
    this.addSpikes(sx, sz, ax);
    g.ui.toast('ROADBLOCK AHEAD', 'warn');
  }

  addSpikes(x, z, alongZ) {
    const len = 9;
    const grp = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, len), this.spikeMat);
    base.position.y = 0.05;
    grp.add(base);
    const tipGeo = new THREE.ConeGeometry(0.06, 0.18, 4);
    for (let k = 0; k < 18; k++) {
      const tip = new THREE.Mesh(tipGeo, this.spikeTipMat);
      tip.position.set((k % 2 ? 0.12 : -0.12), 0.16, -len / 2 + (k + 0.5) * (len / 18));
      grp.add(tip);
    }
    grp.position.set(x, 0, z);
    grp.rotation.y = alongZ ? 0 : Math.PI / 2;
    this.game.scene.add(grp);
    // Offset so a gap remains on one side of the road
    const shift = (Math.random() < 0.5 ? -1 : 1) * 3;
    if (alongZ) grp.position.z += shift; else grp.position.x += shift;
    this.spikes.push({
      mesh: grp, x: grp.position.x, z: grp.position.z, hx: alongZ ? 0.5 : len / 2, hz: alongZ ? len / 2 : 0.5, life: 45, used: false,
    });
  }

  // ------------------------------------------------------------ AI
  think(cop, dt) {
    const g = this.game, p = g.player, city = g.city, ai = cop.ai, inp = cop.input;
    inp.nitro = false;
    if (!cop.alive) { inp.throttle = 0; inp.brake = 1; inp.steer = 0; inp.handbrake = false; return; }
    const dx = p.x - cop.x, dz = p.z - cop.z;
    const dist = Math.hypot(dx, dz);

    if (ai.mode === 'block') {
      inp.throttle = 0; inp.brake = 1; inp.steer = 0;
      if (dist < 24 || this.time > (ai.blockUntil ??= this.time + 40)) ai.mode = 'chase';
      return;
    }
    if (g.state !== 'playing') { inp.throttle = 0; inp.brake = 1; return; }

    // rubber band: faster when far behind, a touch slower when right on top
    cop.speedMul = dist > 160 ? 1.2 : dist > 90 ? 1.08 : 1.0;

    const lead = clamp(dist / 32, 0, 1.3);
    const tx = p.x + p.vx * lead, tz = p.z + p.vz * lead;

    ai.repath -= dt;
    if (ai.repath <= 0) {
      ai.repath = 0.3 + Math.random() * 0.25;
      ai.los = dist < 150 && !city.segmentBlocked(cop.x, cop.z, tx, tz, 1.6);
      if (!ai.los) this.planPath(cop, tx, tz);
    }

    let aimX = tx, aimZ = tz;
    if (!ai.los && ai.path.length) {
      let wp = city.nodePos(ai.path[0]);
      if (Math.hypot(wp.x - cop.x, wp.z - cop.z) < 10) {
        ai.path.shift();
        if (ai.path.length) wp = city.nodePos(ai.path[0]);
      }
      if (ai.path.length) { aimX = wp.x; aimZ = wp.z; }
    }

    // reversing out of a jam
    const desired = Math.atan2(aimX - cop.x, aimZ - cop.z);
    const err = wrapAngle(desired - cop.heading);
    if (ai.reverseT > 0) {
      ai.reverseT -= dt;
      inp.throttle = 0; inp.brake = 1; inp.handbrake = false;
      inp.steer = clamp(err * 2, -1, 1);
      return;
    }
    let steer = clamp(-err * 2.4, -1, 1);
    const sharp = Math.abs(err);
    const spd = cop.speed;
    let throttle = 1, brake = 0, hb = false;
    if (sharp > 1.3 && spd > 14) { throttle = 0.2; brake = 0.5; }
    if (sharp > 0.9 && spd > 16) hb = true;
    if (sharp > 2.4 && spd < 6) { // target behind: do a 3-point turn
      throttle = 0; brake = 1; steer = clamp(err * 2, -1, 1);
    }

    // whiskers: avoid walls unless we are about to ram the player
    if (dist > 14) {
      const look = 6 + spd * 0.35;
      for (const side of [-0.42, 0.42]) {
        const a = cop.heading + side;
        const px = cop.x + Math.sin(a) * look, pz = cop.z + Math.cos(a) * look;
        if (city.pointBlocked(px, pz, 0.6)) steer += side > 0 ? 0.85 : -0.85;
      }
    }
    // box in a slow player instead of bouncing off at full speed
    if (dist < 22 && p.speed < 9 && ai.los !== false) {
      const want = clamp((dist - 4.5) * 1.6, 0, 22);
      const v = cop.vF;
      throttle = v < want - 1 ? 1 : 0;
      brake = v > want + 1.5 ? clamp((v - want) / 8, 0.3, 1) : 0;
      hb = false;
      steer = clamp(-wrapAngle(Math.atan2(p.x - cop.x, p.z - cop.z) - cop.heading) * 2.4, -1, 1);
    }
    inp.steer = clamp(steer, -1, 1);
    inp.throttle = throttle; inp.brake = brake; inp.handbrake = hb;

    // stuck detection
    if (throttle > 0.5 && spd < 2 && !(dist < 12 && p.speed < 9)) {
      ai.stuck += dt;
      if (ai.stuck > 0.9) { ai.reverseT = 0.9; ai.stuck = 0; }
    } else ai.stuck = Math.max(0, ai.stuck - dt);
  }

  planPath(cop, tx, tz) {
    const city = this.game.city;
    const to = city.nearestNode(tx, tz);
    // candidate start nodes: the ends of the road segment we are on
    const i = (cop.x / CELL) + N / 2, j = (cop.z / CELL) + N / 2;
    const cands = new Set([city.nearestNode(cop.x, cop.z)]);
    const ri = Math.round(i), rj = Math.round(j);
    if (Math.abs(cop.z - rc(clamp(rj, 0, N))) < 8) { cands.add(city.nodeId(clamp(Math.floor(i), 0, N), clamp(rj, 0, N))); cands.add(city.nodeId(clamp(Math.ceil(i), 0, N), clamp(rj, 0, N))); }
    if (Math.abs(cop.x - rc(clamp(ri, 0, N))) < 8) { cands.add(city.nodeId(clamp(ri, 0, N), clamp(Math.floor(j), 0, N))); cands.add(city.nodeId(clamp(ri, 0, N), clamp(Math.ceil(j), 0, N))); }
    let best = null, bestCost = Infinity;
    const fx = Math.sin(cop.heading), fz = Math.cos(cop.heading);
    for (const from of cands) {
      const np = city.nodePos(from);
      const path = from === to ? [] : city.findPath(from, to);
      if (from !== to && !path.length) continue;
      const dx = np.x - cop.x, dz = np.z - cop.z;
      const d = Math.hypot(dx, dz);
      const behind = (dx * fx + dz * fz) < 0 && d > 6 ? 40 : 0;
      const cost = d + path.length * CELL + behind;
      if (cost < bestCost) { bestCost = cost; best = [from, ...path]; }
    }
    cop.ai.path = best || [];
  }

  // ------------------------------------------------------------ update
  update(dt) {
    const g = this.game, p = g.player;
    this.time += dt;
    const W = WANTED[this.level];

    if (g.state === 'playing') {
      this.spawnTimer -= dt;
      const active = this.cops.filter((c) => c.alive).length;
      if (this.spawnTimer <= 0 && active < W.maxCops) {
        this.spawnChaser();
        this.spawnTimer = W.spawnEvery * (0.7 + Math.random() * 0.6);
      }
      if (W.roadblocks) {
        this.roadblockTimer -= dt;
        if (this.roadblockTimer <= 0) {
          this.spawnRoadblock();
          this.roadblockTimer = 16 + Math.random() * 10;
        }
      }
      if (W.heli && !this.heli) this.spawnHeli();
    }

    for (let k = this.cops.length - 1; k >= 0; k--) {
      const c = this.cops[k];
      this.think(c, dt);
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (!c.alive) {
        c.ai.wreckT += dt;
        if (Math.random() < dt * 20) g.effects.damageSmoke(c.x, c.y + 1.2, c.z, true);
        if ((c.ai.wreckT > 14 && d > 70) || c.ai.wreckT > 40) this.remove(c);
        continue;
      }
      if (d > 360) { this.remove(c); continue; }
      if (c.hp < c.maxHp * 0.4 && Math.random() < dt * 8) g.effects.damageSmoke(c.x + Math.sin(c.heading) * 1.6, c.y + 1.0, c.z + Math.cos(c.heading) * 1.6, false);
      // lights
      const ph = this.time * 9 + c.ai.phase;
      const on = Math.sin(ph) > 0;
      const dis = c.disabledTimer > 0;
      c.car.red.color.setRGB(on && !dis ? 4 : 0.3, 0.1, 0.1);
      c.car.blue.color.setRGB(0.1, 0.25, !on && !dis ? 4.5 : 0.35);
      if (c.car.pool) c.car.pool.material.color.set(on ? 0xff2020 : 0x2050ff);
      if (dis && Math.random() < dt * 12) g.effects.sparks(c.x, 1.2, c.z, 0, 1, 2, 3);
    }

    // spikes
    for (let k = this.spikes.length - 1; k >= 0; k--) {
      const s = this.spikes[k];
      s.life -= dt;
      if (!s.used && Math.abs(p.x - s.x) < s.hx + 0.8 && Math.abs(p.z - s.z) < s.hz + 0.8) {
        s.used = true;
        g.onSpikes();
      }
      if (s.life <= 0) { g.scene.remove(s.mesh); this.spikes.splice(k, 1); }
    }

    if (this.heli) this.updateHeli(dt);
  }

  nearestCopDistance() {
    const p = this.game.player;
    let best = Infinity, bx = 0;
    for (const c of this.cops) {
      if (!c.alive) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < best) { best = d; bx = c.x - p.x; }
    }
    return { d: best, dx: bx };
  }

  // ------------------------------------------------------------ helicopter
  spawnHeli() {
    const g = this.game;
    const grp = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x14203a, roughness: 0.4, metalness: 0.5 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xeef1f5, roughness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.05, metalness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8).scale(1, 0.9, 1.7), bodyMat);
    const stripe = new THREE.Mesh(new THREE.SphereGeometry(1.62, 12, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.12).scale(1, 0.9, 1.7), whiteMat);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.9, 1.2), glass);
    canopy.position.set(0, 0.2, 1.3); canopy.rotation.x = 0.5;
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 5, 8).rotateX(Math.PI / 2), bodyMat);
    boom.position.set(0, 0.3, -4.2);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.9), bodyMat);
    fin.position.set(0, 0.9, -6.4);
    const rotor = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 11), dark);
      b.rotation.y = (k / 4) * Math.PI;
      rotor.add(b);
    }
    rotor.position.y = 1.75;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5), dark);
    mast.position.y = 1.5;
    const tail = new THREE.Group();
    for (let k = 0; k < 2; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.15), dark);
      b.rotation.x = k * Math.PI / 2;
      tail.add(b);
    }
    tail.position.set(0.2, 0.9, -6.5);
    for (const sx of [-1, 1]) {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6).rotateX(Math.PI / 2), dark);
      skid.position.set(sx * 1.1, -1.55, 0);
      grp.add(skid);
      for (const sz of [-0.8, 0.8]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6), dark);
        leg.position.set(sx * 1.0, -1.25, sz);
        grp.add(leg);
      }
    }
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    beacon.position.set(0, -1.3, -0.5);
    grp.add(body, stripe, canopy, boom, fin, rotor, mast, tail, beacon);
    grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    // searchlight: cone + ground pool
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: g.isNight ? 0.09 : 0.03, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 30, 20, 1, true), coneMat);
    const poolMat = new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,245,210,0.9)', 'rgba(255,245,210,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: g.isNight ? 0.8 : 0.25 });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2), poolMat);
    pool.renderOrder = 3;
    g.scene.add(grp, cone, pool);
    const p = g.player;
    this.heli = {
      group: grp, rotor, tail, cone, pool, beacon,
      x: p.x - 150, z: p.z - 150, y: 30, vx: 0, vz: 0, heading: 0, t: 0,
      dispose: () => { g.scene.remove(cone, pool); },
    };
    grp.position.set(this.heli.x, this.heli.y, this.heli.z);
    g.ui.toast('POLICE HELICOPTER INBOUND', 'warn');
  }

  updateHeli(dt) {
    const h = this.heli, p = this.game.player;
    h.t += dt;
    // orbit slightly ahead of the player
    const ox = Math.cos(h.t * 0.35) * 14, oz = Math.sin(h.t * 0.35) * 14;
    const tx = p.x + p.vx * 0.8 + ox, tz = p.z + p.vz * 0.8 + oz;
    const ax = (tx - h.x) * 1.2 - h.vx * 1.4, az = (tz - h.z) * 1.2 - h.vz * 1.4;
    h.vx += ax * dt; h.vz += az * dt;
    const sp = Math.hypot(h.vx, h.vz);
    const maxS = 60;
    if (sp > maxS) { h.vx *= maxS / sp; h.vz *= maxS / sp; }
    h.x += h.vx * dt; h.z += h.vz * dt;
    const want = Math.atan2(p.x - h.x, p.z - h.z);
    h.heading += wrapAngle(want - h.heading) * Math.min(1, dt * 1.5);
    h.group.position.set(h.x, h.y + Math.sin(h.t * 1.3) * 0.6, h.z);
    h.group.rotation.set(clamp(ax * 0.004, -0.25, 0.25) + 0.08, h.heading, 0, 'YXZ');
    h.rotor.rotation.y += dt * 28;
    h.tail.rotation.x += dt * 40;
    h.beacon.visible = Math.sin(h.t * 8) > 0;
    // searchlight tracks the player with lag
    h.lx = damp(h.lx ?? p.x, p.x, 3, dt);
    h.lz = damp(h.lz ?? p.z, p.z, 3, dt);
    const top = new THREE.Vector3(h.x, h.y - 1.5, h.z);
    const bottom = new THREE.Vector3(h.lx, 0, h.lz);
    const mid = top.clone().add(bottom).multiplyScalar(0.5);
    const len = top.distanceTo(bottom);
    h.cone.position.copy(mid);
    h.cone.scale.set(1, len / 30, 1);
    h.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), bottom.clone().sub(top).normalize());
    h.pool.position.set(h.lx, 0.12, h.lz);
  }

  rotorVolume() {
    if (!this.heli) return 0;
    const p = this.game.player;
    const d = Math.hypot(this.heli.x - p.x, this.heli.z - p.z);
    return clamp(1 - d / 160, 0, 1) * 0.3;
  }
}
