// Story mission engine. A mission is a long chain of objective "steps"; every step is
// a checkpoint. Steps set the police response themselves (no wanted stars in story
// mode), spawn their own targets, guards, gangs and vehicles, and play dialogue.
//
// Step types: reach, collect, survive, evade, wreck, heli, kill, takedown, tail, steal,
// deliver, hold, clear, race, plant, scout, meet, talk.
import * as THREE from 'three';
import { WANTED, CITY, CARS, COP_TYPES } from '../config.js';
import { Vehicle } from '../vehicle.js';
import { createTank } from '../tankModel.js';
import { WATER_Y } from '../boats.js';
import { clamp, wrapAngle } from '../utils.js';
import { speaker } from './characters.js';

const R = Math.random;
export const THREAT_NAMES = ['LOW PROFILE', 'NOTICED', 'PURSUIT', 'MANHUNT', 'SWAT RESPONSE', 'ARMY', 'AIR STRIKE'];
const MARK = { go: 0x3cff7a, cash: 0xffd23c, target: 0xff3b3b, contact: 0x4da3ff, plant: 0xc56bff, boat: 0x35f2ff, car: 0xffffff, zone: 0xff9f1c };
const ON_FOOT_TYPES = ['park', 'plaza', 'parking'];
const GANG_RIGS = ['punk', 'punk2', 'hoodie'];

export class StoryRun {
  constructor(game, def, startStep = 0) {
    this.game = game;
    // private copy: steps can be inserted at runtime (a blown tail becomes a chase)
    this.def = { ...def, steps: def.steps.map((s, i) => ({ ...s, _i: i })) };
    this.diff = def.diff ?? 0.3;
    this.idx = Math.min(startStep, def.steps.length - 1);
    this.lastIdx = -1;
    this.t = 0;
    this.stepT = 0;
    this.done = false;
    this.failed = false;
    this.markers = [];
    this.persons = [];      // mission-spawned people (targets, guards, gangs, contacts)
    this.ownVehicles = [];  // mission-spawned vehicles
    this.queue = [];        // dialogue lines waiting
    this.line = null;       // line on screen
    this.timers = [];
    this.threat = -1;
    this.vehicle = null;    // the mission's vehicle (stolen / delivered)
    this.lastPos = null;    // where the previous step ended (tail destination, …)
    this.applyLoadout();
    if (def.vehicle && this.idx === 0) this.provide(def.vehicle);
    this.begin();
  }

  get step() { return this.def.steps[this.idx]; }
  // checkpoint = the authored index of the current step (retry restarts it)
  get checkpoint() { return this.step?._i ?? this.idx; }
  setLast(x, z) { this.lastPos = { x, z }; this.lastIdx = this.idx; }

  // ================================================================ setup helpers
  applyLoadout() {
    const g = this.game, c = g.combat, L = this.def.loadout || {};
    c.ammo.smg = Math.max(c.ammo.smg, L.smg || 0);
    c.ammo.rpg = Math.max(c.ammo.rpg, L.rpg || 0);
    if (L.carGuns) c.carGuns = L.carGuns;
    if (L.carRockets) c.carRockets = L.carRockets;
  }

  // Difficulty multipliers (also read by police / combat / people through game.storyDiff).
  dm(kind) {
    const d = this.diff;
    return { hp: 0.8 + d * 1.3, dmg: 0.6 + d * 0.9, count: 0.75 + d * 0.8, speed: 0.85 + d * 0.25, time: 1.25 - d * 0.35, sense: 0.85 + d * 0.5 }[kind] ?? 1;
  }

  // Resolve a place spec to a world position.
  place(spec = {}, from = null) {
    const g = this.game, city = g.city, p = from || g.player;
    const [lo, hi] = spec.near || (spec.far ? [520, 900] : [260, 480]);
    if (spec.home && city.bank) return { x: city.bank.carX + 8, z: city.bank.carZ, heading: 0 };
    if (spec.bank && city.bank) return { x: city.bank.stepX, z: city.bank.doorZ, heading: 0 };
    if (spec.airstrip && city.airstrip) return { ...city.airstrip, heading: 0 };
    if (spec.landmark && city.landmarks?.length) {
      const l = city.landmarks.find((m) => m.kind === spec.landmark) || city.landmarks[0];
      const s = city.randomRoadSpot(R, l.x, l.z, 30, 90);
      if (s) return s;
    }
    if (spec.last && this.lastPos) return { ...this.lastPos };
    if (spec.river) {
      const B = g.boats;
      const dir = R() < 0.5 ? -1 : 1;
      let x = p.x + dir * (lo + R() * (hi - lo));
      if (Math.abs(x) > CITY.HALF + 100) x = p.x - dir * (lo + R() * (hi - lo));
      x = clamp(x, -CITY.HALF - 80, CITY.HALF + 80);
      for (let k = 0; k < 20 && B.underBridge(x); k++) x += 8;
      return { x, z: (B.z0 + B.z1) / 2 + (R() - 0.5) * 8, heading: dir > 0 ? Math.PI / 2 : -Math.PI / 2, water: true };
    }
    if (spec.block) {
      const types = Array.isArray(spec.block) ? spec.block : [spec.block];
      const b = this.pickBlock(types, p, lo, hi);
      if (b) return spec.road ? this.blockRoad(b) : this.blockSpot(b);
    }
    for (let k = 0; k < 40; k++) {
      const s = city.randomRoadSpot(R, p.x, p.z, lo * (1 - k * 0.02), hi * (1 + k * 0.03));
      if (s) return s;
    }
    return { x: -p.x * 0.5, z: -p.z * 0.5, heading: 0 };
  }

  pickBlock(types, p, lo, hi) {
    const blocks = this.game.city.blocks;
    let list = blocks.filter((b) => types.includes(b.type));
    if (!list.length) list = blocks.filter((b) => ['park', 'plaza', 'midtown', 'suburb', 'downtown'].includes(b.type));
    const dist = (b) => Math.hypot((b.x0 + b.x1) / 2 - p.x, (b.z0 + b.z1) / 2 - p.z);
    const inRange = list.filter((b) => { const d = dist(b); return d >= lo && d <= hi; });
    if (inRange.length) return inRange[Math.floor(R() * inRange.length)];
    // closest to the wanted band
    return list.sort((a, b) => Math.abs(dist(a) - (lo + hi) / 2) - Math.abs(dist(b) - (lo + hi) / 2))[0];
  }

