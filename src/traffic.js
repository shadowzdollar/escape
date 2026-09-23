// Civilian traffic: lane following on the road graph, simple car-following.
import { Vehicle } from './vehicle.js';
import { TRAFFIC_MODELS, TRAFFIC_COLORS, CITY } from './config.js';
import { clamp, wrapAngle, pick } from './utils.js';

const LANE = 4.0;
const { CELL } = CITY;

const TRAFFIC_STATS = {
  hatch: { speed: 22, accel: 12, handling: 2.2, grip: 8, hp: 60, mass: 0.9 },
  sedan: { speed: 22, accel: 12, handling: 2.2, grip: 8, hp: 70, mass: 1.0 },
  taxi: { speed: 24, accel: 13, handling: 2.2, grip: 8, hp: 70, mass: 1.0 },
  van: { speed: 19, accel: 10, handling: 2.0, grip: 8, hp: 100, mass: 1.5 },
  truck: { speed: 21, accel: 11, handling: 2.0, grip: 8, hp: 110, mass: 1.7 },
};

export class Traffic {
  constructor(game) {
    this.game = game;
    this.cars = [];
    this.target = 26;
    this.timer = 0;
  }

  reset() {
    for (const c of this.cars) this.remove(c, false);
    this.cars = [];
  }

  remove(c, splice = true) {
    this.game.scene.remove(c.root);
    c.car.dispose();
    this.game.vehicles.delete(c);
    if (splice) this.cars.splice(this.cars.indexOf(c), 1);
  }

  spawn(minD, maxD) {
    const g = this.game, city = g.city;
    const cx = g.focus.x, cz = g.focus.z;
    const spot = city.randomRoadSpot(Math.random, cx, cz, minD, maxD);
    if (!spot) return;
    // work out which segment we are on and travel toward one of its ends
    const from = city.nearestNode(spot.x - Math.sin(spot.heading) * CELL * 0.5, spot.z - Math.cos(spot.heading) * CELL * 0.5);
    const fp = city.nodePos(from);
    const dx = Math.round(Math.sin(spot.heading)), dz = Math.round(Math.cos(spot.heading));
    const to = city.nearestNode(fp.x + dx * CELL, fp.z + dz * CELL);
    if (to === from || !city.adj[from].includes(to)) return;
    const rx = -dz, rz = dx;
    const x = spot.x + rx * LANE, z = spot.z + rz * LANE;
    for (const v of g.vehicles) if (Math.hypot(v.x - x, v.z - z) < 9) return;
    const model = pick(Math.random, TRAFFIC_MODELS);
    const color = model === 'taxi' ? '#ffc300' : pick(Math.random, TRAFFIC_COLORS);
    const v = new Vehicle({ model, stats: TRAFFIC_STATS[model], color, kind: 'traffic' });
    v.place(x, z, spot.heading);
    v.ai = { from, to, next: -1, cruise: 12 + Math.random() * 5, crashed: 0 };
    const sp = v.ai.cruise * 0.8;
    v.vx = Math.sin(spot.heading) * sp; v.vz = Math.cos(spot.heading) * sp;
    v.car.beam.visible = g.isNight;
    g.scene.add(v.root);
    g.vehicles.add(v);
    this.cars.push(v);
  }

