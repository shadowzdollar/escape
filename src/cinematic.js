// Opening cinematic: the bank heist. Runs in-engine with scripted camera shots,
// a robber character, alarm, fleeing bystanders and arriving police, then hands
// control to the player.
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from './utils.js';

const SHOTS = [
  { t: 0, title: 'FIRST NATIONAL BANK', sub: 'Downtown · 2:47 PM' },
  { t: 3.2, sub: 'The job is done. The alarm is not.' },
  { t: 7.0, sub: 'Get in. Drive.' },
  { t: 8.6, sub: 'POLICE! GO, GO, GO!' },
  { t: 10.6, sub: '' },
];
const END = 12.4;

export class Cinematic {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('cine');
    this.titleEl = document.getElementById('cine-title');
    this.subEl = document.getElementById('cine-sub');
    this.input = { steer: 0, throttle: 0, brake: 0, handbrake: true, nitro: false };
    this.active = false;
  }

  start() {
    const g = this.game, bank = g.city.bank, p = g.player;
    this.bank = bank;
    this.t = 0;
    this.shot = -1;
    this.active = true;
    this.robber = null;
    this.cops = [];
    this.alarm = false;
    this.inCar = false;
    this.el.classList.add('show');
    this.titleEl.textContent = '';
    this.subEl.textContent = '';
    p.place(bank.carX, bank.carZ, 0);
    this.carX = p.x; this.carZ = p.z;
    // robber route: door -> down the steps -> car door (driver side is -x)
    this.route = [
      { x: bank.doorX + 0.5, z: bank.doorZ },
      { x: bank.stepX + 0.5, z: bank.doorZ + 0.5 },
      { x: this.carX - 1.9, z: this.carZ + 0.3 },
    ];
    const cam = g.camera;
    cam.position.set(bank.stepX + 28, 7, bank.doorZ - 30);
    cam.lookAt(bank.doorX, 6, bank.doorZ);
  }

  skipRequested() {
    const I = this.game.input, j = this.game.joy;
    return I.pressed.size > 0 || j.events.has('R') || j.events.has('L') || this.clicked;
  }

  finish() {
    const g = this.game;
    this.active = false;
    this.hold = false;
    this.clicked = false;
    this.el.classList.remove('show');
    if (this.robber) { g.people.list.splice(g.people.list.indexOf(this.robber), 1); this.robber = null; }
    g.audio.alarm?.(false);
    // make sure a pursuit is waiting behind the player
    const p = g.player;
    if (!this.cops.length) this.spawnCops(40);
    for (const c of this.cops) { c.ai.mode = 'chase'; }
    g.beginChase();
    void p;
  }

  spawnCops(back = 120) {
    const g = this.game;
    const a = g.police.makeCop('patrol', this.carX, this.carZ - back, 0);
    const b = g.police.makeCop('patrol', this.carX + 7.5, this.carZ - back - 18, 0);
    for (const c of [a, b]) { c.ai.mode = 'script'; c.vx = 0; c.vz = 22; }
    this.cops = [a, b];
  }

  update(dt) {
    const g = this.game, bank = this.bank, cam = g.camera, p = g.player;
    if (this.t > 0.4 && this.skipRequested()) {
      // jump to the end state: car rolling, cops right behind
      if (!this.cops.length) this.spawnCops(45);
      else for (const c of this.cops) { if (p.z - c.z > 60) { c.z = p.z - 45; c.x = this.carX; } }
      this.finish();
      return;
    }
    this.t += dt;
    const t = this.t;

    // subtitles
    let si = 0;
    for (let k = 0; k < SHOTS.length; k++) if (t >= SHOTS[k].t) si = k;
    if (si !== this.shot) {
      this.shot = si;
      const s = SHOTS[si];
      this.titleEl.textContent = s.title || '';
      this.subEl.textContent = s.sub;
      this.subEl.classList.remove('pop'); void this.subEl.offsetWidth; this.subEl.classList.add('pop');
    }

    // events
    if (t > 1.4 && !this.alarm) {
      this.alarm = true;
      g.audio.alarm?.(true);
      // bystanders near the bank panic
      for (const q of g.people.list) if (Math.hypot(q.x - bank.doorX, q.z - bank.doorZ) < 45) g.people.flee(q, bank.doorX, bank.doorZ, 6);
    }
    if (t > 3.3 && !this.robber && !this.inCar) {
      this.robber = g.people.make(this.route[0].x, this.route[0].z, {
        script: true, bags: true, speed: 0, heading: Math.PI / 2, mode: 'script',
        shirt: new THREE.Color('#1b1b1f'), pants: new THREE.Color('#15151a'), hairC: new THREE.Color('#111'),
        skin: new THREE.Color('#c68642'), scale: 1.02,
      });
      this.leg = 1;
    }
    const r = this.robber;
    if (r) {
      const wp = this.route[this.leg];
      const dx = wp.x - r.x, dz = wp.z - r.z, d = Math.hypot(dx, dz);
      const sp = 5.8;
      r.heading = Math.atan2(dx, dz);
      r.speed = sp;
      r.x += (dx / d) * Math.min(d, sp * dt);
      r.z += (dz / d) * Math.min(d, sp * dt);
      r.y = g.city.groundHeight(r.x, r.z) + (r.x > bank.doorX && r.x < bank.stepX ? 0.6 * (1 - (r.x - bank.doorX) / (bank.stepX - bank.doorX)) : 0);
      if (Math.random() < dt * 14) g.effects.money(r.x, 1.1, r.z);
      if (d < 0.3) {
        this.leg++;
        if (this.leg >= this.route.length) {
          g.people.list.splice(g.people.list.indexOf(r), 1);
          this.robber = null;
          this.inCar = true;
          g.audio.thud?.();
        }
      }
    }
    if (t > 7.0 && !this.cops.length) this.spawnCops(125);
    // scripted cops: race up behind, stop short of the car until it launches
    for (const c of this.cops) {
      const gap = p.z - c.z;
      c.input.steer = clamp((c.x - (this.carX + (c === this.cops[1] ? 7.5 : 0))) * 0.15, -0.5, 0.5);
      if (t < 10.6 && gap < 26) { c.input.throttle = 0; c.input.brake = 1; c.input.hold = true; } else { c.input.throttle = 1; c.input.brake = 0; c.input.hold = false; }
    }

    // the getaway car
    const inp = this.input;
    // parked (handbrake) -> burnout rev held in place -> launch
    this.hold = t < 10.6;
    if (t < 10.6) { inp.throttle = t > 9.4 ? 1 : 0; inp.brake = 0; inp.handbrake = true; } else { inp.throttle = 1; inp.brake = 0; inp.handbrake = false; }
    if (t > 9.4 && t < 10.8) {
      // burnout smoke
      const s = p.car.spec;
      for (const sx of [-1, 1]) if (Math.random() < 0.35) g.effects.tireSmoke(p.x + sx * (s.W / 2 - 0.2), p.z + s.ra, 0.7, 0.9);
    }

    // ---------------------------------------------------------------- camera
    const doorY = 6;
    if (t < 3.2) {
      // slow establishing push toward the bank
      const k = smoothstep(0, 3.2, t);
      cam.position.set(lerp(bank.stepX + 30, bank.stepX + 17, k), lerp(9, 4, k), lerp(bank.doorZ - 32, bank.doorZ - 16, k));
      cam.lookAt(bank.doorX, doorY - k * 2, bank.doorZ);
    } else if (t < 7.0) {
      // tracking shot on the robber
      const fx = r ? r.x : this.carX, fz = r ? r.z : this.carZ;
      const want = new THREE.Vector3(fx + 4, 2.4, fz + 10);
      cam.position.lerp(want, t < 3.4 ? 1 : 1 - Math.exp(-4 * dt));
      cam.lookAt(fx + 1.5, 1.4, fz);
    } else if (t < 8.6) {
      // low angle behind the car
      cam.position.set(this.carX + 2.8, 1.1, this.carZ - 7.5);
      cam.lookAt(this.carX, 1.0, this.carZ + 2);
    } else if (t < 10.6) {
      // look back past the car at the arriving police
      cam.position.set(this.carX - 3.4, 2.6, this.carZ + 9);
      cam.lookAt(this.carX, 1.2, this.carZ - 18);
    } else {
      // sweep up into the gameplay camera
      const k = smoothstep(10.6, END, t);
      const top = new THREE.Vector3(p.x, 42, p.z + 21);
      const start = new THREE.Vector3(p.x - 3.4, 2.6, p.z + 9);
      cam.position.lerpVectors(start, top, k);
      const look = new THREE.Vector3(p.x, 1, p.z - 18 * (1 - k));
      cam.lookAt(look);
    }
    g.focus.x = p.x; g.focus.z = p.z;
    if (t >= END) this.finish();
  }
}
