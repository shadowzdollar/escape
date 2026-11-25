// Neon District ion projectile effects and angular shard bursts for Fender Bender.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const FORWARD = new THREE.Vector3(0, 0, -1);
const SPEED = 220;
const MAX_SHOTS = 24;
const MAX_BURSTS = 20;

export class NeonWeaponVFX {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    this.root.name = 'Neon weapon ion effects';
    game.scene.add(this.root);

    this.flights = [];
    this.bursts = [];
    this.flightPool = [];
    this.burstPool = [];
    this.serial = 0;
    this.ready = false;

    this.initPools();
  }

  async initPools() {
    const loader = new GLTFLoader();
    const trailGeometry = new THREE.BoxGeometry(0.024, 0.024, 1.2);
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: '#3bd6ee',
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    let boltGeo = new THREE.BoxGeometry(0.08, 0.08, 0.4);
    let boltMat = new THREE.MeshBasicMaterial({ color: '#caffff' });
    let shardTemplates = [
      {
        geometry: new THREE.BoxGeometry(0.06, 0.06, 0.06),
        material: new THREE.MeshBasicMaterial({ color: '#3bd6ee', transparent: true }),
      },
      {
        geometry: new THREE.BoxGeometry(0.08, 0.04, 0.04),
        material: new THREE.MeshBasicMaterial({ color: '#ff44ec', transparent: true }),
      },
      {
        geometry: new THREE.BoxGeometry(0.05, 0.05, 0.05),
        material: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true }),
      },
    ];

    try {
      const [boltGltf, shardsGltf] = await Promise.all([
        loader.loadAsync('/assets/ion-bolt.glb').catch(() => null),
        loader.loadAsync('/assets/impact-shards.glb').catch(() => null),
      ]);

      if (boltGltf) {
        boltGltf.scene.traverse((o) => {
          if (o.isMesh && !boltGeo) {
            boltGeo = o.geometry.clone();
            boltMat = o.material.clone();
          }
        });
      }

      if (shardsGltf) {
        const customShards = [];
        shardsGltf.scene.traverse((o) => {
          if (o.isMesh) {
            customShards.push({
              geometry: o.geometry.clone(),
              material: o.material.clone(),
            });
          }
        });
        if (customShards.length > 0) shardTemplates = customShards;
      }
    } catch {
      // Fallback geometries already in place
    }

    // Flight pool
    for (let i = 0; i < MAX_SHOTS; i++) {
      const group = new THREE.Group();
      group.visible = false;
      this.root.add(group);

      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.name = 'Ion Bolt';
      group.add(bolt);

      const trail = new THREE.Mesh(trailGeometry, trailMaterial.clone());
      trail.name = 'Ion Trail';
      group.add(trail);

      this.flightPool.push({ group, bolt, trail, inUse: false });
    }

    // Burst pool
    for (let i = 0; i < MAX_BURSTS; i++) {
      const group = new THREE.Group();
      group.visible = false;
      this.root.add(group);

      const particles = shardTemplates.slice(0, 8).map((t, idx) => {
        const mesh = new THREE.Mesh(t.geometry, t.material.clone());
        group.add(mesh);
        return { mesh, velocity: new THREE.Vector3(), spin: (idx % 2 ? 1 : -1) * (8 + idx) };
      });

      this.burstPool.push({ group, particles, inUse: false, age: 0, life: 0.28 });
    }

    this.ready = true;
  }

  fire(origin, direction, targetPoint = null) {
    if (!this.ready) return;

    let shot = this.flightPool.find((s) => !s.inUse);
    if (!shot) {
      shot = this.flights.shift();
      if (shot) this.releaseFlight(shot);
      shot = this.flightPool.find((s) => !s.inUse);
    }
    if (!shot) return;

    shot.inUse = true;
    shot.group.visible = true;

    const dir = direction.clone().normalize();
    const distance = targetPoint ? origin.distanceTo(targetPoint) : 180;
    const end = targetPoint ? targetPoint.clone() : origin.clone().addScaledVector(dir, distance);

    shot.origin = origin.clone();
    shot.direction = dir;
    shot.end = end;
    shot.distance = distance;
    shot.age = 0;
    shot.travel = 0;

    shot.group.position.copy(origin);
    shot.group.quaternion.setFromUnitVectors(FORWARD, dir);

    shot.bolt.scale.set(1, 1, 1);
    shot.trail.visible = false;

    this.flights.push(shot);
  }

  spawnImpact(point, normal = new THREE.Vector3(0, 1, 0)) {
    if (!this.ready) return;

    let burst = this.burstPool.find((b) => !b.inUse);
    if (!burst) {
      burst = this.bursts.shift();
      if (burst) this.releaseBurst(burst);
      burst = this.burstPool.find((b) => !b.inUse);
    }
    if (!burst) return;

    burst.inUse = true;
    burst.age = 0;
    burst.group.visible = true;
    burst.group.position.copy(point);

    const n = normal.clone().normalize();
    const tangent = new THREE.Vector3(0, 1, 0).cross(n);
    if (tangent.lengthSq() < 0.01) tangent.set(1, 0, 0);
    tangent.normalize();
    const bitangent = n.clone().cross(tangent);

    for (let i = 0; i < burst.particles.length; i++) {
      const p = burst.particles[i];
      p.mesh.position.copy(n).multiplyScalar(0.02);
      p.mesh.scale.setScalar(1);
      if (p.mesh.material) p.mesh.material.opacity = 1;

      const angle = i * 2.4 + (this.serial++) * 0.3;
      const speed = 2.2 + (i % 4) * 0.8;
      p.velocity.copy(n).multiplyScalar(1.5 + (i % 3) * 0.4)
        .addScaledVector(tangent, Math.cos(angle) * speed)
        .addScaledVector(bitangent, Math.sin(angle) * speed);
    }

    this.bursts.push(burst);
  }

  releaseFlight(shot) {
    shot.group.visible = false;
    shot.inUse = false;
  }

  releaseBurst(burst) {
    burst.group.visible = false;
    burst.inUse = false;
  }

  update(dt) {
    if (!this.ready) return;

    // Update ion bolts
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const s = this.flights[i];
      s.age += dt;
      s.travel = Math.min(s.distance, s.age * SPEED);
      s.group.position.copy(s.origin).addScaledVector(s.direction, s.travel);

      const tail = Math.min(2.4, Math.max(0, s.travel - 0.4));
      s.trail.visible = tail > 0.05;
      s.trail.scale.z = tail;
      s.trail.position.z = 0.4 + tail / 2;

      if (s.travel >= s.distance) {
        this.spawnImpact(s.end, s.direction.clone().negate());
        this.releaseFlight(s);
        this.flights.splice(i, 1);
      }
    }

    // Update shard bursts
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age += dt;
      for (const p of b.particles) {
        p.velocity.y -= dt * 9.8;
        p.mesh.position.addScaledVector(p.velocity, dt);
        p.mesh.rotation.x += dt * p.spin;
        p.mesh.rotation.z += dt * p.spin * 0.4;
        if (p.mesh.material) {
          p.mesh.material.opacity = Math.max(0, 1 - b.age / b.life);
        }
      }
      if (b.age >= b.life) {
        this.releaseBurst(b);
        this.bursts.splice(i, 1);
      }
    }
  }

  reset() {
    while (this.flights.length) this.releaseFlight(this.flights.pop());
    while (this.bursts.length) this.releaseBurst(this.bursts.pop());
  }
}
