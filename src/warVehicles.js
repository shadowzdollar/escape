// War vehicles & armed boats: weapon definitions, the visible weapon hardware
// (turrets, rocket pods, missile pods) and turret aiming. Works on any car object
// returned by createCar / createTank / createBoat.
import * as THREE from 'three';

export const VEHICLE_WEAPONS = {
  mg: { name: 'MACHINE GUN', rate: 11, dmg: 8, spread: 0.045, speed: 145, turret: true },
  cannon: { name: 'TANK CANNON', rate: 0.55, dmg: 180, radius: 9, shell: true, turret: true },
  rockets: { name: 'ROCKET POD', rate: 1.8, dmg: 140, radius: 8, rocket: true, cone: 1.1 },
  missiles: { name: 'HOMING MISSILES', rate: 1.2, dmg: 160, radius: 8, rocket: true, cone: 1.4 },
};

// Garage boats (the default speedboat is free). Physics stats live in boats.js BOAT_STATS.
export const BOATS = [
  { id: 'speedboat', name: 'SPEEDBOAT', kind: 'speed', boat: true, price: 0, weapons: [], tagline: 'Fast, light, unarmed. Gets you off the island.' },
  { id: 'patrol', name: 'PATROL BOAT', kind: 'patrol', boat: true, color: '#3d4852', price: 6000, weapons: ['mg'], tagline: 'Armoured river patrol craft with a bow machine gun.' },
  { id: 'gunboat', name: 'GUNBOAT', kind: 'gunboat', boat: true, color: '#5b6452', price: 14000, weapons: ['rockets', 'mg'], tagline: 'Twin rocket pods and a deck gun. Owns the river.' },
];

const dark = () => new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.5, metalness: 0.6 });
const olive = (c = 0x4f5a36) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.25 });

function mgTurret(scale = 1) {
  const t = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * scale, 0.48 * scale, 0.22, 12), dark());
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.75 * scale, 0.42 * scale, 0.08), olive());
  shield.position.set(0, 0.3, 0.32 * scale);
  const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.2 * scale, 8).rotateX(Math.PI / 2), dark());
  gun.position.set(0, 0.32, 0.65 * scale);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.36), dark());
  box.position.set(0, 0.3, 0.12);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.32, 1.25 * scale);
  t.add(ring, shield, gun, box, muzzle);
  t.userData.muzzle = muzzle;
  return t;
}

function rocketPod(n = 6) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 1.1), olive(0x5a5f48));
  g.add(box);
  for (let i = 0; i < n; i++) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10).rotateX(Math.PI / 2), dark());
    tube.position.set(-0.26 + (i % 3) * 0.26, -0.12 + Math.floor(i / 3) * 0.24, 0.56);
    g.add(tube);
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 0.7);
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  return g;
}

// Adds the visible weapons to a vehicle's car object and returns handles.
export function addWeaponVisuals(car, def) {
  const out = buildWeapons(car, def);
  // free the extra hardware along with the vehicle
  const parts = [out.turret !== car.turret ? out.turret : null, ...out.pods, out.muzzles.mg?.parent].filter(Boolean);
  const d0 = car.dispose;
  car.dispose = () => { d0(); for (const p of new Set(parts)) p.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); };
  return out;
}

function buildWeapons(car, def) {
  const s = car.spec;
  const w = def.weapons || [];
  const out = { turret: null, muzzles: {}, pods: [] };
  if (def.model === 'tank') {
    // the tank already has its turret, cannon and muzzle; add a coax/roof gun that turns with it
    out.turret = car.turret; out.muzzles.cannon = car.muzzle;
    if (w.includes('mg')) {
      const t = mgTurret(0.75);
      t.position.set(-0.6, 0.93, 0.35);
      car.turret.add(t);
      out.muzzles.mg = t.userData.muzzle;
    }
    return out;
  }
  if (car.body && def.boat) {
    // boats: bow machine gun, rocket pods on the cabin roof
    if (w.includes('mg')) {
      const t = mgTurret(1.1);
      t.position.set(0, 0.62, s.L * 0.3);
      car.body.add(t);
      out.turret = t; out.muzzles.mg = t.userData.muzzle;
    }
    if (w.includes('rockets')) {
      for (const sx of [-0.7, 0.7]) {
        const p = rocketPod(6);
        p.scale.setScalar(0.62);
        p.position.set(sx, 1.53, -s.L * 0.12);
        car.body.add(p);
        out.pods.push(p);
      }
    }
    return out;
  }
  if (w.includes('mg')) {
    const t = mgTurret();
    t.position.set(0, s.roofY + 0.12, (s.roofFZ + s.roofRZ) / 2);
    car.body.add(t);
    out.turret = t; out.muzzles.mg = t.userData.muzzle;
  }
  if (w.includes('rockets')) {
    const p = rocketPod(6);
    p.position.set(0, s.deckY + 0.45, (s.rwZ + (-s.L / 2)) / 2);
    car.body.add(p);
    out.pods.push(p);
  }
  if (w.includes('missiles')) {
    for (const sx of [-1, 1]) {
      const p = new THREE.Group();
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.6, 10).rotateX(Math.PI / 2), dark());
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.35, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.4 }));
      tip.position.z = 0.95;
      p.add(tube, tip);
      p.position.set(sx * (s.W / 2 + 0.12), s.yb + 0.35, -0.1);
      car.body.add(p);
      const m = new THREE.Object3D(); m.position.z = 1.2; p.add(m);
      p.userData.muzzle = m;
      out.pods.push(p);
    }
  }
  return out;
}

// Rotate a turret (child of the car body) toward a world yaw, limited turn rate.
export function aimTurret(turret, carHeading, worldYaw, dt, rate = 3.5) {
  if (!turret) return 0;
  let rel = worldYaw - carHeading;
  rel = Math.atan2(Math.sin(rel), Math.cos(rel));
  const cur = turret.rotation.y;
  let d = rel - cur;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  turret.rotation.y = cur + Math.max(-rate * dt, Math.min(rate * dt, d));
  return Math.abs(d);
}
