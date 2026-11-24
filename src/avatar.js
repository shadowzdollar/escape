// The player on foot: run / sprint (stamina) / jump / swim / climb-out,
// swept collisions with city buildings & vehicles, knock-downs with wall bounce,
// and the interface police & pickups expect from the chased entity.
import { CITY } from './config.js';
import { clamp, wrapAngle, damp } from './utils.js';
import { rc } from './city.js';
import { WATER_Y } from './boats.js';
import { resolveCircleCity, sweepCircleCity, resolveCircleVehicle } from './collision.js';

const { RIVER_ROW, ROAD } = CITY;
const PLAYER_R = 0.36;

export class Avatar {
  constructor(game) {
    this.game = game;
    this.kind = 'avatar';
    this.W = 0.65; this.L = 0.65; this.mass = 0.85;
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
    this.swimBlend = 0; this.swimPhase = 0; this.diveTimer = 0; this.climbTarget = null;
  }

  get speed() { return Math.hypot(this.vx, this.vz); }

  // Put the character into the world (e.g. stepping out of a car or boat).
  spawn(x, z, heading, vx = 0, vz = 0) {
    const people = this.game.people;
    if (!this.person || !people.list.includes(this.person)) {
      this.person = people.make(x, z, {
        script: true, avatar: true, priority: true, rigKind: 'hoodie', outfit: 'dark', armed: true,
        height: 1.8, mode: 'player', walk: 0,
      });
    }
    const inW = this.inRiverChannel(x, z) && !this.onBridgeDeck(x, z, 0);
    // Ensure spawn position is never inside a building or obstacle
    const res = resolveCircleCity(x, z, PLAYER_R, inW ? WATER_Y : 0.15, this.game.city, {
      skipRiver: true,
      checkPiers: inW,
    });
    this.x = res.x; this.z = res.z; this.heading = heading;
    this.vx = vx; this.vz = vz; this.vy = 0;
    this.swimming = inW;
    this.y = inW ? WATER_Y - 1.2 : this.game.city.groundHeight(this.x, this.z);
    this.active = true;
    this.state = 'foot';
    this.swimBlend = 0;
    this.diveTimer = 0;
    this.climbTarget = null;
    this.person.mode = 'player';
    this.sync();
  }

