// Arcade vehicle physics + visual sync, and vehicle/world collision resolution.
import * as THREE from 'three';
import { createCar } from './carModels.js';
import { clamp, damp } from './utils.js';
import { CITY } from './config.js';

let nextId = 1;

export class Vehicle {
  constructor({ model, stats, color, livery = null, kind = 'traffic', premium = false, accent, neonColor, underglow }) {
    this.id = nextId++;
    this.kind = kind; // 'player' | 'police' | 'traffic'
    this.model = model;
    this.stats = { ...stats };
    this.car = createCar(model, { color, livery, premium, accent, neonColor, underglow });
    this.root = this.car.root;
    const s = this.car.spec;
    this.L = s.L; this.W = s.W;
    this.radius = s.L / 2 + 0.3;
    const off = s.L / 2 - s.W / 2;
    this.circleOffsets = [-off, 0, off];
    this.circleR = s.W / 2 * 0.98;
    this.mass = stats.mass || 1;

    this.x = 0; this.z = 0; this.y = 0;
    this.heading = 0;
    this.vx = 0; this.vz = 0;
    this.yawRate = 0;
    this.spin = 0; // external yaw impulse
    this.steer = 0;
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false };
    this.hp = stats.hp;
    this.maxHp = stats.hp;
    this.alive = true;
    this.speedMul = 1;
    this.gripMul = 1;
    this.nitroActive = false;
    this.vF = 0; this.vR = 0;
    this.accelF = 0;
    this.wheelSpin = 0;
    this.drift = 0;
    this.lastImpact = 0;
    this.roll = 0; this.pitch = 0;
    this.braking = false;
    this.disabledTimer = 0; // EMP
  }

  get speed() { return Math.hypot(this.vx, this.vz); }

  place(x, z, heading) {
    this.x = x; this.z = z; this.heading = heading;
    this.vx = 0; this.vz = 0; this.yawRate = 0; this.spin = 0;
    this.sync(0);
  }

  // One fixed physics step.
  step(dt, surfaceGrip = 1) {
    const s = this.stats;
    const inp = this.input;
    const sin = Math.sin(this.heading), cos = Math.cos(this.heading);
    let vF = this.vx * sin + this.vz * cos;
    let vR = -this.vx * cos + this.vz * sin;
    const prevVF = vF;

    const disabled = this.disabledTimer > 0 || !this.alive;
    const throttle = disabled ? 0 : inp.throttle;
    const brake = disabled ? (this.alive ? 0.3 : 0.6) : inp.brake;
    const handbrake = disabled ? false : inp.handbrake;
    this.steer = damp(this.steer, disabled ? 0 : inp.steer, 9, dt);

    const nitro = this.nitroActive && !disabled;
    const maxSpd = s.speed * this.speedMul * (nitro ? 1.32 : 1);
    const accel = s.accel * (nitro ? 1.7 : 1);

    if (throttle > 0) {
      if (vF < -0.5) vF += 30 * throttle * dt;
      else if (vF < maxSpd) vF = Math.min(maxSpd, vF + accel * throttle * dt * (1 - 0.55 * clamp(vF / maxSpd, 0, 1)));
      else vF -= (vF - maxSpd) * 1.5 * dt;
    }
    this.braking = false;
    if (brake > 0) {
      if (vF > 0.8) { vF = Math.max(0, vF - 34 * brake * dt); this.braking = true; } else vF = Math.max(-s.speed * 0.4, vF - s.accel * 0.75 * brake * dt);
    }
    if (throttle <= 0 && brake <= 0) {
      const eb = 2.2 * dt;
      vF = Math.abs(vF) < eb ? 0 : vF - Math.sign(vF) * eb;
    }
    if (vF > maxSpd * 1.02 && throttle <= 0) vF -= (vF - maxSpd) * 1.2 * dt;
    vF -= vF * 0.06 * dt;
    if (handbrake) vF -= vF * 0.9 * dt;

    // lateral grip; the handbrake unlocks the rear so the car slides
    const grip = s.grip * surfaceGrip * this.gripMul * (handbrake ? 0.16 : 1);
    vR *= Math.exp(-grip * dt);
    const vRabs = Math.abs(vR);
    // scrub speed while sliding
    vF -= Math.sign(vF) * Math.min(Math.abs(vF), vRabs * 0.25 * dt);

    // steering → yaw rate
    const spd = Math.abs(vF);
    const sf = clamp(spd / 6, 0, 1) * (1 - 0.28 * clamp(spd / 55, 0, 1));
    let target = -this.steer * s.handling * sf * (vF >= 0 ? 1 : -1);
    if (handbrake) target *= 1.45;
    const resp = surfaceGrip < 0.8 ? 5 : 9;
    this.yawRate = damp(this.yawRate, target, resp, dt);
    this.spin = damp(this.spin, 0, 3, dt);
    this.heading += (this.yawRate + this.spin) * dt;

    this.vx = sin * vF - cos * vR;
    this.vz = cos * vF + sin * vR;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    this.vF = vF; this.vR = vR;
    this.accelF = damp(this.accelF, (vF - prevVF) / dt, 6, dt);
    this.drift = vRabs;
    if (this.disabledTimer > 0) this.disabledTimer -= dt;

    // hard map bounds (safety net)
    const lim = CITY.HALF - 1;
    if (this.x > lim) { this.x = lim; this.vx = -Math.abs(this.vx) * 0.3; }
    if (this.x < -lim) { this.x = -lim; this.vx = Math.abs(this.vx) * 0.3; }
    if (this.z > lim) { this.z = lim; this.vz = -Math.abs(this.vz) * 0.3; }
    if (this.z < -lim) { this.z = -lim; this.vz = Math.abs(this.vz) * 0.3; }
  }

  circles(out) {
    const sin = Math.sin(this.heading), cos = Math.cos(this.heading);
    for (let k = 0; k < 3; k++) {
      const o = this.circleOffsets[k];
      out[k].x = this.x + sin * o;
      out[k].z = this.z + cos * o;
    }
    return out;
  }

  applyImpulse(jx, jz, px, pz) {
    this.vx += jx / this.mass;
    this.vz += jz / this.mass;
    const rx = px - this.x, rz = pz - this.z;
    const torque = rx * jz - rz * jx;
    this.spin -= clamp(torque * 0.045 / this.mass, -3, 3);
  }

  damage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
  }

  // Visual sync: transforms, wheels, body roll, lights.
  sync(dt, groundY = 0) {
    this.y = dt > 0 ? damp(this.y, groundY, 14, dt) : groundY;
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.heading;
    const c = this.car;
    this.wheelSpin += (this.vF * dt) / c.spec.wr;
    for (const w of c.wheels) {
      w.spin.rotation.x = this.wheelSpin;
      if (w.front) w.pivot.rotation.y = -this.steer * 0.5;
    }
    const lat = (this.yawRate + this.spin) * this.vF;
    this.roll = damp(this.roll, clamp(lat * 0.0035, -0.09, 0.09), 8, dt || 1);
    this.pitch = damp(this.pitch, clamp(-this.accelF * 0.0025, -0.05, 0.05), 8, dt || 1);
    c.body.rotation.z = this.roll;
    c.body.rotation.x = this.pitch;
    c.body.position.y = Math.abs(this.roll) * 0.4;
    const b = this.braking ? 3.2 : 1.1;
    c.tailMat.color.setRGB(b, b, b);
  }
}

