// Guns & rockets for everyone: the player on foot (pistol / SMG / rocket launcher),
// car-mounted machine guns and rockets (power-ups), and police officers on foot.
// Bullets are real projectiles (instanced tracers) with hit tests against people,
// vehicles, helicopters and buildings. Aiming: mouse, joystick right stick, or
// auto-aim at the nearest threat in front of you.
import * as THREE from 'three';
import { clamp, wrapAngle } from './utils.js';
import { VEHICLE_WEAPONS, aimTurret } from './warVehicles.js';

export const WEAPONS = {
  pistol: { name: 'PISTOL', rate: 3.2, dmg: 16, spread: 0.035, speed: 125, auto: false },
  smg: { name: 'SMG', rate: 11, dmg: 8, spread: 0.08, speed: 125, auto: true },
  rpg: { name: 'ROCKETS', rate: 0.9, dmg: 130, radius: 8, rocket: true, auto: false },
};

const MAX_BULLETS = 240;

export class Combat {
  constructor(game) {
    this.game = game;
    const geo = new THREE.BoxGeometry(0.06, 0.06, 1.4);
    this.tracerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 1.1) });
    this.copTracerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 0.8) });
    this.mesh = new THREE.InstancedMesh(geo, this.tracerMat, MAX_BULLETS);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    game.scene.add(this.mesh);
    this.rocketGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8).rotateX(Math.PI / 2);
    this.rocketMat = new THREE.MeshStandardMaterial({ color: 0x6b7f3a, roughness: 0.5 });
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1);
    this.fwd = new THREE.Vector3(0, 0, 1);
    this.cBul = new THREE.Color(1, 0.85, 0.4); this.cCop = new THREE.Color(1, 0.4, 0.3);
    this.reset();
  }

  reset() {
    for (const r of this.rockets || []) this.game.scene.remove(r.mesh);
    this.bullets = [];
    this.rockets = [];
    this.weapon = 'pistol';
    this.ammo = { pistol: Infinity, smg: 0, rpg: 0 };
    this.cool = 0;
    this.carGuns = 0;      // seconds of car machine-gun left
    this.carRockets = 0;   // car rockets left
    this.carCool = 0;
    this.target = null;
    this.kills = 0;
    this.writeBullets();
  }

  // ---------------------------------------------------------------- targets
  hostiles() {
    const g = this.game, out = [];
    for (const c of g.police.cops) if (c.alive) out.push({ kind: 'car', ref: c, x: c.x, y: 1.0, z: c.z, r: c.L / 2 });
    for (const c of g.boats.cops) if (c.alive) out.push({ kind: 'car', ref: c, x: c.x, y: -1, z: c.z, r: c.L / 2 });
    for (const p of g.people.list) if (p.copFoot && !p.dead) out.push({ kind: 'cop', ref: p, x: p.x, y: p.y + 1.2, z: p.z, r: 0.5 });
    const h = g.police.heli;
    if (h && !h.falling) out.push({ kind: 'heli', ref: h, x: h.x, y: h.y, z: h.z, r: 4 });
    for (const s of g.military.gunships) if (!s.falling) out.push({ kind: 'heli', ref: s, x: s.x, y: s.y, z: s.z, r: 4.5 });
    return out;
  }

  // Pick a target near the wanted aim direction (or the nearest one in front).
  pickTarget(x, z, yaw, cone = 0.9, range = 55, heavy = false) {
    let best = null, bs = Infinity;
    for (const t of this.hostiles()) {
      const dx = t.x - x, dz = t.z - z, d = Math.hypot(dx, dz);
      if (d > range + (t.kind === 'heli' ? 25 : 0)) continue;
      const off = Math.abs(wrapAngle(Math.atan2(dx, dz) - yaw));
      if (off > cone) continue;
      let score = d * (1 + off * 1.5) * (t.kind === 'cop' ? 0.7 : 1);
      if (heavy && (t.kind === 'heli' || t.ref.copType === 'tank')) score *= 0.25; // rockets go for the big threats
      if (score < bs) { bs = score; best = t; }
    }
    return best;
  }

  // ---------------------------------------------------------------- firing
  fireBullet(x, y, z, dx, dy, dz, { speed = 120, dmg = 10, spread = 0.04, owner = 'player' } = {}) {
    if (this.bullets.length >= MAX_BULLETS) this.bullets.shift();
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;
    dx += (Math.random() - 0.5) * spread * 2; dy += (Math.random() - 0.5) * spread; dz += (Math.random() - 0.5) * spread * 2;
    const n = Math.hypot(dx, dy, dz);
    this.bullets.push({ x, y, z, vx: dx / n * speed, vy: dy / n * speed, vz: dz / n * speed, life: 1.1, dmg, owner });
    this.game.effects.glowP.spawn(x, y, z, 0, 0, 0, 1, 0.8, 0.4, 0.55, 0.05, { alpha: 1 });
  }

  // Player on foot pulls the trigger. aim: { yaw, manual } in world space.
  playerShoot(av, aim) {
    const g = this.game;
    const W = WEAPONS[this.weapon];
    if (this.cool > 0) return false;
    if (this.ammo[this.weapon] <= 0) { this.weapon = 'pistol'; return false; }
    const t = this.pickTarget(av.x, av.z, aim.yaw, aim.manual ? 0.35 : (W.rocket ? 3.2 : 1.0), 55, !!W.rocket);
    this.target = t;
    const hx = av.x + Math.sin(aim.yaw) * 0.6, hz = av.z + Math.cos(aim.yaw) * 0.6, hy = av.y + 1.35;
    let dx = Math.sin(aim.yaw), dy = 0, dz = Math.cos(aim.yaw);
    if (t) { dx = t.x - hx; dz = t.z - hz; dy = t.y - hy; }
    if (W.rocket) this.launchRocket(hx, hy, hz, dx, dy, dz, t, W, av);
    else {
      this.fireBullet(hx, hy, hz, dx, dy, dz, { speed: W.speed, dmg: W.dmg, spread: W.spread, owner: 'player' });
      g.audio.gunshot?.(this.weapon);
    }
    if (this.ammo[this.weapon] !== Infinity) this.ammo[this.weapon]--;
    this.cool = 1 / W.rate;
    av.aimYaw = t ? Math.atan2(t.x - av.x, t.z - av.z) : aim.yaw;
    av.firing = 0.35;
    g.heat += 0.15;
    return true;
  }

  // opts: speed (launch), straight (tank shell: no homing, constant speed), turn (homing rate)
  launchRocket(x, y, z, dx, dy, dz, target, W, owner, { speed = 30, straight = false, turn = 5 } = {}) {
    const mesh = new THREE.Mesh(this.rocketGeo, this.rocketMat);
    mesh.position.set(x, y, z);
    this.game.scene.add(mesh);
    const n = Math.hypot(dx, dy, dz) || 1;
    this.rockets.push({ mesh, vx: dx / n * speed, vy: dy / n * speed, vz: dz / n * speed, target, life: straight ? 1.6 : 4, dmg: W.dmg, radius: W.radius, owner, straight, speed, turn });
    if (!straight) this.game.audio.missile?.();
  }

  // Player-driven armed vehicle (garage war vehicles, armed boats, a stolen tank).
  // wi = { fire, aimYaw, manual }: aim with the mouse / right stick, or auto-lock ahead.
  vehicleWeapons(car, wi, dt) {
    const g = this.game, wv = car.wv;
    const id = car.weapons[car.wIdx || 0], W = VEHICLE_WEAPONS[id];
    car.wCool = Math.max(0, (car.wCool || 0) - dt);
    const yaw0 = wi.aimYaw ?? car.heading;
    const range = W.shell ? 95 : W.rocket ? 80 : 62;
    const t = this.pickTarget(car.x, car.z, yaw0, wi.manual ? 0.35 : (W.cone || 0.6), range, !!(W.rocket || W.shell));
    this.target = t;
    const want = t ? Math.atan2(t.x - car.x, t.z - car.z) : yaw0;
    let fireYaw = car.heading, err = 0;
    if (W.turret && wv.turret) {
      err = aimTurret(wv.turret, car.heading, want, dt, W.shell ? 1.7 : 5);
      fireYaw = car.heading + wv.turret.rotation.y;
    }
    if (!wi.fire || car.wCool > 0 || g.state !== 'playing') return;
    if (W.shell && err > 0.15) return; // the big gun waits until it is lined up
    let mz = wv.muzzles[id] || null;
    if (W.rocket && wv.pods.length) { car.podI = ((car.podI || 0) + 1) % wv.pods.length; mz = wv.pods[car.podI].userData.muzzle; }
    const pos = mz ? mz.getWorldPosition(this.v) : this.v.set(car.x + Math.sin(fireYaw) * (car.L / 2 + 0.5), 1.2, car.z + Math.cos(fireYaw) * (car.L / 2 + 0.5));
    const x = pos.x, y = Math.max(pos.y, car.boat ? 0.7 : 0.5), z = pos.z;
    let dx = Math.sin(fireYaw), dz = Math.cos(fireYaw), dy = 0;
    if (t && (!W.turret || err < 0.25)) {
      const d = Math.hypot(t.x - x, t.z - z) || 1;
      dx = (t.x - x) / d; dz = (t.z - z) / d;
      dy = car.boat && t.kind !== 'heli' ? 0 : (t.y - y) / d;
    }
    if (id === 'mg') {
      this.fireBullet(x, y, z, dx, dy, dz, { speed: W.speed, dmg: W.dmg, spread: W.spread, owner: 'player' });
      g.audio.gunshot?.('mg');
      g.heat += 0.04;
    } else if (W.shell) {
      this.launchRocket(x, y, z, dx, dy, dz, null, W, car, { speed: 115, straight: true });
      if (car.car.muzzleMat) { car.gunFlash = 0.12; car.recoil = 1; }
      car.vx -= dx * 1.2; car.vz -= dz * 1.2;
      g.audio.cannon?.(0);
      g.shake = Math.min(1.2, g.shake + 0.35);
      g.effects.explosionSmall?.(x, y, z);
      g.heat += 1.2;
    } else {
      this.launchRocket(x, y, z, dx, dy, dz, t, W, car, { speed: 38, turn: id === 'missiles' ? 8 : 4 });
      g.heat += 0.6;
    }
    car.wCool = 1 / W.rate;
  }

  // Q in an armed vehicle: next weapon of its loadout.
  nextVehicleWeapon(car) {
    car.wIdx = ((car.wIdx || 0) + 1) % car.weapons.length;
    return VEHICLE_WEAPONS[car.weapons[car.wIdx]].name;
  }

  // Police officer on foot shoots at the player (less accurate when you move fast).
  copShoot(p, t) {
    const hx = p.x + Math.sin(p.heading) * 0.5, hz = p.z + Math.cos(p.heading) * 0.5, hy = p.y + 1.35;
    const lead = 0.12;
    const tx = t.x + t.vx * lead, tz = t.z + t.vz * lead, ty = (t.y || 0) + (t.kind === 'avatar' ? 1.1 : 0.9);
    const spread = 0.08 + Math.min(0.14, t.speed * 0.01);
    this.fireBullet(hx, hy, hz, tx - hx, ty - hy, tz - hz, { speed: 90, dmg: t.kind === 'avatar' ? 4.5 : 2.5, spread, owner: 'cop' });
    this.game.audio.gunshot?.('cop', Math.hypot(p.x - this.game.player.x, p.z - this.game.player.z));
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const g = this.game;
    this.cool = Math.max(0, this.cool - dt);
    this.carCool = Math.max(0, this.carCool - dt);
    if (this.carGuns > 0) this.carGuns = Math.max(0, this.carGuns - dt);
    // car-mounted weapons fire automatically at targets ahead
    const car = g.car;
    if (car && g.state === 'playing' && (this.carGuns > 0 || this.carRockets > 0) && this.carCool <= 0) {
      const t = this.pickTarget(car.x, car.z, car.heading, 0.45, 60);
      this.target = t;
      if (t) {
        const s = Math.sin(car.heading), c = Math.cos(car.heading);
        const fx = car.x + s * (car.L / 2 + 0.4), fz = car.z + c * (car.L / 2 + 0.4);
        if (this.carRockets > 0 && (t.kind === 'heli' || t.ref.copType === 'tank' || t.ref.copType === 'swat' || this.carGuns <= 0)) {
          this.launchRocket(fx, 1.2, fz, t.x - fx, t.y - 1.2, t.z - fz, t, WEAPONS.rpg, car);
          this.carRockets--;
          this.carCool = 0.7;
        } else if (this.carGuns > 0) {
          for (const side of [-0.7, 0.7]) this.fireBullet(fx - c * side, 1.0, fz + s * side, t.x - fx, t.y - 1.0, t.z - fz, { speed: 140, dmg: 7, spread: 0.05, owner: 'player' });
          g.audio.gunshot?.('mg');
          this.carCool = 1 / 12;
          g.heat += 0.05;
        }
      }
    } else if (!car) { /* on foot: the player controls the trigger */ }
    this.updateBullets(dt);
    this.updateRockets(dt);
    this.writeBullets();
  }

  updateBullets(dt) {
    const g = this.game, city = g.city;
    const player = g.player;
    const hostiles = this.hostiles();
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      // sub-step so fast bullets can't tunnel through people
      const steps = Math.ceil((Math.hypot(b.vx, b.vz) * dt) / 0.8);
      let dead = b.life <= 0;
      for (let s = 0; s < steps && !dead; s++) {
        const h = dt / steps;
        b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
        if (b.y < 0.05) { g.effects.sparks(b.x, 0.1, b.z, 0, 1, 3, 3); dead = true; break; }
        if (city.pointBlocked(b.x, b.z, 0) && b.y < 12) { g.effects.sparks(b.x, b.y, b.z, -b.vx, -b.vz, 4, 3); dead = true; break; }
        if (b.owner === 'player') {
          for (const t of hostiles) {
            const dy = b.y - t.y;
            if (t.kind === 'cop' && Math.abs(dy) > 0.9) continue;
            if (t.kind === 'car' && b.y > 2.6) continue;
            const r = t.kind === 'heli' ? t.r : t.r + 0.1;
            const d2 = (b.x - t.x) ** 2 + (b.z - t.z) ** 2 + (t.kind === 'heli' ? dy * dy : 0);
            if (d2 < r * r) { this.hit(t, b.dmg, b); dead = true; break; }
          }
          if (dead) break;
          // civilians caught in the crossfire
          for (const p of g.people.list) {
            if (p.copFoot || p.avatar || p.mode === 'down') continue;
            if ((b.x - p.x) ** 2 + (b.z - p.z) ** 2 < 0.2 && b.y < 2) {
              g.people.knock(p, b.vx * 0.05, b.vz * 0.05);
              g.onCivilianShot?.(p);
              dead = true; break;
            }
          }
        } else if (player) {
          if (player.kind === 'avatar') {
            if ((b.x - player.x) ** 2 + (b.z - player.z) ** 2 < 0.28 && Math.abs(b.y - (player.y + 1)) < 1) {
              g.onPlayerShot?.(b.dmg); dead = true;
            }
          } else if ((b.x - player.x) ** 2 + (b.z - player.z) ** 2 < (player.L / 2) ** 2 && b.y < 2.2) {
            g.onPlayerShot?.(b.dmg); g.effects.sparks(b.x, b.y, b.z, -b.vx, -b.vz, 3, 3); dead = true;
          }
        }
      }
      if (dead) this.bullets.splice(i, 1);
    }
  }

  hit(t, dmg, b) {
    const g = this.game;
    if (t.kind === 'cop') {
      const p = t.ref;
      p.hp = (p.hp ?? 40) - dmg;
      g.effects.debrisBurst(p.x, p.z, [0.3, 0.3, 0.35], 2);
      if (p.hp <= 0) { p.dead = true; g.people.knock(p, b.vx * 0.06, b.vz * 0.06); g.onOfficerDown?.(p); } else p.startle = 0.3;
    } else if (t.kind === 'car') {
      const v = t.ref;
      v.damage(dmg * (v.copType === 'tank' ? 0.15 : 0.8));
      g.effects.sparks(b.x, b.y, b.z, -b.vx, -b.vz, 4, 4);
      if (!v.alive && !v.destroyed) g.onDestroyed(v);
    } else if (t.kind === 'heli') {
      g.damageHeli(t.ref, dmg * 0.6);
      g.effects.sparks(b.x, b.y, b.z, -b.vx, -b.vz, 5, 5);
    }
  }

  updateRockets(dt) {
    const g = this.game;
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.life -= dt;
      const t = r.target;
      const sp = r.straight ? r.speed : Math.min(75, Math.hypot(r.vx, r.vy, r.vz) + 60 * dt);
      if (t && !r.straight) {
        const tx = t.kind === 'heli' ? t.ref.x : t.ref.x, ty = t.kind === 'heli' ? t.ref.y : 1, tz = t.ref.z;
        const dx = tx - r.mesh.position.x, dy = ty - r.mesh.position.y, dz = tz - r.mesh.position.z;
        const n = Math.hypot(dx, dy, dz) || 1;
        const k = Math.min(1, dt * (r.turn || 5));
        r.vx += (dx / n * sp - r.vx) * k; r.vy += (dy / n * sp - r.vy) * k; r.vz += (dz / n * sp - r.vz) * k;
      }
      const n = Math.hypot(r.vx, r.vy, r.vz) || 1;
      r.vx *= sp / n; r.vy *= sp / n; r.vz *= sp / n;
      const pos = r.mesh.position;
      pos.x += r.vx * dt; pos.y += r.vy * dt; pos.z += r.vz * dt;
      r.mesh.lookAt(pos.x + r.vx, pos.y + r.vy, pos.z + r.vz);
      g.effects.missileTrail?.(pos.x, pos.y, pos.z);
      let boom = r.life <= 0 || pos.y <= 0.1 || (g.city.pointBlocked(pos.x, pos.z, 0) && pos.y < 12);
      if (!boom) {
        for (const h of this.hostiles()) {
          const d2 = (pos.x - h.x) ** 2 + (pos.z - h.z) ** 2 + (h.kind === 'heli' ? (pos.y - h.y) ** 2 : 0);
          if (d2 < (h.r + 1.5) ** 2 && (h.kind === 'heli' || pos.y < 3)) { boom = true; if (h.kind === 'heli') g.damageHeli(h.ref, 200); break; } // one rocket downs a helicopter
        }
      }
      if (boom) {
        g.scene.remove(r.mesh);
        this.rockets.splice(i, 1);
        if (pos.y > 6) { g.effects.explosion(pos.x, pos.z); g.effects.flash.position.set(pos.x, pos.y, pos.z); g.audio.explosion(); } else g.explode(pos.x, pos.z, r.radius, r.dmg, r.owner, true);
        g.military.addScorch?.(pos.x, pos.z, r.radius * 0.7);
      }
    }
  }

  writeBullets() {
    const n = this.bullets.length;
    for (let i = 0; i < n; i++) {
      const b = this.bullets[i];
      this.v.set(b.vx, b.vy, b.vz).normalize();
      this.q.setFromUnitVectors(this.fwd, this.v);
      this.m.compose(this.v.set(b.x, b.y, b.z), this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, b.owner === 'player' ? this.cBul : this.cCop);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  // Cycle to the next weapon that has ammo.
  nextWeapon() {
    const order = ['pistol', 'smg', 'rpg'];
    let i = order.indexOf(this.weapon);
    for (let k = 0; k < 3; k++) {
      i = (i + 1) % 3;
      if (this.ammo[order[i]] > 0) { this.weapon = order[i]; return this.weapon; }
    }
    return this.weapon;
  }

  clampAim(yaw) { return clamp(yaw, -Math.PI * 2, Math.PI * 2); }
}