  // An open, walkable spot in a block: park / plaza interiors, otherwise the sidewalk.
  blockSpot(b) {
    const city = this.game.city;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    if (ON_FOOT_TYPES.includes(b.type)) {
      for (let k = 0; k < 20; k++) {
        const x = cx + (R() - 0.5) * 30, z = cz + (R() - 0.5) * 30;
        if (Math.hypot(x - cx, z - cz) > 9 && !city.pointBlocked(x, z, 1.5)) return { x, z, heading: R() * 6.28, b };
      }
    }
    const side = Math.floor(R() * 4), t = 0.3 + R() * 0.4;
    const pts = [
      { x: b.x0 + (b.x1 - b.x0) * t, z: b.z0 + 1.6 }, { x: b.x0 + (b.x1 - b.x0) * t, z: b.z1 - 1.6 },
      { x: b.x0 + 1.6, z: b.z0 + (b.z1 - b.z0) * t }, { x: b.x1 - 1.6, z: b.z0 + (b.z1 - b.z0) * t },
    ];
    for (let k = 0; k < 4; k++) {
      const q = pts[(side + k) % 4];
      if (!city.pointBlocked(q.x, q.z, 0.6)) return { ...q, heading: 0, b };
    }
    return { ...pts[side], heading: 0, b };
  }

  // A road point right next to a block (for vehicles).
  blockRoad(b) {
    const city = this.game.city;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const s = city.randomRoadSpot(R, cx, cz, 20, 60);
    return s || { x: b.x0 - CITY.ROAD / 2, z: cz, heading: 0 };
  }