  hide() {
    this.active = false;
    if (this.person) {
      const L = this.game.people.list, i = L.indexOf(this.person);
      if (this.person.rig) {
        this.game.humans.active.delete(this.person.rig);
        this.game.humans.release(this.person.rig);
        this.person.rig = null;
      }
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
    // Cap knockback speed for stable collision physics while preserving dramatic impact feel
    const sp = Math.hypot(vx, vz);
    const k = sp > 32 ? 32 / sp : 1;
    this.vx = vx * 0.58 * k;
    this.vz = vz * 0.58 * k;
    this.vy = 2.8 + Math.min(4.8, sp * 0.11);
    if (this.person) { this.person.mode = 'down'; this.person.hitT = 0; }
  }

  inRiverChannel(x, z) {
    const z0 = rc(RIVER_ROW) + ROAD / 2, z1 = rc(RIVER_ROW + 1) - ROAD / 2;
    return z > z0 && z < z1;
  }

  onBridgeDeck(x, z, y = this.y) {
    if (y < -0.9) return false; // already in water underneath the bridge!
    for (let i = 0; i <= CITY.N; i++) {
      if (this.game.city.hasBridge(i) && Math.abs(x - rc(i)) < ROAD / 2) return true;
    }
    return false;
  }

  inRiver(x, z) {
    if (!this.inRiverChannel(x, z)) return false;
    if (!this.swimming && this.onBridgeDeck(x, z, this.y)) return false;
    return true;
  }

  // Check if player is trying to swim out onto the north/south river bank
  tryClimbBank(inp) {
    const z0 = rc(RIVER_ROW) + ROAD / 2;
    const z1 = rc(RIVER_ROW + 1) - ROAD / 2;
    const nearNorth = this.z < z0 + 1.3 && inp.mz < -0.25;
    const nearSouth = this.z > z1 - 1.3 && inp.mz > 0.25;
    if (!nearNorth && !nearSouth) return false;
    const tx = this.x;
    const tz = nearNorth ? z0 - 1.15 : z1 + 1.15;
    // Don't climb straight into a solid building/barrier if blocked
    if (this.game.city.pointBlocked(tx, tz, 0.45)) return false;
    this.state = 'climb';
    this.stateT = 0.42;
    this.climbTarget = { x0: this.x, y0: this.y, z0: this.z, x1: tx, y1: this.game.city.groundHeight(tx, tz), z1: tz };
    this.vx = 0; this.vz = 0; this.vy = 0;
    this.heading = nearNorth ? Math.PI : 0;
    this.game.audio.jump?.();
    this.game.effects.splash(this.x, this.z, WATER_Y + 0.1);
    return true;
  }

  // inp: { mx, mz (world-space move vector, |m|<=1), sprint, jump, aimX, aimZ, fire }
  update(dt, inp) {
    const g = this.game;
    const city = g.city;
    this.stateT -= dt;

    // ---- Climbing out of the river onto the bank
    if (this.state === 'climb' && this.climbTarget) {
      const ct = this.climbTarget;
      const u = clamp(1 - this.stateT / 0.42, 0, 1);
      const ease = u * u * (3 - 2 * u);
      this.x = ct.x0 + (ct.x1 - ct.x0) * ease;
      this.z = ct.z0 + (ct.z1 - ct.z0) * ease;
      this.y = ct.y0 + (ct.y1 - ct.y0) * ease + Math.sin(u * Math.PI) * 0.45;
      this.swimming = u < 0.35;
      this.swimBlend = Math.max(0, (1 - u * 2.5) * (this.swimBlend || 0));
      if (this.stateT <= 0) {
        this.x = ct.x1; this.z = ct.z1; this.y = ct.y1;
        this.swimming = false; this.onGround = true;
        this.state = 'foot'; this.climbTarget = null;
        if (this.person) this.person.mode = 'player';
      }
      this.sync();
      return;
    }

    // ---- Knocked down / ragdoll flight (WITH full swept building & vehicle collision!)
    if (this.state === 'down') {
      this.vy -= 18 * dt;
      const nx = this.x + this.vx * dt;
      const nz = this.z + this.vz * dt;
      const sweep = sweepCircleCity(this.x, this.z, nx, nz, PLAYER_R + 0.08, this.y, city, {
        skipRiver: true,
        checkPiers: this.swimming,
      });
      this.x = sweep.x;
      this.z = sweep.z;
      if (sweep.hit) {
        // Realistic bounce off exterior wall — never tunnel or get stuck inside!
        const vn = this.vx * sweep.nx + this.vz * sweep.nz;
        if (vn < 0) {
          const e = 0.32;
          this.vx -= (1 + e) * vn * sweep.nx;
          this.vz -= (1 + e) * vn * sweep.nz;
          this.vx *= 0.72;
          this.vz *= 0.72;
          if (-vn > 5) {
            g.audio.thud?.();
            g.shake = Math.min(1.0, g.shake + 0.25);
          }
        }
      }
      const lim = CITY.HALF - 1.2;
      this.x = clamp(this.x, -lim, lim);
      this.z = clamp(this.z, -lim, lim);

      this.y += this.vy * dt;
      const water = this.inRiver(this.x, this.z);
      const gy = water ? WATER_Y - 1.25 : city.groundHeight(this.x, this.z);
      if (this.y <= gy) {
        if (water && !this.swimming) {
          g.effects.splash(this.x, this.z, WATER_Y + 0.1);
          g.audio.splash?.();
          this.swimming = true;
        }
        this.y = gy; this.vy = 0;
        const f = Math.exp(-5.5 * dt);
        this.vx *= f; this.vz *= f;
      }
      // Keep knocked body outside vehicles too, then re-enforce building boundaries
      for (const v of g.vehicles) {
        if (!!v.boat !== this.swimming) continue;
        const hit = resolveCircleVehicle(this.x, this.z, PLAYER_R + 0.06, v);
        if (hit) {
          this.x += hit.nx * hit.pen;
          this.z += hit.nz * hit.pen;
          const post = resolveCircleCity(this.x, this.z, PLAYER_R + 0.06, this.y, city, { skipRiver: true, checkPiers: this.swimming });
          this.x = post.x; this.z = post.z;
        }
      }
      if (this.stateT <= 0 && this.alive) {
        this.state = 'getup';
        this.stateT = this.swimming ? 0.25 : 0.9;
        if (this.person) this.person.mode = this.swimming ? 'player' : 'getup';
      }
      this.sync();
      return;
    }

    if (this.state === 'getup') {
      this.vx = this.vz = 0;
      const post = resolveCircleCity(this.x, this.z, PLAYER_R, this.y, city, { skipRiver: true, checkPiers: this.swimming });
      this.x = post.x; this.z = post.z;
      if (this.stateT <= 0) { this.state = 'foot'; if (this.person) this.person.mode = 'player'; }
      this.sync();
      return;
    }

    // ---- Locomotion (on foot or swimming)
    const m = Math.min(1, Math.hypot(inp.mx, inp.mz));
    const sprinting = inp.sprint && this.stamina > 0.05 && m > 0.3;
    this.stamina = clamp(this.stamina + (sprinting ? (this.swimming ? -0.32 : -0.24) : 0.16) * dt, 0, 1);

    // Check bank climb-out while swimming
    if (this.swimming && this.tryClimbBank(inp)) {
      this.sync();
      return;
    }

    // Realistic speeds: jog 7.5 m/s, sprint 11 m/s; swim freestyle 3.4 m/s, fast crawl 5.2 m/s
    const top = this.swimming ? (sprinting ? 5.2 : 3.4) : sprinting ? 11 : 7.5;
    const tvx = m > 0.05 ? (inp.mx / Math.max(m, 1e-6)) * m * top : 0;
    const tvz = m > 0.05 ? (inp.mz / Math.max(m, 1e-6)) * m * top : 0;
    const ctl = this.swimming ? 4.8 : (this.onGround ? 12 : 2.8);
    this.vx = damp(this.vx, tvx, ctl, dt);
    this.vz = damp(this.vz, tvz, ctl, dt);

    // Face the aim direction while shooting, otherwise smooth turn toward travel direction
    let face = null;
    if (this.aimYaw !== null && this.firing > 0 && !this.swimming) face = this.aimYaw;
    else if (this.speed > 0.35) face = Math.atan2(this.vx, this.vz);
    const turnRate = this.swimming ? 6.5 : 14;
    if (face !== null) this.heading += clamp(wrapAngle(face - this.heading), -turnRate * dt, turnRate * dt);

    // Jump (on land)
    if (inp.jump && this.onGround && !this.swimming) {
      this.vy = 5.5;
      this.onGround = false;
      g.audio.jump?.();
    }

    // Swept city collision (prevents tunneling and wall-clipping at all speeds/framerates)
    const nx = this.x + this.vx * dt;
    const nz = this.z + this.vz * dt;
    const sweep = sweepCircleCity(this.x, this.z, nx, nz, PLAYER_R, this.y, city, {
      skipRiver: true,
      checkPiers: this.swimming,
    });
    this.x = sweep.x;
    this.z = sweep.z;
    if (sweep.hit) {
      const vn = this.vx * sweep.nx + this.vz * sweep.nz;
      if (vn < 0) {
        this.vx -= vn * sweep.nx;
        this.vz -= vn * sweep.nz;
      }
    }

    // Keep swimmer inside river banks unless climbing out
    if (this.swimming) {
      const z0 = rc(RIVER_ROW) + ROAD / 2 + 0.55;
      const z1 = rc(RIVER_ROW + 1) - ROAD / 2 - 0.55;
      this.z = clamp(this.z, z0, z1);
    }

    const lim = CITY.HALF - 1.2;
    this.x = clamp(this.x, -lim, lim);
    this.z = clamp(this.z, -lim, lim);

    // ---- Vertical physics: ground, water entry, buoyancy
    const water = this.inRiver(this.x, this.z);
    const swimSurfaceY = WATER_Y - 1.22;
    const ground = water ? swimSurfaceY : city.groundHeight(this.x, this.z);

    if (this.diveTimer > 0) this.diveTimer = Math.max(0, this.diveTimer - dt);

    if (water && this.swimming) {
      // Buoyant surface floating with gentle wave/dive recovery
      const targetY = swimSurfaceY - this.diveTimer * 0.65 + Math.sin(g.time * 2.8) * 0.04;
      this.y = damp(this.y, targetY, 6, dt);
      this.vy = 0;
      this.onGround = true;
    } else {
      this.vy -= 16 * dt;
      this.y += this.vy * dt;
      if (this.y <= ground) {
        if (water && !this.swimming) {
          // Splash into river with brief dive immersion!
          g.effects.splash(this.x, this.z, WATER_Y + 0.1);
          g.effects.splash(this.x + 0.3, this.z - 0.2, WATER_Y + 0.1);
          g.audio.splash?.();
          this.diveTimer = Math.min(0.65, Math.abs(this.vy) * 0.08);
          this.swimming = true;
        }
        this.y = ground;
        this.vy = 0;
        this.onGround = true;
      } else if (this.y > ground + 0.06) {
        this.onGround = false;
      }
    }

    this.swimming = water && this.y < WATER_Y - 0.2;

    // Swimming animation timing & realistic alternating arm-stroke splashes
    const targetBlend = this.swimming && this.speed > 0.65 ? 1 : 0;
    this.swimBlend = damp(this.swimBlend || 0, targetBlend, 5.5, dt);
    if (this.swimming) {
      const cadence = this.speed > 0.65 ? (3.2 + this.speed * 0.55) : 2.2;
      this.swimPhase = (this.swimPhase || 0) + dt * cadence;
      this.strokeT = (this.strokeT || 0) - dt;
      if (this.strokeT <= 0 && this.speed > 0.65) {
        this.strokeT = Math.PI / cadence; // one splash per alternating arm stroke
        const s = Math.sin(this.heading), c = Math.cos(this.heading);
        const side = (this.strokeSide = -(this.strokeSide || 1));
        g.effects.splash(this.x + s * 0.85 - c * side * 0.38, this.z + c * 0.85 + s * side * 0.38, WATER_Y + 0.08);
        g.audio.footstep?.(0.06, 'water');
      }
      if (this.speed <= 0.65 && Math.random() < dt * 1.4) {
        g.effects.splash(this.x + (Math.random() - 0.5) * 0.4, this.z + (Math.random() - 0.5) * 0.4, WATER_Y + 0.05);
      }
    }

    // ---- Solid vehicle collisions (prevents walking through parked/slow cars AND handles impacts)
    for (const v of g.vehicles) {
      if (!!v.boat !== this.swimming) continue;
      if (this.y > (v.y || 0) + 1.8) continue;
      const hit = resolveCircleVehicle(this.x, this.z, PLAYER_R, v);
      if (!hit) continue;
      const sp = v.speed;
      // Check relative approach speed so backing into a slow car doesn't kill you,
      // while a moving vehicle hitting you applies realistic knockback
      const relApproach = (v.vx - this.vx) * hit.nx + (v.vz - this.vz) * hit.nz;
      if (sp > 6 && relApproach > 3.5) {
        const dmg = g.powerTimers.shield > 0 ? 0 : sp * (v.copType === 'tank' ? 3 : 1.25);
        this.damage(dmg);
        g.shake = Math.min(1.2, g.shake + 0.5);
        g.ui.flash('hit');
        g.audio.thud?.();
        // Push out of vehicle first, then apply knockback (which sweeps against buildings!)
        this.x += hit.nx * (hit.pen + 0.15);
        this.z += hit.nz * (hit.pen + 0.15);
        const safe = resolveCircleCity(this.x, this.z, PLAYER_R, this.y, city, { skipRiver: true, checkPiers: this.swimming });
        this.x = safe.x; this.z = safe.z;
        this.knock(v.vx + hit.nx * 5, v.vz + hit.nz * 5);
        break;
      } else {
        // Hard OBB push-out so player can NEVER walk through parked or slow vehicles!
        this.x += hit.nx * hit.pen;
        this.z += hit.nz * hit.pen;
        const vn = this.vx * hit.nx + this.vz * hit.nz;
        if (vn < 0) {
          this.vx -= vn * hit.nx;
          this.vz -= vn * hit.nz;
        }
        // Re-enforce city boundaries so a moving vehicle can never crush player through a wall
        const safe = resolveCircleCity(this.x, this.z, PLAYER_R, this.y, city, { skipRiver: true, checkPiers: this.swimming });
        this.x = safe.x; this.z = safe.z;
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
    p.swimPhase = this.swimPhase || 0;
    p.climbing = this.state === 'climb';
    p.firing = this.firing > 0;
    p.aiming = this.aimYaw !== null;
    p.combatPose = this.game.combat?.weapon ? true : false;
    p.air = !this.onGround && !this.swimming;
  }
}