// ------------------------------------------------------------------ collisions

const CA = [{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0 }];
const CB = [{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0 }];

// Resolve a vehicle against the static city. onHit(info) receives impacts.
export function collideStatic(v, city, onHit) {
  const r = v.circleR;
  v.circles(CA);
  for (let k = 0; k < 3; k++) {
    const c = CA[k];
    city.query(c.x, c.z, r + 0.5, (o) => {
      let nx, nz, pen, px, pz;
      if (o.type === 'box') {
        px = clamp(c.x, o.x0, o.x1); pz = clamp(c.z, o.z0, o.z1);
        let dx = c.x - px, dz = c.z - pz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) return;
        if (d2 < 1e-8) {
          // center inside the box: push out along the smallest axis
          const l = c.x - o.x0, rr = o.x1 - c.x, t = c.z - o.z0, b = o.z1 - c.z;
          const m = Math.min(l, rr, t, b);
          if (m === l) { nx = -1; nz = 0; pen = l + r; } else if (m === rr) { nx = 1; nz = 0; pen = rr + r; } else if (m === t) { nx = 0; nz = -1; pen = t + r; } else { nx = 0; nz = 1; pen = b + r; }
        } else {
          const d = Math.sqrt(d2);
          nx = dx / d; nz = dz / d; pen = r - d;
        }
      } else {
        const dx = c.x - o.x, dz = c.z - o.z;
        const rs = r + o.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rs * rs) return;
        const d = Math.sqrt(d2) || 0.001;
        nx = dx / d; nz = dz / d; pen = rs - d;
        px = o.x + nx * o.r; pz = o.z + nz * o.r;
        if (o.breakable) {
          const sp = Math.hypot(v.vx, v.vz);
          if (sp > 3.5) {
            onHit?.({ type: 'smash', collider: o, v, speed: sp });
            v.vx *= 0.9; v.vz *= 0.9;
            return;
          }
        }
      }
      v.x += nx * pen; v.z += nz * pen;
      c.x += nx * pen; c.z += nz * pen;
      const vn = v.vx * nx + v.vz * nz;
      if (vn < 0) {
        const e = 0.28;
        const jx = -(1 + e) * vn * nx, jz = -(1 + e) * vn * nz;
        // tangential friction
        const tx = v.vx - vn * nx, tz = v.vz - vn * nz;
        v.vx += jx - tx * 0.12;
        v.vz += jz - tz * 0.12;
        const rx = px - v.x, rz = pz - v.z;
        v.spin -= clamp((rx * jz - rz * jx) * 0.05, -2.5, 2.5);
        const impact = -vn;
        if (impact > 2) onHit?.({ type: 'wall', v, impact, x: px, z: pz, nx, nz });
      }
    });
  }
}

