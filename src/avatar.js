// The player on foot: run / sprint (stamina) / jump / swim, collisions with the
// city and traffic, knock-downs, and the interface police & pickups expect from
// the chased entity (x, z, vx, vz, heading, speed, hp ...). Rendered through the
// people/humans system as a rigged character with motion-captured animation.
import { CITY } from './config.js';
import { clamp, wrapAngle, damp } from './utils.js';
import { rc } from './city.js';

const { RIVER_ROW, ROAD } = CITY;
const WATER_Y = -1.6;

export class Avatar {
  constructor(game) {
    this.game = game;
    this.kind = 'avatar';
    this.W = 0.6; this.L = 0.6; this.mass = 0.8;
    this.stats = { speed: 8 };
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this.drift = 0; this.braking = false; this.nitroActive = false; this.vF = 0;
    this.maxHp = 100;
    this.reset();
  }

  reset() {
    this.x = 0; this.z = 0; this.y = 0.15; this.vx = 0; this.vz = 0; this.vy = 0;
    this.heading = 0; this.hp = this.maxHp; this.alive = true; this.stamina = 1;
    this.onGround = true; this.swimming = false; this.state = 'foot'; this.stateT = 0;
    this.active = false; this.person = null; this.aimYaw = null; this.firing = 0;
  }

  get speed() { return Math.hypot(this.vx, this.vz); }

  // Put the character into the world (e.g. stepping out of a car).
  spawn(x, z, heading, vx = 0, vz = 0) {
    const people = this.game.people;
    if (!this.person || !people.list.includes(this.person)) {
      this.person = people.make(x, z, {
        script: true, avatar: true, priority: true, rigKind: 'hoodie', outfit: 'dark', armed: true,
        height: 1.8, mode: 'player', walk: 0,
      });
    }
    this.x = x; this.z = z; this.heading = heading;
    this.vx = vx; this.vz = vz; this.vy = 0;
    this.y = this.game.city.groundHeight(x, z);
    this.active = true;
    this.state = 'foot';
    this.person.mode = 'player';
    this.sync();
  }

  hide() {
    this.active = false;
    if (this.person) {
      const L = this.game.people.list, i = L.indexOf(this.person);
      if (this.person.rig) { this.game.humans.active.delete(this.person.rig); this.game.humans.release(this.person.rig); this.person.rig = null; }
      if (i >= 0) L.splice(i, 1);
      this.person = null;
    }
  }

  damage(n) {
    if (!this.alive || n <= 0) return;
    this.hp -= n;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
  }

  // Tumble to the ground (hit by a car, bailing out at speed, blast).
  knock(vx, vz, secs = 1.3) {
    if (this.state === 'down') return;
    this.state = 'down';
    this.stateT = secs;
    this.vx = vx * 0.6; this.vz = vz * 0.6; this.vy = 3 + Math.min(5, Math.hypot(vx, vz) * 0.12);
    if (this.person) { this.person.mode = 'down'; this.person.hitT = 0; }
  }

  inRiver(x, z) {
    const z0 = rc(RIVER_ROW) + ROAD / 2, z1 = rc(RIVER_ROW + 1) - ROAD / 2;
    if (z <= z0 || z >= z1) return false;
    for (let i = 0; i <= CITY.N; i++) if (this.game.city.hasBridge(i) && Math.abs(x - rc(i)) < ROAD / 2) return false;
    return true;
  }

  blocked(x, z) {
    let hit = false;
    this.game.city.query(x, z, 1, (o) => {
      if (hit) return;
      if (o.type === 'box') {
        if (o.kind === 'river' || o.kind === 'wall' && false) return; // you can jump into the river
        if (x > o.x0 - 0.3 && x < o.x1 + 0.3 && z > o.z0 - 0.3 && z < o.z1 + 0.3 && (o.h || 10) > this.y + 0.4) hit = true;
      } else if (Math.hypot(x - o.x, z - o.z) < o.r + 0.3) hit = true;
    });
    return hit;
  }