  think(v, dt) {
    const g = this.game, city = g.city, ai = v.ai, inp = v.input;
    if (!v.alive || ai.crashed > 0) {
      ai.crashed -= dt;
      inp.throttle = 0; inp.brake = 1; inp.steer = 0;
      if (ai.crashed <= 0 && v.alive) this.relane(v);
      return;
    }
    const a = city.nodePos(ai.from), b = city.nodePos(ai.to);
    const dx = Math.sign(b.x - a.x), dz = Math.sign(b.z - a.z);
    const rx = -dz, rz = dx;
    const s = (v.x - a.x) * dx + (v.z - a.z) * dz;
    if (ai.next < 0 && s > CELL - 22) {
      const opts = city.adj[ai.to].filter((n) => n !== ai.from);
      if (opts.length) {
        const straight = opts.find((n) => { const p = city.nodePos(n); return Math.sign(p.x - b.x) === dx && Math.sign(p.z - b.z) === dz; });
        ai.next = straight !== undefined && Math.random() < 0.55 ? straight : pick(Math.random, opts);
      } else ai.next = ai.from;
    }
    let tx, tz;
    const look = 7;
    let turning = false;
    if (ai.next >= 0 && s + look > CELL - 2) {
      const n = city.nodePos(ai.next);
      const ndx = Math.sign(n.x - b.x), ndz = Math.sign(n.z - b.z);
      turning = ndx !== dx || ndz !== dz;
      const over = s + look - CELL + (turning ? 3 : 0);
      tx = b.x + ndx * Math.max(0, over) + (-ndz) * LANE;
      tz = b.z + ndz * Math.max(0, over) + (ndx) * LANE;
      if (s > CELL - LANE - 1.5 || (turning && s > CELL - 6)) {
        ai.from = ai.to; ai.to = ai.next; ai.next = -1;
      }
    } else {
      tx = a.x + dx * (s + look) + rx * LANE;
      tz = a.z + dz * (s + look) + rz * LANE;
    }
    const desired = Math.atan2(tx - v.x, tz - v.z);
    const err = wrapAngle(desired - v.heading);
    inp.steer = clamp(-err * 2.2, -1, 1);
    let want = turning && s > CELL - 30 ? 8 : ai.cruise;
    // follow: slow for anything in front of us
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    for (const o of g.vehicles) {
      if (o === v) continue;
      const ox = o.x - v.x, oz = o.z - v.z;
      const ahead = ox * fx + oz * fz;
      if (ahead <= 0 || ahead > 16) continue;
      const side = Math.abs(ox * fz - oz * fx);
      if (side > 2.6) continue;
      want = Math.min(want, Math.max(0, (ahead - 6) * 1.2));
    }
    const sp = v.vF;
    inp.throttle = sp < want - 0.5 ? 0.8 : 0;
    inp.brake = sp > want + 1.5 ? clamp((sp - want) / 6, 0.2, 1) : 0;
    inp.handbrake = false;
    // lost the lane (e.g. pushed around): re-acquire
    const lat = Math.abs((v.x - a.x) * rx + (v.z - a.z) * rz - LANE);
    if (lat > 9 || s < -12 || s > CELL + 12) this.relane(v);
  }

  relane(v) {
    const city = this.game.city;
    const id = city.nearestNode(v.x, v.z);
    const nb = city.adj[id];
    // choose the neighbor most aligned with our heading
    let best = nb[0], bd = -2;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    for (const n of nb) {
      const p = city.nodePos(n), c = city.nodePos(id);
      const dx = Math.sign(p.x - c.x), dz = Math.sign(p.z - c.z);
      const d = dx * fx + dz * fz;
      if (d > bd) { bd = d; best = n; }
    }
    v.ai.from = id; v.ai.to = best; v.ai.next = -1;
  }

  onHit(v, impact) {
    if (impact > 5) v.ai.crashed = 3 + Math.random() * 3;
  }

  update(dt) {
    const g = this.game;
    const fx = g.focus.x, fz = g.focus.z;
    this.timer -= dt;
    if (this.timer <= 0 && this.cars.length < this.target) {
      this.timer = 0.25;
      this.spawn(g.state === 'playing' ? 85 : 60, 210);
    }
    for (let k = this.cars.length - 1; k >= 0; k--) {
      const c = this.cars[k];
      const d = Math.hypot(c.x - fx, c.z - fz);
      if (d > 270) { this.remove(c); continue; }
      this.think(c, dt);
      if (!c.alive && Math.random() < dt * 10) g.effects.damageSmoke(c.x, c.y + 1, c.z, true);
    }
  }
}