// Vehicle vs vehicle. Returns impact speed (or 0).
export function collidePair(a, b, onHit) {
  const dx0 = a.x - b.x, dz0 = a.z - b.z;
  const rr = a.radius + b.radius;
  if (dx0 * dx0 + dz0 * dz0 > rr * rr) return 0;
  a.circles(CA); b.circles(CB);
  let best = null;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const dx = CA[i].x - CB[j].x, dz = CA[i].z - CB[j].z;
      const rs = a.circleR + b.circleR;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rs * rs) continue;
      const d = Math.sqrt(d2) || 0.001;
      const pen = rs - d;
      if (!best || pen > best.pen) best = { nx: dx / d, nz: dz / d, pen, px: (CA[i].x + CB[j].x) / 2, pz: (CA[i].z + CB[j].z) / 2 };
    }
  }
  if (!best) return 0;
  const { nx, nz, pen, px, pz } = best;
  const ima = 1 / a.mass, imb = 1 / b.mass;
  const sum = ima + imb;
  a.x += nx * pen * (ima / sum); a.z += nz * pen * (ima / sum);
  b.x -= nx * pen * (imb / sum); b.z -= nz * pen * (imb / sum);
  const rvx = a.vx - b.vx, rvz = a.vz - b.vz;
  const vn = rvx * nx + rvz * nz;
  if (vn >= 0) return 0;
  const e = 0.35;
  const j = -(1 + e) * vn / sum;
  a.applyImpulse(j * nx, j * nz, px, pz);
  b.applyImpulse(-j * nx, -j * nz, px, pz);
  const impact = -vn;
  onHit?.({ a, b, impact, x: px, z: pz, nx, nz });
  return impact;
}
