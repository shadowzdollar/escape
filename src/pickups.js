// Coins and power-ups scattered on the roads around the player.
import * as THREE from 'three';
import { POWERUPS } from './config.js';
import { iconTexture, radialTexture } from './textures.js';

const MAX_COINS = 90;

export class Pickups {
  constructor(game) {
    this.game = game;
    const coinGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.16, 22);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc933, metalness: 0.9, roughness: 0.25, emissive: 0x7a4f00, emissiveIntensity: 0.6 });
    this.coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, MAX_COINS);
    this.coinMesh.castShadow = true;
    this.coinMesh.frustumCulled = false;
    this.coins = [];
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.s = new THREE.Vector3(1, 1, 1);
    this.p = new THREE.Vector3();
    game.scene.add(this.coinMesh);
    this.powerups = [];
    this.icons = {};
    for (const [k, v] of Object.entries(POWERUPS)) {
      this.icons[k] = new THREE.SpriteMaterial({ map: iconTexture(v.icon, v.color), depthWrite: false });
    }
    this.ringTex = radialTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');
    this.coinTimer = 0;
    this.puTimer = 6;
    this.t = 0;
  }

  reset() {
    this.coins = [];
    for (const p of this.powerups) this.game.scene.remove(p.group);
    this.powerups = [];
    this.coinTimer = 0;
    this.puTimer = 6;
    this.writeCoins();
  }

  spawnCoinTrail() {
    const g = this.game, p = g.player, city = g.city;
    const spot = city.randomRoadSpot(Math.random, p.x, p.z, 45, 150);
    if (!spot) return;
    const dx = Math.round(Math.sin(spot.heading)), dz = Math.round(Math.cos(spot.heading));
    const lane = (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.5 ? 4 : 1.5);
    const n = 5 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n && this.coins.length < MAX_COINS; k++) {
      const x = spot.x + dx * k * 3.2 - dz * lane, z = spot.z + dz * k * 3.2 + dx * lane;
      if (!city.isRoad(x, z)) continue;
      this.coins.push({ x, z, y: 1.1, phase: k * 0.4, pulled: false });
    }
  }

  spawnPowerup() {
    const g = this.game, p = g.player;
    const spot = g.city.randomRoadSpot(Math.random, p.x, p.z, 50, 140);
    if (!spot) return;
    const weights = { nitro: 26, repair: g.player.hp < g.player.maxHp * 0.6 ? 35 : 15, shield: 14, emp: 12, magnet: 10, guns: 16 + g.wantedLevel * 3, rockets: 6 + g.wantedLevel * 3 };
    let r = Math.random() * Object.values(weights).reduce((a, b) => a + b, 0);
    let type = 'nitro';
    for (const [k, w] of Object.entries(weights)) { r -= w; if (r <= 0) { type = k; break; } }
    const group = new THREE.Group();
    const sprite = new THREE.Sprite(this.icons[type]);
    sprite.scale.set(2.4, 2.4, 1);
    sprite.position.y = 1.9;
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map: this.ringTex, color: new THREE.Color(POWERUPS[type].color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    ring.position.y = 0.08;
    ring.renderOrder = 3;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 12, 16, 1, true), new THREE.MeshBasicMaterial({
      color: new THREE.Color(POWERUPS[type].color), transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    beam.position.y = 6;
    group.add(sprite, ring, beam);
    group.position.set(spot.x, 0, spot.z);
    g.scene.add(group);
    this.powerups.push({ type, x: spot.x, z: spot.z, group, sprite, life: 40 });
  }

  writeCoins() {
    const n = this.coins.length;
    for (let k = 0; k < n; k++) {
      const c = this.coins[k];
      this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, this.t * 3 + c.phase);
      this.p.set(c.x, c.y + Math.sin(this.t * 3 + c.phase) * 0.2, c.z);
      this.m.compose(this.p, this.q, this.s);
      this.coinMesh.setMatrixAt(k, this.m);
    }
    this.coinMesh.count = n;
    this.coinMesh.instanceMatrix.needsUpdate = true;
  }

  update(dt) {
    const g = this.game, p = g.player;
    this.t += dt;
    if (g.state === 'playing') {
      this.coinTimer -= dt;
      if (this.coinTimer <= 0 && this.coins.length < 60) { this.spawnCoinTrail(); this.coinTimer = 1.2; }
      this.puTimer -= dt;
      if (this.puTimer <= 0 && this.powerups.length < 3) { this.spawnPowerup(); this.puTimer = 9 + Math.random() * 6; }
    }
    const magnet = g.powerTimers.magnet > 0;
    for (let k = this.coins.length - 1; k >= 0; k--) {
      const c = this.coins[k];
      const dx = p.x - c.x, dz = p.z - c.z;
      const d = Math.hypot(dx, dz);
      if (magnet && d < 22) {
        const pull = Math.min(1, dt * (8 + (22 - d)));
        c.x += dx * pull; c.z += dz * pull;
      }
      if (d < 2.8 && g.state === 'playing') {
        g.onCoin(c);
        this.coins.splice(k, 1);
        continue;
      }
      if (d > 260) this.coins.splice(k, 1);
    }
    this.writeCoins();
    for (let k = this.powerups.length - 1; k >= 0; k--) {
      const u = this.powerups[k];
      u.life -= dt;
      u.sprite.position.y = 1.9 + Math.sin(this.t * 3 + k) * 0.3;
      const d = Math.hypot(p.x - u.x, p.z - u.z);
      if (d < 3.4 && g.state === 'playing') {
        g.onPowerup(u.type, u.x, u.z);
        g.scene.remove(u.group);
        this.powerups.splice(k, 1);
        continue;
      }
      if (u.life <= 0 || d > 280) { g.scene.remove(u.group); this.powerups.splice(k, 1); }
    }
  }
}
