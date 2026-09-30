// Boats on the river: docked speedboats the player can steal (from the bank or
// while swimming), cruising traffic boats (feluccas on the Nile), and police
// boats that give chase when you escape by water. Boats use the same arcade
// vehicle physics but are kept inside the river channel instead of the streets.
import * as THREE from 'three';
import { Vehicle } from './vehicle.js';
import { CITY } from './config.js';
import { rc } from './city.js';
import { clamp, wrapAngle } from './utils.js';

const { RIVER_ROW, ROAD, N } = CITY;
export const WATER_Y = -1.6;

function hullGeometry(L, W, H) {
  // top-view hull outline with a pointed bow, extruded upward and tapered below
  const s = new THREE.Shape();
  s.moveTo(-W / 2, -L / 2);
  s.lineTo(W / 2, -L / 2);
  s.lineTo(W / 2, L * 0.15);
  s.quadraticCurveTo(W / 2, L * 0.38, 0, L / 2);
  s.quadraticCurveTo(-W / 2, L * 0.38, -W / 2, L * 0.15);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 });
  // shape (x, y=length) -> world (x, z=length); extrusion -> up (+y)
  g.rotateX(-Math.PI / 2);
  g.rotateY(Math.PI);
  // taper the keel: vertices near the bottom pulled inward
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const k = clamp(y / H, 0, 1);
    p.setX(i, p.getX(i) * (0.55 + 0.45 * k));
  }
  g.computeVertexNormals();
  return g;
}

export function createBoat(kind = 'speed') {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const felucca = kind === 'felucca';
  const police = kind === 'police';
  const armed = kind === 'patrol' || kind === 'gunboat';
  const L = felucca ? 7 : kind === 'gunboat' ? 8.2 : kind === 'patrol' ? 7 : 6.2;
  const W = felucca ? 2.2 : kind === 'gunboat' ? 2.8 : kind === 'patrol' ? 2.5 : 2.3, H = 0.9;
  const hullColor = police ? 0x16233f : felucca ? 0x8a5a2b : kind === 'patrol' ? 0x3d4852 : kind === 'gunboat' ? 0x5b6452 : 0xf4f4f4;
  const paintMat = new THREE.MeshStandardMaterial({ color: hullColor, roughness: armed ? 0.7 : 0.45, metalness: 0.15 });
  const trim = new THREE.MeshStandardMaterial({ color: police ? 0xf2f2f2 : felucca ? 0x5e3b1c : armed ? 0x22272c : 0x1e5bd6, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.6, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1b2a3a, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.8 });
  const hull = new THREE.Mesh(hullGeometry(L, W, H), paintMat);
  hull.position.y = -0.35;
  body.add(hull);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.14, 0.14, L * 0.62), trim);
  stripe.position.set(0, 0.3, -L * 0.1);
  body.add(stripe);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W - 0.25, 0.08, L * 0.7), new THREE.MeshStandardMaterial({ color: felucca ? 0xb07a45 : 0xd9cbb0, roughness: 0.8 }));
  deck.position.set(0, 0.52, -L * 0.1);
  body.add(deck);
  let red = null, blue = null;
  if (felucca) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 7.5, 6), trim);
    mast.position.set(0, 4.2, L * 0.12);
    const sail = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.8, L * 0.42), new THREE.Vector3(0, 8.6, -L * 0.25), new THREE.Vector3(0, 1.2, -L * 0.42),
    ]), new THREE.MeshStandardMaterial({ color: 0xf4efe2, side: THREE.DoubleSide, roughness: 0.9 }));
    sail.geometry.computeVertexNormals();
    sail.position.x = 0.12;
    body.add(mast, sail);
  } else if (armed) {
    // military craft: armoured wheelhouse with a window band, twin outboards
    const house = new THREE.Mesh(new THREE.BoxGeometry(W - 0.7, 0.8, 1.7), paintMat);
    house.position.set(0, 0.95, -L * 0.12);
    const band = new THREE.Mesh(new THREE.BoxGeometry(W - 0.66, 0.22, 1.74), glass);
    band.position.set(0, 1.12, -L * 0.12);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 6), dark);
    mast.position.set(0, 1.9, -L * 0.2);
    body.add(house, band, mast);
    for (const sx of [-0.5, 0.5]) {
      const motor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.5), dark);
      motor.position.set(sx, 0.35, -L / 2 - 0.25);
      body.add(motor);
    }
  } else {
    const shield = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, 0.45, 0.08), glass);
    shield.position.set(0, 0.85, L * 0.05);
    shield.rotation.x = -0.4;
    const console_ = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), police ? paintMat : trim);
    console_.position.set(0, 0.8, -L * 0.05);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(W - 0.5, 0.35, 0.6), dark);
    seat.position.set(0, 0.72, -L * 0.3);
    const motor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.0, 0.5), dark);
    motor.position.set(0, 0.35, -L / 2 - 0.25);
    body.add(shield, console_, seat, motor);
    if (police) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.25), dark);
      bar.position.set(0, 1.3, -L * 0.05);
      red = new THREE.MeshBasicMaterial({ color: 0xff2020 });
      blue = new THREE.MeshBasicMaterial({ color: 0x2060ff });
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.2), red); r.position.set(-0.3, 1.4, -L * 0.05);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.2), blue); b.position.set(0.3, 1.4, -L * 0.05);
      body.add(bar, r, b);
    }
  }
  body.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const shadow = new THREE.Object3D();
  const beam = new THREE.Object3D(); beam.visible = false;
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  return {
    root, body, wheels: [], paintMat, tailMat, glowMat: null, red, blue, beam, shadow, pool: null,
    spec: { L, W, wr: 0.4, ww: 0.3, fa: 1.5, ra: -2, yb: 0, tailBot: 0.3, hoodY: 0.8, roofY: 1.2 },
    setColor() {},
    dispose() { paintMat.dispose(); trim.dispose(); dark.dispose(); glass.dispose(); tailMat.dispose(); red?.dispose(); blue?.dispose(); },
  };
}

