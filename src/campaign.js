// Story campaign: 5 missions of rising difficulty, each unlocked by beating the
// previous one. Objectives run in sequence; markers show where to go. Plus
// trophies (achievements) that persist across all modes.
import * as THREE from 'three';
import { WANTED } from './config.js';

export const MISSIONS = [
  {
    id: 'm1', name: 'THE GETAWAY', map: 'city', difficulty: 1,
    brief: 'The heist went loud. Get the cash to the safehouse before the city locks down.',
    objectives: [{ type: 'reach', label: 'REACH THE SAFEHOUSE', min: 420, max: 620 }],
    wantedCap: 2, startHeat: 25, timeLimit: 180, par: 75, reward: 500,
  },
  {
    id: 'm2', name: 'SHAKE THEM OFF', map: 'city', difficulty: 2,
    brief: 'They have your plates. Survive the pursuit, then lose every cop on your tail.',
    objectives: [{ type: 'survive', label: 'SURVIVE THE PURSUIT', time: 75 }, { type: 'evade', label: 'LOSE THE COPS', time: 8 }],
    wantedCap: 4, startHeat: 80, timeLimit: 240, par: 120, reward: 900, unlock: 'stallion',
  },
  {
    id: 'm3', name: 'NEON HEIST', map: 'night', difficulty: 3,
    brief: 'Your crew stashed the money around the city. Pick up every cash drop, then get to the safehouse.',
    objectives: [{ type: 'collect', label: 'COLLECT THE CASH DROPS', count: 4 }, { type: 'reach', label: 'REACH THE SAFEHOUSE', min: 250, max: 450 }],
    wantedCap: 5, startHeat: 110, timeLimit: 300, par: 170, reward: 1500, unlock: 'rosso',
  },
  {
    id: 'm4', name: 'COLD WAR', map: 'snow', difficulty: 4,
    brief: 'No more running. Your car is armed: destroy 6 police vehicles, then hold out against the army.',
    objectives: [{ type: 'destroy', label: 'DESTROY POLICE VEHICLES', count: 6 }, { type: 'survive', label: 'SURVIVE THE ARMY', time: 50 }],
    wantedCap: 6, startHeat: 160, timeLimit: 330, par: 150, reward: 2400, start: { carGuns: 45, carRockets: 8 },
  },
  {
    id: 'm5', name: "PHARAOH'S ESCAPE", map: 'giza', difficulty: 5,
    brief: 'Attack helicopters own the sky over Giza. Reach the escape plane at the pyramids airstrip.',
    objectives: [{ type: 'reach', label: 'REACH THE ESCAPE PLANE', target: 'airstrip', min: 450, max: 750 }],
    wantedCap: 7, startHeat: 375, timeLimit: 300, par: 140, reward: 5000, unlock: 'veyra', start: { rpg: 8, carRockets: 6 },
  },
];

export const TROPHIES = [
  { id: 'first_wreck', name: 'First Blood', desc: 'Wreck a police car' },
  { id: 'wrecker', name: 'Scrap Dealer', desc: 'Wreck 50 police cars in total' },
  { id: 'survivor', name: 'Survivor', desc: 'Survive 3 minutes in one run' },
  { id: 'marathon', name: 'Marathon', desc: 'Survive 6 minutes in one run' },
  { id: 'five_star', name: 'Most Wanted', desc: 'Reach 5 stars' },
  { id: 'seven_star', name: 'Public Enemy', desc: 'Reach 7 stars' },
  { id: 'carjacker', name: 'Carjacker', desc: 'Steal 10 cars' },
  { id: 'tank_thief', name: 'Heavy Metal', desc: 'Steal a tank' },
  { id: 'sky_hunter', name: 'Sky Hunter', desc: 'Shoot down a helicopter' },
  { id: 'gunslinger', name: 'Gunslinger', desc: 'Take down 25 officers in total' },
  { id: 'swimmer', name: 'Swim For It', desc: 'Swim across the river' },
  { id: 'story', name: 'Legend', desc: 'Complete the story' },
  { id: 'rich', name: 'High Roller', desc: 'Earn 10,000 coins in total' },
];

