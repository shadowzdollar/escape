// Particles, skid marks, and weather.
import * as THREE from 'three';

const VERT = /* glsl */`
attribute float size;
attribute float alpha;
attribute vec3 pcolor;
varying float vA;
varying vec3 vC;
uniform float scale;
void main() {
  vA = alpha; vC = pcolor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */`
varying float vA;
varying vec3 vC;
uniform float soft;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  if (d > 0.5) discard;
  float a = mix(1.0, smoothstep(0.5, 0.0, d), soft) * vA;
  gl_FragColor = vec4(vC, a);
}`;

class Particles {
  constructor(max, additive) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { scale: { value: 800 }, soft: { value: additive ? 1 : 0.85 } },
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
    this.geo = g;
  }
  spawn(x, y, z, vx, vy, vz, r, g, b, size, life, { grow = 0, alpha = 1, gravity = 0, drag = 0 } = {}) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.size[i] = size; this.life[i] = life; this.maxLife[i] = life;
    this.grow[i] = grow; this.a0[i] = alpha; this.alpha[i] = alpha;
    this.grav[i] = gravity; this.drag[i] = drag;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      const d = 1 - this.drag[i] * dt;
      this.vel[i * 3] *= d; this.vel[i * 3 + 2] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.05) { this.pos[i * 3 + 1] = 0.05; this.vel[i * 3 + 1] *= -0.3; }
      this.size[i] += this.grow[i] * dt;
      this.alpha[i] = this.a0[i] * Math.min(1, t * 1.6);
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = true; a.pcolor.needsUpdate = true; a.alpha.needsUpdate = true; a.size.needsUpdate = true;
  }
}

class SkidMarks {
  constructor(max = 4000) {
    this.max = max;
    this.pos = new Float32Array(max * 6 * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: 0x0a0a0a, transparent: true, opacity: 0.45, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.cursor = 0;
    this.count = 0;
    this.geo = g;
    this.dirty = false;
  }
  add(ax, az, bx, bz, y, w = 0.14) {
    let dx = bx - ax, dz = bz - az;
    const l = Math.hypot(dx, dz);
    if (l < 0.05 || l > 4) return;
    const nx = -dz / l * w, nz = dx / l * w;
    const i = this.cursor * 18;
    const P = this.pos;
    const Y = y + 0.025;
    const v = [ax - nx, Y, az - nz, bx - nx, Y, bz - nz, bx + nx, Y, bz + nz, ax - nx, Y, az - nz, bx + nx, Y, bz + nz, ax + nx, Y, az + nz];
    for (let k = 0; k < 18; k++) P[i + k] = v[k];
    this.cursor = (this.cursor + 1) % this.max;
    this.count = Math.min(this.max, this.count + 1);
    this.dirty = true;
  }
  update() {
    if (!this.dirty) return;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.setDrawRange(0, this.count * 6);
    this.dirty = false;
  }
  clear() {
    this.pos.fill(0); this.count = 0; this.cursor = 0; this.dirty = true;
  }
}

class Weather {
  constructor(kind) {
    this.kind = kind;
    this.group = new THREE.Group();
    const n = kind === 'rain' ? 2500 : 1800;
    this.n = n;
    this.area = 90;
    this.pos = new Float32Array(n * (kind === 'rain' ? 6 : 3));
    this.base = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.base[i * 3] = (Math.random() - 0.5) * this.area * 2;
      this.base[i * 3 + 1] = Math.random() * 50;
      this.base[i * 3 + 2] = (Math.random() - 0.5) * this.area * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    if (kind === 'rain') {
      this.obj = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fb8d9, transparent: true, opacity: 0.35 }));
    } else {
      this.obj = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.9, depthWrite: false }));
    }
    this.obj.frustumCulled = false;
    this.group.add(this.obj);
    this.geo = g;
    this.t = 0;
  }
  update(dt, cx, cz) {
    this.t += dt;
    const A = this.area * 2;
    const fall = this.kind === 'rain' ? 38 : 4;
    for (let i = 0; i < this.n; i++) {
      let y = this.base[i * 3 + 1] - fall * dt;
      if (y < 0) y += 50;
      this.base[i * 3 + 1] = y;
      let x = this.base[i * 3], z = this.base[i * 3 + 2];
      if (this.kind === 'snow') { x += Math.sin(this.t * 0.8 + i) * 0.02; this.base[i * 3] = x; }
      // wrap around camera
      const wx = ((x - cx) % A + A * 1.5) % A - A / 2 + cx;
      const wz = ((z - cz) % A + A * 1.5) % A - A / 2 + cz;
      if (this.kind === 'rain') {
        const j = i * 6;
        this.pos[j] = wx; this.pos[j + 1] = y; this.pos[j + 2] = wz;
        this.pos[j + 3] = wx + 0.15; this.pos[j + 4] = y + 1.1; this.pos[j + 5] = wz;
      } else {
        this.pos[i * 3] = wx; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = wz;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.smokeP = new Particles(2500, false);
    this.glowP = new Particles(2000, true);
    this.skids = new SkidMarks();
    scene.add(this.smokeP.points, this.glowP.points, this.skids.mesh);
    this.weather = null;
    this.flash = new THREE.PointLight(0xffa040, 0, 40, 1.6);
    scene.add(this.flash);
    this.flashT = 0;
  }
  setScale(h, fov) {
    const s = h / (2 * Math.tan((fov * Math.PI) / 360));
    this.smokeP.material.uniforms.scale.value = s;
    this.glowP.material.uniforms.scale.value = s;
  }
  setWeather(kind) {
    if (this.weather) { this.scene.remove(this.weather.group); this.weather = null; }
    if (kind) { this.weather = new Weather(kind); this.scene.add(this.weather.group); }
  }
  tireSmoke(x, z, amount = 1, tint = 0.85) {
    const s = this.smokeP;
    s.spawn(x + (Math.random() - 0.5) * 0.4, 0.3, z + (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 1.5, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 1.5,
      tint, tint, tint * 1.02, 1.2 + Math.random() * 0.8, 1.2 + Math.random() * 0.6,
      { grow: 3.5 * amount, alpha: 0.28 * amount, drag: 1.2 });
  }
  dust(x, z, color = [0.75, 0.62, 0.45]) {
    this.smokeP.spawn(x, 0.3, z, (Math.random() - 0.5) * 2, 0.8, (Math.random() - 0.5) * 2,
      color[0], color[1], color[2], 1, 1.4, { grow: 3, alpha: 0.3, drag: 1 });
  }
  damageSmoke(x, y, z, heavy) {
    const k = heavy ? 0.12 : 0.35;
    this.smokeP.spawn(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 0.6, 2 + Math.random(), (Math.random() - 0.5) * 0.6,
      k, k, k, 1, 1.8, { grow: 2.8, alpha: heavy ? 0.6 : 0.35, drag: 0.6 });
    if (heavy && Math.random() < 0.5) {
      this.glowP.spawn(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5,
        0, 2.5, 0, 1.0, 0.45, 0.1, 0.9, 0.5, { grow: -0.8, alpha: 0.9 });
    }
  }
  sparks(x, y, z, nx, nz, count = 12, speed = 10) {
    for (let i = 0; i < count; i++) {
      const a = Math.atan2(nz, nx) + (Math.random() - 0.5) * 2.2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.glowP.spawn(x, y, z, Math.cos(a) * s, 2 + Math.random() * 5, Math.sin(a) * s,
        1.0, 0.75 + Math.random() * 0.2, 0.35, 0.18 + Math.random() * 0.12, 0.35 + Math.random() * 0.4,
        { gravity: 18, drag: 1.5, alpha: 1 });
    }
  }
  debrisBurst(x, z, color = [0.6, 0.6, 0.6], count = 8) {
    for (let i = 0; i < count; i++) {
      this.smokeP.spawn(x, 0.5, z, (Math.random() - 0.5) * 8, 3 + Math.random() * 5, (Math.random() - 0.5) * 8,
        color[0], color[1], color[2], 0.25 + Math.random() * 0.2, 0.9, { gravity: 18, alpha: 1 });
    }
  }
  explosion(x, z) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 9;
      this.glowP.spawn(x, 1, z, Math.cos(a) * s, 2 + Math.random() * 8, Math.sin(a) * s,
        1.0, 0.45 + Math.random() * 0.35, 0.1, 1.2 + Math.random() * 1.4, 0.5 + Math.random() * 0.5,
        { grow: 2, drag: 2.2, alpha: 1 });
    }
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 4;
      this.smokeP.spawn(x, 1.5, z, Math.cos(a) * s, 3 + Math.random() * 3, Math.sin(a) * s,
        0.12, 0.12, 0.12, 2, 2.2 + Math.random(), { grow: 4, drag: 1.2, alpha: 0.65 });
    }
    this.sparks(x, 1, z, 1, 0, 30, 16);
    this.flash.position.set(x, 4, z);
    this.flash.intensity = 400;
    this.flashT = 0.35;
  }
  nitro(x, y, z, dx, dz) {
    for (let k = 0; k < 2; k++) {
      this.glowP.spawn(x + (Math.random() - 0.5) * 0.2, y, z + (Math.random() - 0.5) * 0.2,
        dx * 8 + (Math.random() - 0.5), 0.3, dz * 8 + (Math.random() - 0.5),
        0.3, 0.6 + Math.random() * 0.3, 1.0, 0.5 + Math.random() * 0.3, 0.18, { grow: -1.5, alpha: 0.9 });
    }
  }
  sparkle(x, y, z, color) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 3;
      this.glowP.spawn(x, y, z, Math.cos(a) * s, 2 + Math.random() * 4, Math.sin(a) * s,
        color[0], color[1], color[2], 0.35, 0.6, { gravity: 6, drag: 2, alpha: 1 });
    }
  }
  splash(x, z) {
    for (let i = 0; i < 6; i++) {
      this.smokeP.spawn(x + (Math.random() - 0.5) * 0.3, 0.8, z + (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 2.5, 7 + Math.random() * 4, (Math.random() - 0.5) * 2.5,
        0.75, 0.88, 1.0, 0.45, 1.3, { gravity: 14, alpha: 0.8, grow: 0.5 });
    }
  }
  empWave(x, z) {
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      this.glowP.spawn(x, 0.8, z, Math.cos(a) * 34, 0, Math.sin(a) * 34, 0.7, 0.35, 1.0, 1.4, 1.1, { drag: 1.0, alpha: 1 });
    }
  }
  update(dt, cx, cz) {
    this.smokeP.update(dt);
    this.glowP.update(dt);
    this.skids.update();
    if (this.weather) this.weather.update(dt, cx, cz);
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.intensity = Math.max(0, this.flashT / 0.35) * 400;
    }
  }
  clear() {
    this.skids.clear();
    for (const p of [this.smokeP, this.glowP]) { p.life.fill(0); p.alpha.fill(0); }
  }
}