export const BOAT_STATS = {
  speed: { speed: 27, accel: 13, handling: 1.7, grip: 2.6, hp: 120, mass: 1.1 },
  police: { speed: 26, accel: 13, handling: 1.8, grip: 2.8, hp: 110, mass: 1.2 },
  patrol: { speed: 28, accel: 13, handling: 1.7, grip: 2.8, hp: 260, mass: 1.6 },
  gunboat: { speed: 31, accel: 15, handling: 1.8, grip: 3.0, hp: 380, mass: 1.9 },
  felucca: { speed: 9, accel: 3, handling: 0.9, grip: 3, hp: 80, mass: 1.0 },
};

export class Boats {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.cops = [];
    this.copTimer = 4;
  }

  get z0() { return rc(RIVER_ROW) + ROAD / 2; }
  get z1() { return rc(RIVER_ROW + 1) - ROAD / 2; }

  underBridge(x) {
    for (let i = 0; i <= N; i++) if (this.game.city.hasBridge(i) && Math.abs(x - rc(i)) < ROAD / 2 + 4) return true;
    return false;
  }

  make(kind, x, z, heading, vehicleKind) {
    const g = this.game;
    const v = new Vehicle({ model: 'boat', stats: BOAT_STATS[kind], kind: vehicleKind, car: createBoat(kind) });
    v.boat = true;
    v.boatKind = kind;
    v.place(x, z, heading);
    v.y = WATER_Y;
    g.scene.add(v.root);
    g.vehicles.add(v);
    this.list.push(v);
    return v;
  }

  reset() {
    for (const v of this.list) { this.game.scene.remove(v.root); v.car.dispose(); this.game.vehicles.delete(v); }
    this.list = []; this.cops = [];
    this.copTimer = 4;
    this.mine = null;
  }

  // The player's own boat from the garage, moored on the bank nearest to (nearX, nearZ).
  spawnOwned(def, nearX, nearZ) {
    let x = clamp(nearX, -CITY.HALF * 0.8, CITY.HALF * 0.8);
    for (let t = 0; t < 30 && this.underBridge(x); t++) x += 6;
    const z = nearZ > (this.z0 + this.z1) / 2 ? this.z1 - 2.2 : this.z0 + 2.2;
    const b = this.make(def.kind, x, z, Math.PI / 2, 'empty');
    b.docked = true; b.owned = true;
    this.mine = b;
    return b;
  }

  // Docked speedboats along both banks + cruising traffic.
  populate() {
    this.reset();
    const g = this.game;
    const HALF = CITY.HALF;
    for (let k = 0; k < 6; k++) {
      let x;
      for (let t = 0; t < 20; t++) { x = (Math.random() - 0.5) * (HALF * 1.6); if (!this.underBridge(x)) break; }
      const side = k % 2 ? 1 : -1;
      const z = side > 0 ? this.z1 - 1.9 : this.z0 + 1.9;
      const b = this.make('speed', x, z, Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1), 'empty');
      b.docked = true;
    }
    const cruise = g.map.theme === 'egypt' ? 'felucca' : 'speed';
    for (let k = 0; k < 3; k++) {
      const x = (Math.random() - 0.5) * HALF * 1.6;
      const lane = (this.z0 + this.z1) / 2 + (k % 2 ? 6 : -6);
      const b = this.make(cruise, x, lane, k % 2 ? -Math.PI / 2 : Math.PI / 2, 'traffic');
      b.cruise = { lane, dir: k % 2 ? -1 : 1 };
      b.stats = { ...b.stats, speed: cruise === 'felucca' ? 5 : 11 };
    }
  }

  // keep boats inside the river channel (they pass under bridges)
  constrain(v) {
    const zmin = this.z0 + 1.2, zmax = this.z1 - 1.2;
    if (v.z < zmin) { v.z = zmin; if (v.vz < 0) { const imp = -v.vz; v.vz = imp * 0.3; if (imp > 6) this.game.onStaticHit({ type: 'wall', v, impact: imp, x: v.x, z: zmin - 0.5, nx: 0, nz: 1 }); } }
    if (v.z > zmax) { v.z = zmax; if (v.vz > 0) { const imp = v.vz; v.vz = -imp * 0.3; if (imp > 6) this.game.onStaticHit({ type: 'wall', v, impact: imp, x: v.x, z: zmax + 0.5, nx: 0, nz: -1 }); } }
    const lim = CITY.HALF + 150;
    if (Math.abs(v.x) > lim) { v.x = Math.sign(v.x) * lim; v.vx *= -0.3; }
  }

  update(dt) {
    const g = this.game, p = g.player;
    for (const v of this.list) {
      if (v === g.car) continue;
      const inp = v.input;
      if (v.kind === 'empty' || !v.alive) { inp.throttle = 0; inp.brake = 0; inp.steer = 0; inp.hold = true; continue; }
      if (v.cruise) {
        // traffic: follow the lane, turn around at the city edges
        const c = v.cruise;
        if (Math.abs(v.x) > CITY.HALF + 60 && Math.sign(v.x) === c.dir) c.dir = -c.dir;
        const want = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        const lateral = clamp((v.z - c.lane) * 0.08, -0.6, 0.6) * c.dir;
        const err = wrapAngle(want - v.heading) + lateral;
        inp.steer = clamp(-err * 2, -1, 1);
        inp.throttle = 0.6; inp.brake = 0;
      } else if (v.kind === 'police') {
        // chase: aim ahead of the player's boat
        const tx = p.x + p.vx * 0.6, tz = p.z + p.vz * 0.6;
        const err = wrapAngle(Math.atan2(tx - v.x, tz - v.z) - v.heading);
        inp.steer = clamp(-err * 2.2, -1, 1);
        inp.throttle = Math.abs(err) > 1.4 ? 0.3 : 1; inp.brake = 0;
        const on = Math.sin(g.time * 9 + v.id) > 0;
        if (v.car.red) { v.car.red.color.setRGB(on ? 4 : 0.3, 0.1, 0.1); v.car.blue.color.setRGB(0.1, 0.25, on ? 0.35 : 4.5); }
      }
    }
    // police boats when you escape by water
    if (g.state === 'playing' && g.car?.boat && g.wantedLevel >= 0 && g.heat > 5) {
      this.copTimer -= dt;
      const alive = this.cops.filter((c) => c.alive).length;
      if (this.copTimer <= 0 && alive < 2 + (g.wantedLevel >= 3 ? 1 : 0)) {
        this.copTimer = 6;
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = clamp(p.x + side * (110 + Math.random() * 60), -CITY.HALF - 100, CITY.HALF + 100);
        const c = this.make('police', x, (this.z0 + this.z1) / 2, side > 0 ? -Math.PI / 2 : Math.PI / 2, 'police');
        c.copType = 'boat';
        this.cops.push(c);
        if (!this.announced) { this.announced = true; g.ui.toast('POLICE BOATS!', 'bad'); }
      }
    }
    // wakes
    for (const v of this.list) {
      if (v.speed > 4 && Math.random() < 0.7) {
        const s = Math.sin(v.heading), c = Math.cos(v.heading);
        g.effects.splash(v.x - s * v.L * 0.5 + (Math.random() - 0.5) * 1.2, v.z - c * v.L * 0.5);
      }
    }
    // tidy: far police boats / wrecks
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const c = this.cops[i];
      if (Math.hypot(c.x - p.x, c.z - p.z) > 400) {
        g.scene.remove(c.root); c.car.dispose(); g.vehicles.delete(c);
        this.list.splice(this.list.indexOf(c), 1); this.cops.splice(i, 1);
      }
    }
  }
}