  // inp: { mx, mz (world-space move vector, |m|<=1), sprint, jump, aimX, aimZ, fire }
  update(dt, inp) {
    const g = this.game;
    this.stateT -= dt;
    if (this.state === 'down') {
      this.vy -= 18 * dt;
      this.x += this.vx * dt; this.z += this.vz * dt; this.y += this.vy * dt;
      const gy = this.swimming ? WATER_Y - 1.35 : g.city.groundHeight(this.x, this.z);
      if (this.y <= gy) { this.y = gy; this.vy = 0; const f = Math.exp(-5 * dt); this.vx *= f; this.vz *= f; }
      if (this.stateT <= 0 && this.alive) { this.state = 'getup'; this.stateT = 1.0; if (this.person) this.person.mode = 'getup'; }
      this.sync();
      return;
    }
    if (this.state === 'getup') {
      this.vx = this.vz = 0;
      if (this.stateT <= 0) { this.state = 'foot'; if (this.person) this.person.mode = 'player'; }
      this.sync();
      return;
    }
    // ---- locomotion
    const m = Math.min(1, Math.hypot(inp.mx, inp.mz));
    const sprinting = inp.sprint && this.stamina > 0.05 && m > 0.3;
    this.stamina = clamp(this.stamina + (sprinting ? (this.swimming ? -0.34 : -0.24) : 0.16) * dt, 0, 1);
    // running speeds (m/s): jog 7.5, sprint 11; swimming 3.2, fast crawl 4.8
    const top = this.swimming ? (sprinting ? 4.8 : 3.2) : sprinting ? 11 : 7.5;
    const tvx = m > 0.05 ? (inp.mx / Math.max(m, 1e-6)) * m * top : 0;
    const tvz = m > 0.05 ? (inp.mz / Math.max(m, 1e-6)) * m * top : 0;
    const ctl = this.onGround || this.swimming ? 12 : 2.5;
    this.vx = damp(this.vx, tvx, ctl, dt);
    this.vz = damp(this.vz, tvz, ctl, dt);
    // face the aim direction while shooting, otherwise the direction of travel
    let face = null;
    if (this.aimYaw !== null && this.firing > 0) face = this.aimYaw;
    else if (this.speed > 0.4) face = Math.atan2(this.vx, this.vz);
    if (face !== null) this.heading += clamp(wrapAngle(face - this.heading), -14 * dt, 14 * dt);
    // jump
    if (inp.jump && this.onGround && !this.swimming) { this.vy = 5.4; this.onGround = false; g.audio.jump?.(); }
    // move with sliding collisions
    const nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    if (!this.blocked(nx, this.z)) this.x = nx; else this.vx = 0;
    if (!this.blocked(this.x, nz)) this.z = nz; else this.vz = 0;
    const lim = CITY.HALF - 1;
    this.x = clamp(this.x, -lim, lim); this.z = clamp(this.z, -lim, lim);
    // vertical: ground, water
    const water = this.inRiver(this.x, this.z);
    const ground = water ? WATER_Y - 1.35 : g.city.groundHeight(this.x, this.z);
    this.vy -= 16 * dt;
    this.y += this.vy * dt;
    if (this.y <= ground) {
      if (water && !this.swimming) { g.effects.splash(this.x, this.z); g.effects.splash(this.x, this.z); g.audio.splash?.(); }
      this.y = ground; this.vy = 0; this.onGround = true;
    } else if (this.y > ground + 0.05) this.onGround = false;
    // climb out of the river onto the bank when swimming against it
    if (this.swimming && !water && this.y < 0) { this.y = g.city.groundHeight(this.x, this.z); this.vy = 0; }
    this.swimming = water && this.y < WATER_Y - 0.5;
    // swimming: blend from upright treading water to a horizontal front crawl
    this.swimBlend = damp(this.swimBlend || 0, this.swimming && this.speed > 0.8 ? 1 : 0, 5, dt);
    if (this.swimming) {
      this.strokeT = (this.strokeT || 0) - dt;
      if (this.strokeT <= 0 && this.speed > 0.8) {
        this.strokeT = 1.15 / (0.55 + this.speed * 0.14) / 2; // one splash per arm stroke
        const s = Math.sin(this.heading), c = Math.cos(this.heading), side = (this.strokeSide = -(this.strokeSide || 1));
        g.effects.splash(this.x + s * 1.2 - c * side * 0.35, this.z + c * 1.2 + s * side * 0.35);
        g.audio.footstep?.(0.05, 'water');
      }
      if (this.speed < 0.8 && Math.random() < dt * 1.5) g.effects.splash(this.x, this.z);
    }
    // ---- traffic: get out of the way or get run over
    for (const v of g.vehicles) {
      if (!!v.boat !== this.swimming) continue; // boats hit swimmers, cars hit walkers
      const rx = this.x - v.x, rz = this.z - v.z;
      if (rx * rx + rz * rz > 36) continue;
      const s = Math.sin(v.heading), c = Math.cos(v.heading);
      const fwd = rx * s + rz * c, side = rx * c - rz * s;
      if (Math.abs(fwd) < v.L / 2 + 0.3 && Math.abs(side) < v.W / 2 + 0.3 && this.y < 1.5) {
        const sp = v.speed;
        if (sp > 6) {
          const dmg = g.powerTimers.shield > 0 ? 0 : sp * (v.copType === 'tank' ? 3 : 1.3);
          this.damage(dmg);
          g.shake = Math.min(1.2, g.shake + 0.5);
          g.ui.flash('hit');
          g.audio.thud?.();
          this.knock(v.vx, v.vz);
        } else {
          // step aside from a slow / parked car
          const push = side >= 0 ? 1 : -1;
          this.x += c * push * 0.08; this.z -= s * push * 0.08;
        }
      }
    }
    this.sync();
  }

  sync() {
    const p = this.person;
    if (!p) return;
    p.x = this.x; p.z = this.z; p.y = this.y; p.heading = this.heading;
    p.speed = this.state === 'foot' ? this.speed : 0;
    p.swim = this.swimming;
    p.swimBlend = this.swimBlend || 0;
    p.firing = this.firing > 0;
    p.aiming = this.aimYaw !== null;
    p.combatPose = this.game.combat?.weapon ? true : false;
    p.air = !this.onGround && !this.swimming;
  }
}