  // ================================================================ markers
  marker(x, z, kind = 'go', follow = null, radius = 4) {
    const g = this.game, color = MARK[kind] ?? MARK.go;
    const grp = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, kind === 'target' ? 14 : 60, 16, 1, true), new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: kind === 'target' ? 0.3 : 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    beam.position.y = kind === 'target' ? 9 : 30;
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.8, radius, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    ring.position.y = 0.14;
    grp.add(beam, ring);
    if (kind === 'cash') {
      const bag = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 0.8, emissive: 0x113311 }));
      bag.position.y = 1.4; bag.scale.set(1, 1.2, 0.9);
      grp.add(bag); grp.userData.spin = bag;
    }
    grp.position.set(x, 0, z);
    g.scene.add(grp);
    const m = { x, z, kind, grp, ring, follow };
    this.markers.push(m);
    return m;
  }

  unmark(m) {
    if (!m) return;
    this.game.scene.remove(m.grp);
    m.grp.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    const i = this.markers.indexOf(m);
    if (i >= 0) this.markers.splice(i, 1);
  }

  clearMarkers() { for (const m of [...this.markers]) this.unmark(m); }

  target() {
    const p = this.game.player;
    let best = null, bd = Infinity;
    for (const m of this.markers) {
      if (m.hidden) continue;
      const d = Math.hypot(m.x - p.x, m.z - p.z);
      if (d < bd) { bd = d; best = m; }
    }
    return best ? { ...best, d: bd } : null;
  }

  // ================================================================ spawning
  person(x, z, opts = {}) {
    const g = this.game;
    const p = g.people.make(x, z, { mission: true, mode: 'sentry', heading: R() * 6.28, path: [], ...opts });
    p.y = g.city.groundHeight(x, z);
    p.guardHeading = p.heading;
    this.persons.push(p);
    return p;
  }

  // Armed enemy that fights right away (gang members, security teams).
  enemy(x, z, rig = null, extra = {}) {
    return this.person(x, z, {
      mode: 'copFoot', copFoot: true, hostile: true, armed: true, noArrest: true,
      rigKind: rig || GANG_RIGS[Math.floor(R() * GANG_RIGS.length)], outfit: 'dark',
      hp: 40 * this.dm('hp'), shootCool: 1 + R() * 1.5, height: 1.72 + R() * 0.14, ...extra,
    });
  }

  // Guard standing watch until they notice you.
  sentry(x, z, rig = 'swat', extra = {}) {
    return this.person(x, z, {
      mode: 'sentry', sentry: true, hostile: true, armed: true, noArrest: true, rigKind: rig,
      hp: 45 * this.dm('hp'), sus: 0, height: 1.75 + R() * 0.12, ...extra,
    });
  }

  ring(cx, cz, n, r0, r1, fn) {
    const city = this.game.city, out = [];
    for (let k = 0, tries = 0; out.length < n && tries < n * 12; tries++, k++) {
      const a = (k / n) * Math.PI * 2 + R() * 0.6, r = r0 + R() * (r1 - r0);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (city.pointBlocked(x, z, 0.7)) continue;
      out.push(fn(x, z, a));
    }
    return out;
  }

  releasePerson(p) {
    p.mission = false;
    if (p.mode === 'sentry') { p.sentry = false; p.mode = 'walk'; p.path = []; this.game.people.recover(p); }
  }

  // Vehicle from a spec: { car: CARS id } | { model, color, hp, speed } | { boat: kind } | { cop: type } | { tank: true }
  makeVehicle(spec, x, z, heading, kind = 'mission') {
    const g = this.game;
    if (spec.boat) {
      const v = g.boats.make(spec.boat, x, z, heading, kind);
      v.docked = kind === 'empty';
      this.ownVehicles.push(v);
      return v;
    }
    let v;
    if (spec.car) {
      const def = CARS.find((c) => c.id === spec.car) || CARS[0];
      v = new Vehicle({ model: def.model, stats: def.stats, color: def.color, accent: def.accent, kind, car: def.model === 'tank' ? createTank() : null });
      if (def.weapons) g.armVehicle(v, def);
      v.owned = true;
    } else if (spec.cop || spec.tank) {
      const type = spec.tank ? 'tank' : spec.cop;
      const t = COP_TYPES[type];
      v = new Vehicle({ model: t.model, stats: t, kind, livery: t.livery, car: type === 'tank' ? createTank() : null, color: '#101828' });
      v.copType = type === 'tank' ? 'tank' : null;
      if (type === 'tank') g.armVehicle(v, { model: 'tank', weapons: ['cannon', 'mg'] });
    } else {
      const base = { speed: 44, accel: 26, handling: 2.7, grip: 7.2, hp: 160, mass: 1.4 };
      const stats = { ...base, ...(spec.stats || {}) };
      if (spec.hp) stats.hp = spec.hp;
      if (spec.speed) stats.speed = spec.speed;
      v = new Vehicle({ model: spec.model || 'sedan', stats, color: spec.color || '#1b1b1b', kind, livery: spec.livery || null });
    }
    v.place(x, z, heading);
    v.car.beam.visible = g.isNight;
    v.car.root.traverse((o) => { if (o.isMesh && o !== v.car.shadow && o !== v.car.beam) o.castShadow = true; });
    g.scene.add(v.root);
    g.vehicles.add(v);
    v.input = { throttle: 0, brake: 1, steer: 0, handbrake: false, nitro: false, hold: true };
    this.ownVehicles.push(v);
    return v;
  }

  // Put the player in a mission vehicle (start vehicle / checkpoint retry).
  provide(spec) {
    const g = this.game, p = g.player;
    let x = p.x, z = p.z, h = p.heading || 0;
    if (spec.boat) {
      const B = g.boats;
      x = clamp(p.x, -CITY.HALF * 0.8, CITY.HALF * 0.8);
      for (let k = 0; k < 20 && B.underBridge(x); k++) x += 8;
      z = (B.z0 + B.z1) / 2; h = Math.PI / 2;
    } else {
      const s = g.city.randomRoadSpot(R, p.x, p.z, 0, 40);
      if (s) { x = s.x; z = s.z; h = s.heading; }
    }
    const v = this.makeVehicle(spec, x, z, h, 'empty');
    if (g.car) { const old = g.car; g.exitCar(true); old.vx = old.vz = 0; }
    g.doorAnim = null;
    g.avatar.state = 'foot';
    g.commitEnter(v);
    v.y = spec.boat ? WATER_Y : 0;
    this.vehicle = v;
    this.vehicleSpec = spec;
    return v;
  }

  // ================================================================ driving AI for mission vehicles
  drive(v, dt, dest, maxSpeed) {
    const city = this.game.city, inp = v.input;
    const ai = v.sai || (v.sai = { path: [], repath: 0, stuck: 0, rev: 0 });
    inp.hold = false; inp.nitro = false; inp.handbrake = false;
    if (!v.alive) { inp.throttle = 0; inp.brake = 1; inp.steer = 0; return; }
    if (v.boat) { this.steerTo(v, dest.x, dest.z, maxSpeed, dt); return; }
    ai.repath -= dt;
    if (ai.repath <= 0) {
      ai.repath = 2.5;
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      const from = city.nearestNode(v.x + fx * 18, v.z + fz * 18), to = city.nearestNode(dest.x, dest.z);
      ai.path = from === to ? [] : [from, ...city.findPath(from, to)];
    }
    let tx = dest.x, tz = dest.z;
    while (ai.path.length) {
      const n = city.nodePos(ai.path[0]);
      const dx = n.x - v.x, dz = n.z - v.z, d = Math.hypot(dx, dz);
      if (d < 12) { ai.path.shift(); continue; }
      tx = n.x + (-dz / d) * 3.6; tz = n.z + (dx / d) * 3.6; // keep right
      break;
    }
    this.steerTo(v, tx, tz, maxSpeed, dt);
  }

  steerTo(v, tx, tz, maxSpeed, dt) {
    const city = this.game.city, inp = v.input, ai = v.sai || (v.sai = { path: [], repath: 0, stuck: 0, rev: 0 });
    const err = wrapAngle(Math.atan2(tx - v.x, tz - v.z) - v.heading);
    if (ai.rev > 0) { ai.rev -= dt; inp.throttle = 0; inp.brake = 1; inp.steer = clamp(err * 2, -1, 1); return; }
    let steer = clamp(-err * 2.4, -1, 1);
    const look = 6 + v.speed * 0.35;
    if (!v.boat) for (const side of [-0.42, 0.42]) {
      const a = v.heading + side;
      if (city.pointBlocked(v.x + Math.sin(a) * look, v.z + Math.cos(a) * look, 0.6)) steer += side > 0 ? 0.8 : -0.8;
    }
    let want = maxSpeed;
    if (Math.abs(err) > 0.5) want = Math.min(want, 13);
    if (Math.abs(err) > 1.2) want = Math.min(want, 7);
    const sp = v.vF;
    inp.steer = clamp(steer, -1, 1);
    inp.throttle = sp < want - 0.5 ? 1 : 0;
    inp.brake = sp > want + 2 ? clamp((sp - want) / 8, 0.2, 1) : 0;
    if (inp.throttle > 0.5 && v.speed < 1.5) { ai.stuck += dt; if (ai.stuck > 1.2) { ai.rev = 1.0; ai.stuck = 0; } } else ai.stuck = Math.max(0, ai.stuck - dt);
  }

  fleeDest(v) {
    const g = this.game, p = g.player, city = g.city;
    if (v.boat) {
      // boats flee along the river, away from the player
      const dir = Math.sign(v.x - p.x) || 1;
      const x = clamp(v.x + dir * (250 + R() * 250), -CITY.HALF - 90, CITY.HALF + 90);
      return { x: Math.abs(x - v.x) < 60 ? v.x - dir * 300 : x, z: (g.boats.z0 + g.boats.z1) / 2 };
    }
    for (let k = 0; k < 25; k++) {
      const s = city.randomRoadSpot(R, v.x, v.z, 300, 650);
      if (s && (s.x - p.x) * (v.x - p.x) + (s.z - p.z) * (v.z - p.z) > 0) return s;
    }
    return city.randomRoadSpot(R, v.x, v.z, 250, 700) || { x: -p.x, z: -p.z };
  }

  // ================================================================ dialogue
  say(lines) {
    if (!lines) return;
    for (const l of lines) {
      const [who, text] = l;
      this.queue.push({ who, text, dur: 1.8 + text.length * 0.052 });
    }
  }

  updateDialogue(dt) {
    if (this.line) {
      this.line.t += dt;
      if (this.line.t >= this.line.dur) this.line = null;
    }
    if (!this.line && this.queue.length) {
      this.line = { ...this.queue.shift(), t: 0 };
      const s = speaker(this.line.who);
      if (this.game.save.settings.voice !== false) this.game.audio.say?.(this.line.text, s.voice);
    }
  }

  subtitle() {
    if (!this.line) return null;
    const s = speaker(this.line.who);
    return { name: s.name, color: s.color, text: this.line.text, t: this.line.t, dur: this.line.dur };
  }

  get talking() { return !!this.line || this.queue.length > 0; }

  // ================================================================ police response
  setThreat(thr, announce = true) {
    const g = this.game;
    if (thr === this.threat) return;
    const up = thr > this.threat;
    this.threat = thr;
    if (thr < 0) {
      g.heat = 0;
      g.police.suppress = true;
      g.police.blind = true;
      g.police.lastKnown = { x: g.player.x + 900, z: g.player.z + 900, vx: 0, vz: 0, speed: 0 };
    } else {
      g.police.suppress = false;
      g.police.blind = false;
      g.heat = WANTED[thr].heat + 1;
      if (announce && up) g.ui.toast(`POLICE: ${THREAT_NAMES[thr]}`, thr >= 4 ? 'bad' : 'warn');
    }
  }

  // Called by the game every frame: keep the heat inside the step's band.
  capHeat() {
    const g = this.game, thr = this.threat;
    if (thr < 0) { g.heat = 0; return; }
    const lo = WANTED[thr].heat, hi = WANTED[thr + 1]?.heat ?? lo + 200;
    g.heat = clamp(g.heat, lo, hi - 1);
  }

  // ================================================================ lifecycle
  begin() {
    const g = this.game, s = this.step;
    this.stepT = 0;
    this.st = {};
    this.clearMarkers();
    if (!s) return;
    this.setThreat(s.threat ?? this.def.threat ?? -1);
    g.police.suppress = this.threat < 0 || !!s.noPolice;
    if (s.need && !(g.car && (s.need.boat ? g.car.boat : true))) this.provide(s.need);
    const T = TYPES[s.t];
    T.begin.call(this, s, this.st);
    this.say(s.say);
    if (s.label) g.ui.toast(s.label, 'warn');
    g.audio.levelUp?.();
    g.ui.storyStep?.(this);
  }

  complete() {
    const g = this.game, s = this.step;
    const T = TYPES[s.t];
    T.end?.call(this, s, this.st);
    this.say(s.end);
    if (this.lastIdx !== this.idx) this.setLast(g.player.x, g.player.z);
    for (const p of this.persons) {
      if (!p.mission) continue;
      if (p.dead) p.mission = false;
      else if (p.mode === 'sentry' || p.contact) this.releasePerson(p);
    }
    this.idx++;
    if (this.idx >= this.def.steps.length) {
      this.done = true;
      this.clearMarkers();
      this.setThreat(-1, false);
      // let the last lines play out on the results screen
      g.missionComplete();
    } else this.begin();
  }

  fail(reason) {
    if (this.failed || this.done) return;
    this.failed = true;
    this.game.missionFailed?.(reason);
  }

  update(dt) {
    const g = this.game;
    this.updateDialogue(dt);
    if (this.done || this.failed) return;
    this.t += dt;
    this.stepT += dt;
    g.storyDiff = this.diff;
    for (const m of this.markers) {
      if (m.follow) { m.x = m.follow.x; m.z = m.follow.z; m.grp.position.set(m.x, m.follow.y || 0, m.z); }
      m.ring.rotation.y += dt;
      if (m.grp.userData.spin) m.grp.userData.spin.rotation.y += dt * 2;
      m.ring.material.opacity = 0.55 + Math.sin(this.t * 5) * 0.25;
    }
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); }
    }
    this.updateSentries(dt);
    const s = this.step;
    if (s.time && this.stepT > s.time * this.dm('time')) { this.fail(s.timeFail || 'Out of time.'); return; }
    const r = TYPES[s.t].update.call(this, s, this.st, dt);
    if (r === true) this.complete();
    else if (typeof r === 'string') this.fail(r);
  }

  // Guards: build suspicion when they can see you; alert everyone at full.
  updateSentries(dt) {
    const g = this.game, p = g.player, city = g.city;
    const foot = !g.car;
    const grace = this.stepT < 5; // a moment to take in the scene when a step starts
    for (const q of this.persons) {
      if (!q.sentry || q.dead) continue;
      if (q.mode !== 'sentry') {
        // knocked down / disturbed: it's a fight now
        if (q.mode !== 'down' && q.mode !== 'getup') this.alert(q);
        continue;
      }
      const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz);
      const range = (foot ? 13 : 24) * this.dm('sense') * (g.isNight ? 0.75 : 1);
      let seen = false;
      if (d < range) {
        const off = Math.abs(wrapAngle(Math.atan2(dx, dz) - q.heading - (q.headScan || 0) * 0.6));
        seen = (off < 1.05 || d < 3.5) && !city.segmentBlocked(q.x, q.z, p.x, p.z, 0.3);
      }
      const sneak = foot && p.speed < 4 ? 0.55 : 1.25;
      if (seen && !grace) { q.sus += dt * sneak * (1.6 - d / range); q.look = p; q.lookT = 0.5; } else q.sus = Math.max(0, q.sus - dt * 0.25);
      if (q.sus >= 1) { this.alert(q); return; }
    }
  }

  // Raise the alarm: guards fight, the step reacts (strict stealth fails).
  alert(source = null) {
    if (this.st.alerted) {
      if (source && source.sentry && source.mode !== 'copFoot') this.toFight(source);
      return;
    }
    this.st.alerted = true;
    const g = this.game, s = this.step;
    for (const q of this.persons) if (q.sentry && !q.dead) this.toFight(q);
    g.ui.toast('YOU HAVE BEEN SPOTTED!', 'bad');
    g.audio.alarm?.(true);
    this.timers.push({ t: 2.5, fn: () => g.audio.alarm?.(false) });
    if (s.strict) { this.fail('You were spotted. The target got away.'); return; }
    if (s.alertThreat !== undefined) this.setThreat(Math.max(this.threat, s.alertThreat));
    TYPES[s.t].onAlert?.call(this, s, this.st);
  }

  toFight(q) {
    q.sentry = false;
    q.mode = 'copFoot'; q.copFoot = true; q.path = [];
    q.shootCool = 0.6 + R();
  }

  // The player fired a weapon at (x, z): nearby guards hear it.
  onNoise(x, z) {
    if (this.st?.alerted) return;
    for (const q of this.persons) {
      if (q.sentry && !q.dead && Math.hypot(q.x - x, q.z - z) < 45) { this.alert(q); return; }
    }
  }

  // F on foot next to a guard or target: silent takedown.
  consumeInteract() {
    const g = this.game;
    if (g.car || g.avatar.state !== 'foot') return false;
    const a = g.avatar;
    let best = null, bd = 2.1;
    for (const q of this.persons) {
      if (!q.hostile || q.dead) continue;
      const d = Math.hypot(q.x - a.x, q.z - a.z);
      if (d < bd) { bd = d; best = q; }
    }
    if (!best) return false;
    const silent = best.mode === 'sentry';
    best.hp = 0; best.dead = true;
    g.people.knock(best, Math.sin(a.heading) * 3, Math.cos(a.heading) * 3, 0.5);
    g.onOfficerDown?.(best);
    a.heading = Math.atan2(best.x - a.x, best.z - a.z);
    a.firing = 0.4;
    g.audio.noiseHit?.(300, 0.15, 0.5);
    g.ui.toast(silent ? 'SILENT TAKEDOWN' : 'TAKEDOWN', 'good');
    if (!silent) return true;
    // anyone watching closely raises the alarm
    for (const q of this.persons) if (q.sentry && !q.dead && Math.hypot(q.x - best.x, q.z - best.z) < 9 && q.sus > 0.3) { this.alert(q); break; }
    return true;
  }

  // A vehicle was destroyed (police or mission).
  onDestroyed(v) {
    const st = this.st;
    if (!st) return;
    st.wrecked = (st.wrecked || 0) + 1;
    if (v.kind === 'police' || v.copType) {
      const of = this.step?.of || 'any';
      if (of === 'any' || v.copType === of || (of === 'boat' && v.boat)) st.wrecks = (st.wrecks || 0) + 1;
    }
  }

  onHeliDown() { if (this.st) this.st.helis = (this.st.helis || 0) + 1; }

  // Extra things combat can aim at / hit.
  hostiles(out) {
    for (const p of this.persons) if (p.hostile && !p.dead && !p.copFoot) out.push({ kind: 'cop', ref: p, x: p.x, y: p.y + 1.2, z: p.z, r: 0.5 });
    for (const v of this.ownVehicles) if (v.hostile && v.alive && v !== this.game.car) out.push({ kind: 'car', ref: v, x: v.x, y: v.boat ? -1 : 1, z: v.z, r: v.L / 2 });
  }

  status() {
    const s = this.step;
    if (!s) return null;
    const T = TYPES[s.t];
    let prog = T.status?.call(this, s, this.st) || '';
    let clock = '';
    if (s.time) {
      const left = Math.max(0, s.time * this.dm('time') - this.stepT);
      clock = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    }
    const tg = this.target();
    if (!prog && tg) prog = `${Math.round(tg.d)} m`;
    return { label: s.label || '', prog, clock, step: `${this.idx + 1}/${this.def.steps.length}`, threat: this.threat < 0 ? '' : THREAT_NAMES[this.threat] };
  }

  minimapDots() {
    const out = [];
    for (const q of this.persons) if (q.sentry && !q.dead) out.push({ x: q.x, z: q.z, c: q.sus > 0.5 ? '#ffd23c' : '#ff7a3c' });
    return out;
  }

  dispose() {
    const g = this.game;
    this.clearMarkers();
    for (const tm of this.timers) tm.t = 1e9;
    this.timers = [];
    for (const v of this.ownVehicles) {
      if (v.root.parent) { g.scene.remove(v.root); v.car.dispose(); }
      g.vehicles.delete(v);
      const bi = g.boats.list.indexOf(v); if (bi >= 0) g.boats.list.splice(bi, 1);
    }
    this.ownVehicles = [];
    for (const p of this.persons) p.mission = false;
    this.persons = [];
    g.police.suppress = false;
    g.police.blind = false;
    g.storyDiff = undefined;
    g.audio.say?.('');
  }
}