// One mission being played.
export class MissionRun {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.idx = 0;
    this.t = 0;          // time spent
    this.objT = 0;       // time in current objective
    this.done = false;
    this.failed = false;
    this.markers = [];
    this.startWrecks = 0;
    this.collected = 0;
    this.evadeT = 0;
    this.begin();
  }

  get obj() { return this.def.objectives[this.idx]; }

  begin() {
    const g = this.game;
    this.startWrecks = g.wrecks;
    this.objT = 0;
    this.clearMarkers();
    const o = this.obj;
    if (!o) return;
    const p = g.player;
    if (o.type === 'reach') {
      let pt = null;
      if (o.target === 'airstrip' && g.city.airstrip) pt = g.city.airstrip;
      for (let k = 0; !pt && k < 30; k++) pt = g.city.randomRoadSpot(Math.random, p.x, p.z, o.min, o.max);
      pt ||= { x: -p.x, z: -p.z };
      this.addMarker(pt.x, pt.z, 0x3cff7a, o.target === 'airstrip' ? 'plane' : 'safehouse');
    } else if (o.type === 'collect') {
      for (let k = 0; k < o.count; k++) {
        let pt = null;
        for (let t = 0; !pt && t < 30; t++) pt = g.city.randomRoadSpot(Math.random, p.x, p.z, 120 + k * 60, 260 + k * 80);
        if (pt) this.addMarker(pt.x, pt.z, 0xffd23c, 'cash');
      }
    }
    g.ui.toast(o.label, 'warn');
    g.audio.levelUp();
  }

  addMarker(x, z, color, kind) {
    const g = this.game;
    const grp = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 20, 1, true), new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    beam.position.y = 30;
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 4, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    ring.position.y = 0.12;
    grp.add(beam, ring);
    if (kind === 'cash') {
      const bag = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 0.8, emissive: 0x113311 }));
      bag.position.y = 1.4; bag.scale.set(1, 1.2, 0.9);
      grp.add(bag); grp.userData.spin = bag;
    }
    grp.position.set(x, 0, z);
    g.scene.add(grp);
    this.markers.push({ x, z, kind, grp, ring });
  }

  clearMarkers() {
    for (const m of this.markers) this.game.scene.remove(m.grp);
    this.markers = [];
  }

  // Nearest marker for the HUD arrow / minimap.
  target() {
    const p = this.game.player;
    let best = null, bd = Infinity;
    for (const m of this.markers) { const d = Math.hypot(m.x - p.x, m.z - p.z); if (d < bd) { bd = d; best = m; } }
    return best ? { ...best, d: bd } : null;
  }

  // Keep the wanted level inside this mission's cap.
  capHeat() {
    const g = this.game;
    const cap = this.def.wantedCap;
    if (cap < WANTED.length) g.heat = Math.min(g.heat, WANTED[cap].heat - 1);
  }

  update(dt) {
    const g = this.game;
    if (this.done || this.failed) return;
    this.t += dt;
    this.objT += dt;
    this.capHeat();
    for (const m of this.markers) {
      m.ring.rotation.y += dt;
      if (m.grp.userData.spin) m.grp.userData.spin.rotation.y += dt * 2;
      m.ring.material.opacity = 0.55 + Math.sin(this.t * 5) * 0.25;
    }
    if (this.t > this.def.timeLimit) { this.failed = true; g.gameOver('timeout'); return; }
    const o = this.obj, p = g.player;
    let complete = false;
    switch (o.type) {
      case 'reach': {
        const m = this.markers[0];
        if (m && Math.hypot(m.x - p.x, m.z - p.z) < 6) complete = true;
        break;
      }
      case 'collect':
        for (let i = this.markers.length - 1; i >= 0; i--) {
          const m = this.markers[i];
          if (Math.hypot(m.x - p.x, m.z - p.z) < 4.5) {
            g.scene.remove(m.grp); this.markers.splice(i, 1);
            this.collected++;
            g.audio.powerup(); g.effects.sparkle(m.x, 1.5, m.z, [0.4, 1, 0.4]);
            g.score += 300; g.runCoins += 10;
            g.ui.toast(`CASH ${this.collected}/${o.count}`, 'good');
          }
        }
        if (!this.markers.length) complete = true;
        break;
      case 'survive':
        if (this.objT >= o.time) complete = true;
        break;
      case 'destroy':
        if (g.wrecks - this.startWrecks >= o.count) complete = true;
        break;
      case 'evade': {
        // no cop close or with line of sight, and no helicopter overhead
        let seen = false;
        for (const c of g.police.cops) {
          if (!c.alive) continue;
          const d = Math.hypot(c.x - p.x, c.z - p.z);
          if (d < 40 || (d < 120 && !g.city.segmentBlocked(c.x, c.z, p.x, p.z, 1))) { seen = true; break; }
        }
        // out of sight: police head for your last known position instead of tracking you
        if (seen) { g.police.lastKnown = { x: p.x, z: p.z, vx: 0, vz: 0, kind: p.kind, speed: 0 }; this.hiddenT = 0; } else this.hiddenT = (this.hiddenT || 0) + dt;
        g.police.blind = this.hiddenT > 1;
        if (g.police.heli && !g.police.heli.falling && Math.hypot(g.police.heli.x - p.x, g.police.heli.z - p.z) < 60) seen = true;
        this.evadeT = seen ? 0 : this.evadeT + dt;
        g.police.suppress = true; // no fresh units while you're trying to slip away
        g.heat = Math.max(0, g.heat - dt * (seen ? 0 : 6));
        if (this.evadeT >= o.time) complete = true;
        break;
      }
    }
    if (complete) {
      g.police.suppress = false;
      g.police.blind = false;
      this.idx++;
      if (this.idx >= this.def.objectives.length) { this.done = true; this.clearMarkers(); g.missionComplete(); } else this.begin();
    }
  }

  // Text for the objective panel.
  status() {
    const o = this.obj;
    if (!o) return '';
    const left = Math.max(0, this.def.timeLimit - this.t);
    const clock = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    let prog = '';
    const tg = this.target();
    if (o.type === 'reach' && tg) prog = `${Math.round(tg.d)} m`;
    if (o.type === 'collect') prog = `${this.collected}/${o.count}` + (tg ? ` · next ${Math.round(tg.d)} m` : '');
    if (o.type === 'survive') prog = `${Math.ceil(Math.max(0, o.time - this.objT))} s`;
    if (o.type === 'destroy') prog = `${this.game.wrecks - this.startWrecks}/${o.count}`;
    if (o.type === 'evade') prog = this.evadeT > 0 ? `hidden ${this.evadeT.toFixed(1)} / ${o.time} s` : 'they can see you';
    return { label: o.label, prog, clock, step: `${this.idx + 1}/${this.def.objectives.length}` };
  }

  stars() {
    const g = this.game;
    const hpFrac = g.player.hp / g.player.maxHp;
    let s = this.t <= this.def.par ? 3 : this.t <= this.def.par * 1.5 ? 2 : 1;
    if (hpFrac < 0.25 && s > 1) s--;
    return s;
  }

  dispose() {
    this.clearMarkers();
    this.game.police.suppress = false;
    this.game.police.blind = false;
  }
}