// =================================================================== step types
const near = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const TYPES = {
  // -------------------------------------------------- go somewhere (on foot / car / boat / swim / with the mission car)
  reach: {
    begin(s, st) {
      const g = this.game;
      st.pt = this.place(s.at || {});
      st.m = this.marker(st.pt.x, st.pt.z, s.boat || s.swim || st.pt.water ? 'boat' : 'go', null, s.radius || 5);
      if (s.boat && !g.car?.boat) {
        const B = g.boats, p = g.player;
        let x = clamp(p.x, -CITY.HALF * 0.85, CITY.HALF * 0.85);
        for (let k = 0; k < 20 && B.underBridge(x); k++) x += 8;
        const z = p.z > (B.z0 + B.z1) / 2 ? B.z1 - 2.2 : B.z0 + 2.2;
        st.boat = this.makeVehicle({ boat: s.boatKind || 'speed' }, x, z, Math.PI / 2, 'empty');
        st.boatMark = this.marker(x, z, 'boat', st.boat, 3);
      }
    },
    update(s, st) {
      const g = this.game, p = g.player;
      if (st.boatMark && g.car?.boat) { this.unmark(st.boatMark); st.boatMark = null; }
      const d = near(p, st.pt);
      st.d = d;
      const r = s.radius || (st.pt.water ? 9 : 6);
      let ok = true;
      st.need = '';
      if (s.foot && g.car) { ok = false; st.need = 'GET OUT ON FOOT'; }
      if (s.boat && !g.car?.boat) { ok = false; st.need = 'GET A BOAT'; }
      if (s.swim && !(g.avatar.active && g.avatar.swimming)) { ok = false; st.need = 'SWIM THERE'; }
      if (s.car && !g.car) { ok = false; st.need = 'GET A CAR'; }
      if (d < r && ok) { this.setLast(st.pt.x, st.pt.z); return true; }
    },
    status(s, st) { return `${Math.round(st.d || 0)} m${st.need ? ' · ' + st.need : ''}`; },
  },

  // -------------------------------------------------- pick things up around the map
  collect: {
    begin(s, st) {
      const g = this.game, c = s.at ? this.place(s.at) : g.player;
      const [lo, hi] = s.spread || [90, 260];
      st.left = [];
      for (let k = 0; k < s.count; k++) {
        let pt = null;
        for (let t = 0; !pt && t < 30; t++) pt = g.city.randomRoadSpot(R, c.x, c.z, lo + k * 10, hi + k * 30);
        if (pt) st.left.push(this.marker(pt.x, pt.z, 'cash'));
      }
      st.got = 0;
    },
    update(s, st) {
      const g = this.game, p = g.player;
      for (const m of [...st.left]) {
        if (near(m, p) < 4.8) {
          this.unmark(m); st.left.splice(st.left.indexOf(m), 1); st.got++;
          g.audio.powerup(); g.effects.sparkle(m.x, 1.5, m.z, [0.4, 1, 0.4]);
          g.score += 250; g.runCoins += 8;
          g.ui.toast(`${s.item || 'PICKED UP'} ${st.got}/${s.count}`, 'good');
        }
      }
      return st.left.length === 0;
    },
    status(s, st) { const tg = this.target(); return `${st.got}/${s.count}${tg ? ` · next ${Math.round(tg.d)} m` : ''}`; },
  },

  survive: {
    begin() {},
    update(s) { return this.stepT >= s.secs; },
    status(s) { return `${Math.ceil(Math.max(0, s.secs - this.stepT))} s`; },
  },

  // -------------------------------------------------- lose the police (stay out of sight)
  evade: {
    begin(s, st) { st.hid = 0; },
    update(s, st, dt) {
      const g = this.game, p = g.player;
      let seen = false;
      for (const c of g.police.cops) {
        if (!c.alive) continue;
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < 40 || (d < 120 && !g.city.segmentBlocked(c.x, c.z, p.x, p.z, 1))) { seen = true; break; }
      }
      for (const o of g.people.list) if (o.copFoot && !o.dead && Math.hypot(o.x - p.x, o.z - p.z) < 30) { seen = true; break; }
      if (g.police.heli && !g.police.heli.falling && Math.hypot(g.police.heli.x - p.x, g.police.heli.z - p.z) < 60) seen = true;
      if (seen) { g.police.lastKnown = { x: p.x, z: p.z, vx: 0, vz: 0, kind: p.kind, speed: 0 }; st.hiddenT = 0; } else st.hiddenT = (st.hiddenT || 0) + dt;
      g.police.blind = st.hiddenT > 1;
      g.police.suppress = true;
      st.hid = seen ? 0 : st.hid + dt;
      if (st.hid >= s.secs) { g.police.blind = false; this.setThreat(-1, false); return true; }
    },
    status(s, st) { return st.hid > 0 ? `hidden ${st.hid.toFixed(1)} / ${s.secs} s` : 'they can see you'; },
  },

  // -------------------------------------------------- destroy police vehicles
  wreck: {
    begin(s, st) { st.wrecks = 0; st.need = Math.max(1, Math.round(s.count * this.dm('count'))); },
    update(s, st) { return st.wrecks >= st.need; },
    status(s, st) { return `${st.wrecks}/${st.need} ${s.of && s.of !== 'any' ? s.of.toUpperCase() + 'S' : 'VEHICLES'}`; },
  },

  // -------------------------------------------------- shoot helicopters down
  heli: {
    begin(s, st) {
      const g = this.game;
      st.helis = 0;
      st.need = s.count;
      for (let k = 0; k < (s.ships ?? s.count); k++) g.military.spawnGunship();
    },
    update(s, st) {
      const g = this.game;
      if (g.military.gunships.filter((h) => !h.falling).length === 0 && st.helis < st.need && !(g.police.heli && !g.police.heli.falling)) g.military.spawnGunship();
      return st.helis >= st.need;
    },
    status(s, st) { return `${st.helis}/${st.need} DOWN`; },
  },

  // -------------------------------------------------- assassinate a target (stealth optional)
  kill: {
    begin(s, st) {
      const pt = s.at?.last && this.lastPos ? this.lastPos : this.place(s.at || { block: ['park', 'plaza'] });
      st.pt = pt;
      const tgt = this.person(pt.x, pt.z, {
        target: true, hostile: true, sentry: !s.armed, mode: s.armed ? 'copFoot' : 'sentry', copFoot: !!s.armed, armed: !!s.armed, noArrest: true,
        rigKind: s.rig || 'business', hp: (s.hp || 70) * this.dm('hp'), priority: true, sus: 0, height: 1.8,
      });
      st.tgt = tgt;
      st.m = this.marker(pt.x, pt.z, 'target', tgt, 1.2);
      const n = Math.round((s.guards ?? 3) * this.dm('count'));
      this.ring(pt.x, pt.z, n, 4, 11, (x, z) => this.sentry(x, z, s.guardRig || 'swat', { heading: Math.atan2(x - pt.x, z - pt.z) }));
      if (s.patrol) tgt.patrol = [{ x: pt.x, z: pt.z }, { x: pt.x + (R() - 0.5) * 24, z: pt.z + (R() - 0.5) * 24 }];
    },
    onAlert(s, st) {
      if (s.flee && st.tgt && !st.tgt.dead && !st.car) {
        // the target runs for a getaway car
        const g = this.game, t = st.tgt;
        const spot = g.city.randomRoadSpot(R, t.x, t.z, 4, 40) || { x: t.x + 6, z: t.z, heading: 0 };
        st.car = this.makeVehicle({ model: s.carModel || 'sports', color: '#0b0b0b', hp: 150 * this.dm('hp'), speed: 40 * this.dm('speed') }, spot.x, spot.z, spot.heading);
        st.car.hostile = true;
        t.dead = true; t.mission = false;
        g.people.list.splice(g.people.list.indexOf(t), 1);
        g.people.detach(t);
        this.unmark(st.m);
        st.m = this.marker(st.car.x, st.car.z, 'target', st.car, 2);
        st.dest = this.fleeDest(st.car);
        g.ui.toast('THE TARGET IS FLEEING IN A CAR!', 'bad');
      } else if (st.tgt && !st.tgt.dead) {
        const t = st.tgt;
        t.sentry = false;
        if (s.armed) this.toFight(t);
        else { t.mode = 'walk'; this.game.people.flee(t, this.game.player.x, this.game.player.z, 40); }
      }
    },
    update(s, st, dt) {
      const g = this.game;
      if (st.car) {
        if (!st.car.alive) return true;
        if (near(st.car, st.dest) < 40) st.dest = this.fleeDest(st.car);
        this.drive(st.car, dt, st.dest, st.car.stats.speed);
        const d = near(st.car, g.player);
        st.far = d > 380 ? (st.far || 0) + dt : 0;
        if (st.far > 8) return 'The target escaped.';
        return;
      }
      const t = st.tgt;
      if (t.dead) return true;
      if (t.patrol && t.mode === 'sentry') {
        const wp = t.patrol[st.wp || 0];
        if (Math.hypot(wp.x - t.x, wp.z - t.z) < 1) { st.wp = ((st.wp || 0) + 1) % t.patrol.length; t.speed = 0; }
        else g.people.moveTo(t, wp.x, wp.z, 1.1, dt);
      }
    },
    status(s, st) {
      if (st.car) return `${Math.round(near(st.car, this.game.player))} m · STOP THE CAR`;
      if (st.alerted) return 'ALERT · TAKE THEM DOWN';
      let sus = 0;
      for (const q of this.persons) if (q.sentry && !q.dead) sus = Math.max(sus, q.sus || 0);
      const bar = '▮'.repeat(Math.round(sus * 5)) + '▯'.repeat(5 - Math.round(sus * 5));
      return `${Math.round(near(st.tgt, this.game.player))} m · ${sus > 0.05 ? 'SUSPICION ' + bar : 'UNSEEN'}`;
    },
  },

  // -------------------------------------------------- chase down and destroy a fleeing vehicle
  takedown: {
    begin(s, st) {
      const g = this.game, spec = s.vehicle || { model: 'sports', color: '#111' };
      const pt = this.place(s.at || { near: [70, 150] });
      const hp = (spec.hp || 180) * this.dm('hp');
      st.v = this.makeVehicle({ ...spec, hp, speed: (spec.speed || 40) * this.dm('speed') }, pt.x, pt.z, pt.heading || 0);
      st.v.hostile = true;
      st.m = this.marker(st.v.x, st.v.z, 'target', st.v, 2.4);
      st.dest = this.fleeDest(st.v);
      for (let k = 0; k < (s.escorts || 0); k++) {
        const c = g.police.makeCop(s.escortType || 'swat', pt.x - Math.sin(st.v.heading) * (9 + k * 8), pt.z - Math.cos(st.v.heading) * (9 + k * 8), st.v.heading);
        c.vx = c.vz = 0;
      }
    },
    update(s, st, dt) {
      const g = this.game, v = st.v;
      if (!v.alive) return true;
      if (near(v, st.dest) < 40) st.dest = this.fleeDest(v);
      this.drive(v, dt, st.dest, v.stats.speed);
      const d = near(v, g.player);
      st.d = d;
      st.far = d > (s.escape || 380) ? (st.far || 0) + dt : 0;
      if (st.far > 8) return 'The target got away.';
    },
    status(s, st) { return `${Math.round(st.d || 0)} m · HULL ${Math.ceil((st.v.hp / st.v.maxHp) * 100)}%`; },
  },

  // -------------------------------------------------- follow without being seen
  tail: {
    begin(s, st) {
      const spec = s.vehicle || { model: 'sedan', color: '#3a3f47' };
      const pt = this.place(s.at || { near: [45, 80] });
      st.v = this.makeVehicle({ ...spec, hp: (spec.hp || 200) * this.dm('hp') }, pt.x, pt.z, pt.heading || 0);
      st.v.hostile = false;
      st.dest = this.place(s.to || { far: true }, st.v);
      st.m = this.marker(st.v.x, st.v.z, 'contact', st.v, 2.4);
      st.spot = 0; st.lost = 0;
    },
    update(s, st, dt) {
      const g = this.game, v = st.v;
      if (!v.alive) return 'The car you were tailing was destroyed.';
      const d = near(v, g.player);
      st.d = d;
      const arrived = near(v, st.dest) < 16;
      if (arrived) { v.input = { throttle: 0, brake: 1, steer: 0, handbrake: false, nitro: false, hold: true }; this.setLast(v.x, v.z); return true; }
      this.drive(v, dt, st.dest, (s.speed || 17) * this.dm('speed'));
      const close = s.min || 16;
      if (d < close) st.spot += dt * (1.6 - d / close) * this.dm('sense'); else st.spot = Math.max(0, st.spot - dt * 0.2);
      if (st.spot >= 1) {
        if (s.onSpot === 'chase') {
          st.v.hostile = true;
          this.unmark(st.m);
          // turn into a takedown
          this.def.steps.splice(this.idx + 1, 0, { t: 'chaseOn', label: 'THEY MADE YOU! TAKE THEM OUT', threat: this.threat, _v: v, _i: s._i });
          return true;
        }
        return 'You were spotted. They lost you on purpose.';
      }
      st.lost = d > (s.max || 110) ? st.lost + dt : 0;
      if (st.lost > 7) return 'You lost them.';
    },
    status(s, st) {
      const sp = Math.round(st.spot * 5);
      return `${Math.round(st.d || 0)} m${st.d > (s.max || 110) ? ' · TOO FAR!' : st.d < (s.min || 16) ? ' · TOO CLOSE!' : ''}${sp ? ' · ' + '▮'.repeat(sp) : ''}`;
    },
  },

  // continuation of a blown tail: destroy that same car
  chaseOn: {
    begin(s, st) {
      st.v = s._v;
      st.v.hostile = true;
      st.m = this.marker(st.v.x, st.v.z, 'target', st.v, 2.4);
      st.dest = this.fleeDest(st.v);
      st.v.stats = { ...st.v.stats, speed: Math.max(st.v.stats.speed, 40) };
    },
    update(s, st, dt) { return TYPES.takedown.update.call(this, { escape: 400 }, st, dt); },
    status(s, st) { return TYPES.takedown.status.call(this, s, st); },
  },

  // -------------------------------------------------- steal a specific vehicle
  steal: {
    begin(s, st) {
      const g = this.game, spec = s.vehicle || { model: 'sports', color: '#c0c0c0' };
      let pt;
      if (spec.boat) {
        const B = g.boats, base = this.place({ river: true, near: s.at?.near || [150, 350] });
        pt = { x: base.x, z: R() < 0.5 ? B.z0 + 2.2 : B.z1 - 2.2, heading: Math.PI / 2 };
      } else pt = this.place(s.at || { near: [150, 320] });
      st.v = this.makeVehicle(spec, pt.x, pt.z, pt.heading || 0, 'empty');
      st.m = this.marker(st.v.x, st.v.z, 'car', st.v, 3);
      const n = Math.round((s.guards || 0) * this.dm('count'));
      if (n) this.ring(pt.x, pt.z, n, 5, 12, (x, z) => (s.armed ? this.enemy(x, z, s.guardRig) : this.sentry(x, z, s.guardRig || 'swat')));
    },
    update(s, st) {
      const g = this.game;
      if (!st.v.alive) return 'The vehicle was destroyed.';
      if (g.car === st.v) { this.vehicle = st.v; this.vehicleSpec = s.vehicle; return true; }
    },
    status(s, st) { return `${Math.round(near(st.v, this.game.player))} m · GET IN`; },
  },

  // -------------------------------------------------- bring the mission vehicle somewhere
  deliver: {
    begin(s, st) {
      const g = this.game;
      if (!this.vehicle || !this.vehicle.alive || this.vehicle.destroyed) this.provide(s.vehicle || this.vehicleSpec || { model: 'van', color: '#2b2d42' });
      else if (g.car !== this.vehicle) st.m2 = this.marker(this.vehicle.x, this.vehicle.z, 'car', this.vehicle, 3);
      st.pt = this.place(s.to || {});
      st.m = this.marker(st.pt.x, st.pt.z, st.pt.water ? 'boat' : 'go', null, 6);
    },
    update(s, st) {
      const g = this.game, v = this.vehicle;
      if (!v || !v.alive || v.destroyed) return 'The vehicle was destroyed.';
      if (st.m2 && g.car === v) { this.unmark(st.m2); st.m2 = null; }
      if (s.intact && v.hp / v.maxHp < s.intact) return 'The cargo is ruined: too much damage.';
      const d = near(v, st.pt);
      st.d = d;
      if (d < (st.pt.water ? 10 : 7) && g.car === v) { this.setLast(st.pt.x, st.pt.z); return true; }
    },
    status(s, st) {
      const v = this.vehicle;
      return `${Math.round(st.d || 0)} m${s.intact && v ? ` · CARGO ${Math.ceil((v.hp / v.maxHp) * 100)}%` : ''}${v && this.game.car !== v ? ' · GET IN' : ''}`;
    },
  },

  // -------------------------------------------------- defend a zone against waves
  hold: {
    begin(s, st) {
      st.pt = this.place(s.at || { block: ['park', 'plaza', 'parking'] });
      st.r = s.radius || 16;
      st.m = this.marker(st.pt.x, st.pt.z, 'zone', null, st.r);
      st.in = 0; st.out = 0; st.wave = 0; st.waveT = 3;
    },
    update(s, st, dt) {
      const g = this.game, p = g.player;
      const inside = near(p, st.pt) < st.r;
      st.inside = inside;
      if (inside) { st.in += dt; st.out = 0; } else if (st.in > 0) { st.out += dt; if (st.out > 12) return 'You left the zone.'; }
      if (st.in > 0) {
        st.waveT -= dt;
        const alive = this.persons.filter((q) => q.hostile && !q.dead && q.copFoot).length;
        if (st.waveT <= 0 && alive < 8) {
          st.waveT = (s.every || 14) * (1.2 - this.diff * 0.4);
          st.wave++;
          const n = Math.round((s.wave || 3) * this.dm('count'));
          this.ring(st.pt.x, st.pt.z, n, st.r + 14, st.r + 30, (x, z) => this.enemy(x, z, s.rig));
          g.ui.toast(`WAVE ${st.wave}`, 'bad');
        }
      }
      return st.in >= s.secs;
    },
    status(s, st) { return st.inside || !st.in ? `HOLD ${Math.ceil(Math.max(0, s.secs - st.in))} s` : `GET BACK IN THE ZONE! ${Math.ceil(12 - st.out)} s`; },
  },

  // -------------------------------------------------- eliminate a gang / security team
  clear: {
    begin(s, st) {
      st.pt = this.place(s.at || { block: ['park', 'plaza', 'parking', 'industrial'] });
      st.total = Math.max(2, Math.round(s.count * this.dm('count')));
      st.spawned = 0;
      st.m = this.marker(st.pt.x, st.pt.z, 'target', null, 6);
      st.list = [];
    },
    update(s, st) {
      const g = this.game, p = g.player;
      const alive = st.list.filter((q) => !q.dead);
      const engaged = near(p, st.pt) < 120;
      if (engaged && alive.length < 7 && st.spawned < st.total) {
        const n = Math.min(7 - alive.length, st.total - st.spawned);
        st.spawned += n;
        st.list.push(...this.ring(st.pt.x, st.pt.z, n, 3, 14, (x, z) => this.enemy(x, z, s.rig)));
      }
      if (st.spawned >= st.total && alive.length === 0) return true;
      st.left = st.total - st.list.filter((q) => q.dead).length;
    },
    status(s, st) { return `${st.left ?? st.total} LEFT`; },
  },

  // -------------------------------------------------- checkpoint race
  race: {
    begin(s, st) {
      const g = this.game;
      st.pts = [];
      let from = g.player;
      for (let k = 0; k < s.count; k++) {
        const pt = g.city.randomRoadSpot(R, from.x, from.z, 110, 200) || this.place({ near: [110, 200] }, from);
        st.pts.push(pt); from = pt;
      }
      st.k = 0; st.clock = (s.each || 22) * this.dm('time') + 6;
      st.m = this.marker(st.pts[0].x, st.pts[0].z, 'go', null, 7);
    },
    update(s, st, dt) {
      const g = this.game;
      st.clock -= dt;
      if (st.clock <= 0) return 'Too slow.';
      const pt = st.pts[st.k];
      if (near(g.player, pt) < 9) {
        st.k++;
        g.audio.powerup();
        this.unmark(st.m);
        if (st.k >= st.pts.length) return true;
        st.clock += (s.each || 22) * this.dm('time');
        st.m = this.marker(st.pts[st.k].x, st.pts[st.k].z, 'go', null, 7);
      }
    },
    status(s, st) { return `CHECKPOINT ${st.k + 1}/${s.count} · ${Math.max(0, st.clock).toFixed(1)} s`; },
  },

  // -------------------------------------------------- plant charges / sabotage (stand still on foot at each site)
  plant: {
    begin(s, st) {
      const c = s.at ? this.place(s.at) : null;
      st.sites = [];
      for (let k = 0; k < s.count; k++) {
        const pt = c ? this.blockSpot(this.game.people.nearestBlock(c.x + (R() - 0.5) * 120, c.z + (R() - 0.5) * 120))
          : this.place({ block: s.blocks || ['industrial', 'parking', 'midtown', 'downtown'], near: [120 + k * 40, 380 + k * 60] });
        st.sites.push({ ...pt, m: this.marker(pt.x, pt.z, 'plant', null, 2.6), prog: 0 });
      }
      st.done = 0;
      st.guards = Math.round((s.guards || 0) * this.dm('count'));
      if (st.guards) for (const site of st.sites) this.ring(site.x, site.z, st.guards, 5, 12, (x, z) => this.sentry(x, z, s.guardRig || 'swat'));
    },
    update(s, st, dt) {
      const g = this.game, a = g.avatar;
      for (const site of st.sites) {
        if (site.ok) continue;
        const inZone = !g.car && a.active && Math.hypot(a.x - site.x, a.z - site.z) < 2.8;
        site.prog = inZone ? site.prog + dt / (s.secs || 2.5) : Math.max(0, site.prog - dt);
        st.cur = inZone ? site : st.cur === site ? null : st.cur;
        if (site.prog >= 1) {
          site.ok = true; st.done++;
          this.unmark(site.m);
          g.audio.powerup();
          g.ui.toast(`${s.verb || 'CHARGE PLANTED'} ${st.done}/${s.count}`, 'good');
          if (s.boom !== false) {
            const x = site.x, z = site.z;
            this.timers.push({ t: (s.fuse || 18) + st.done, fn: () => { g.explode(x, z, 14, 160, null, true); g.military.addScorch?.(x, z, 6); } });
          }
        }
      }
      return st.done >= s.count;
    },
    status(s, st) {
      const near = this.game.car ? ' · ON FOOT' : '';
      return st.cur && !st.cur.ok ? `${'▮'.repeat(Math.round(st.cur.prog * 6))}${'▯'.repeat(6 - Math.round(st.cur.prog * 6))}` : `${st.done}/${s.count}${near}`;
    },
  },

  // -------------------------------------------------- reach viewpoints and look around (synchronize)
  scout: {
    begin(s, st) {
      s.blocks ||= ['plaza', 'park', 'oldtown', 'downtown'];
      s.verb ||= 'SYNCHRONIZED';
      s.boom = false;
      s.secs ||= 3;
      TYPES.plant.begin.call(this, s, st);
    },
    update(s, st, dt) { return TYPES.plant.update.call(this, s, st, dt); },
    status(s, st) { return TYPES.plant.status.call(this, s, st); },
  },

  // -------------------------------------------------- meet a contact
  meet: {
    begin(s, st) {
      const pt = this.place(s.at || { block: ['park', 'plaza', 'oldtown', 'suburb'], near: [150, 350] });
      st.pt = pt;
      st.who = this.person(pt.x, pt.z, { contact: true, mode: 'sentry', rigKind: s.rig || 'casual', priority: true, heading: R() * 6.28 });
      st.m = this.marker(pt.x, pt.z, 'contact', st.who, 2);
    },
    update(s, st) {
      const g = this.game, p = g.player, d = near(p, st.who);
      st.d = d;
      if (!st.met && (d < 3 || (g.car && d < 8 && g.car.speed < 2))) {
        st.met = true;
        this.unmark(st.m);
        this.say(s.talk);
        st.who.look = p; st.who.lookT = 30;
      }
      if (st.met && !this.talking) return true;
    },
    status(s, st) { return st.met ? 'TALKING…' : `${Math.round(st.d || 0)} m`; },
  },

  // -------------------------------------------------- dialogue only (radio call, story beat)
  talk: {
    begin(s, st) { st.min = s.secs || 1; },
    update(s, st) { return this.stepT > st.min && !this.talking; },
    status() { return '…'; },
  },
};

export const STEP_TYPES = Object.keys(TYPES);
