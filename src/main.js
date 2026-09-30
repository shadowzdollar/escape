// Escape: Overdrive. Game orchestration: rendering, state machine, rules, camera.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

// Final colour grade: saturation, contrast, warm/cool tint and a soft vignette.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, saturation: { value: 1.1 }, contrast: { value: 1.05 }, tint: { value: new THREE.Color(1, 1, 1) }, vignette: { value: 0.9 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float saturation, contrast, vignette; uniform vec3 tint; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = (col - 0.5) * contrast + 0.5;
      col *= tint;
      vec2 d = vUv - 0.5;
      col *= 1.0 - dot(d, d) * vignette;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

import { CARS, MAPS, WANTED, COIN_VALUE, CITY } from './config.js';
import { City, cutout } from './city.js';
import { Vehicle, collideStatic, collidePair } from './vehicle.js';
import { createCar } from './carModels.js';
import { createTank } from './tankModel.js';
import { BOATS, addWeaponVisuals } from './warVehicles.js';
import { Police } from './police.js';
import { Traffic } from './traffic.js';
import { Pickups } from './pickups.js';
import { People } from './people.js';
import { Humans } from './humans.js';
import { Avatar } from './avatar.js';
import { Combat, WEAPONS } from './combat.js';
import { MissionRun, MISSIONS, TROPHIES } from './campaign.js';
import { Boats, WATER_Y, createBoat } from './boats.js';
import { Military } from './military.js';
import { Cinematic } from './cinematic.js';
import { Effects } from './effects.js';
import { GameAudio } from './audio.js';
import { Input } from './input.js';
import { SerialJoystick } from './joystick.js';
import { UI } from './ui.js';
import { Minimap } from './minimap.js';
import { loadSave, writeSave } from './save.js';
import { clamp, damp, lerp } from './utils.js';

const ATMOS = {
  day: {
    sky: ['#2f6fd0', '#c4e0ff'], fog: '#cadcee', fogNear: 170, fogFar: 600, sun: '#fff1dc', sunI: 2.9, sunDir: [0.5, 0.8, 0.35],
    hemi: ['#cfe3ff', '#5e5540', 1.0], env: 0.55, bloom: [0.22, 0.4, 0.92], exposure: 1.0,
    physical: { turbidity: 3.5, rayleigh: 1.6, mie: 0.004, mieG: 0.8 }, grade: { sat: 1.12, con: 1.06, tint: [1.0, 1.0, 1.0], vig: 0.8 },
  },
  night: {
    sky: ['#02040b', '#18203c'], fog: '#131a2d', fogNear: 60, fogFar: 330, sun: '#8ea6ff', sunI: 0.5, sunDir: [-0.35, 0.85, -0.4],
    hemi: ['#3a4a82', '#0c0c14', 0.55], env: 0.22, bloom: [0.85, 0.55, 0.6], exposure: 1.15, stars: true,
    grade: { sat: 1.18, con: 1.1, tint: [0.95, 0.98, 1.06], vig: 1.2 },
  },
  dusk: {
    sky: ['#2c4a88', '#ffb070'], fog: '#e7a97e', fogNear: 140, fogFar: 540, sun: '#ffb877', sunI: 2.7, sunDir: [0.75, 0.38, 0.3],
    hemi: ['#ffd9b5', '#5a3a22', 0.85], env: 0.5, bloom: [0.3, 0.5, 0.88], exposure: 1.0,
    physical: { turbidity: 8, rayleigh: 2.6, mie: 0.008, mieG: 0.9 }, grade: { sat: 1.1, con: 1.07, tint: [1.05, 1.0, 0.94], vig: 0.9 },
  },
  hot: {
    sky: ['#3a7fd0', '#f3e1bf'], fog: '#ecd9b6', fogNear: 230, fogFar: 780, sun: '#fff0d0', sunI: 3.1, sunDir: [0.6, 0.7, 0.25],
    hemi: ['#ffe9c7', '#7a5a38', 1.0], env: 0.55, bloom: [0.22, 0.45, 0.92], exposure: 1.0,
    physical: { turbidity: 9, rayleigh: 1.2, mie: 0.006, mieG: 0.85 }, grade: { sat: 1.08, con: 1.05, tint: [1.05, 1.01, 0.93], vig: 0.8 },
  },
  overcast: {
    sky: ['#8ea3bd', '#dfe7f0'], fog: '#d3dde8', fogNear: 130, fogFar: 560, sun: '#fff6ea', sunI: 1.9, sunDir: [0.45, 0.75, 0.3],
    hemi: ['#dfe8f5', '#7d8898', 0.8], env: 0.45, bloom: [0.15, 0.4, 0.95], exposure: 0.92,
    grade: { sat: 0.95, con: 1.04, tint: [0.97, 1.0, 1.04], vig: 0.8 },
  },
};

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // far plane
}`;
const SKY_FRAG = /* glsl */`
uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55));
  if (h < 0.0) c = horizon * 0.92;
  float s = max(dot(d, normalize(sunDir)), 0.0);
  c += sunColor * (pow(s, 400.0) * 3.0 + pow(s, 12.0) * 0.25);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const QUALITY = {
  low: { pr: 1, shadows: 0, bloom: false, traffic: 14, msaa: 0, people: 28, humans: 6 },
  medium: { pr: 1.25, shadows: 1024, bloom: true, traffic: 20, msaa: 0, people: 50, humans: 10 },
  high: { pr: 1.5, shadows: 2048, bloom: true, traffic: 24, msaa: 4, people: 80, humans: 24, ao: true },
};

class Game {
  constructor() {
    this.save = loadSave();
    this.state = 'loading';
    this.vehicles = new Set();
    this.focus = { x: 0, z: 0 };
    this.powerTimers = { shield: 0, magnet: 0, spikes: 0 };
    this.nitro = 0.5;
    this.wantedLevel = 0;
    this.heat = 0;
    this.bustTimer = 0;
    this.bustLimit = 2.6;
    this.copsNear = 0;
    this.shake = 0;
    this.slowmo = 0;
    this.time = 0;
    this.acc = 0;
    this.fountains = [];
    this.showAngle = 0.6;

    this.initRenderer();
    this.initScene();
    this.effects = new Effects(this.scene);
    this.audio = new GameAudio();
    this.audio.muted = !this.save.settings.sound;
    this.audio.musicOn = this.save.settings.music;
    this.input = new Input();
    this.input.bindTouch(document.getElementById('touch'));
    this.joy = this.input.joy = new SerialJoystick();
    this.joy.invert.steer = !!this.save.settings.joyInvSteer;
    this.joy.invert.throttle = !!this.save.settings.joyInvThrottle;
    this.ui = new UI(this);
    this.joy.onStatus = (text, ok) => this.ui.joyStatus(text, ok);
    this.cine = new Cinematic(this);
    document.getElementById('cine').addEventListener('pointerdown', () => { this.cine.clicked = true; });
    this.joy.autoConnect();
    this.minimap = new Minimap(document.getElementById('minimap'));
    this.police = new Police(this);
    this.traffic = new Traffic(this);
    this.pickups = new Pickups(this);
    this.people = new People(this);
    this.humans = new Humans(this);
    this.avatar = new Avatar(this);
    this.combat = new Combat(this);
    this.boats = new Boats(this);
    this.car = null;
    this.abandoned = [];
    this.raycaster = new THREE.Raycaster();
    this.military = new Military(this);
    this.applyQuality();

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });
    // first interaction unlocks audio
    const unlock = () => this.audio.init();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    this.resize();
    this.last = performance.now();
    this.fpsAcc = 0; this.fpsFrames = 0;
    requestAnimationFrame((t) => this.loop(t));
    this.loadMap(this.save.map).then(() => this.toMenu());
    this.humans.load().catch((e) => console.warn('character models unavailable, using simple people', e));
  }

  // ------------------------------------------------------------------ setup
  initRenderer() {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    document.getElementById('app').appendChild(r.domElement);
  }

  initScene() {
    const s = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 3000);
    this.camera.position.set(20, 20, 20);
    const pm = new THREE.PMREMGenerator(this.renderer);
    s.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.shadow.camera.left = -75; this.sun.shadow.camera.right = 75;
    this.sun.shadow.camera.top = 75; this.sun.shadow.camera.bottom = -75;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 420;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    s.add(this.hemi, this.sun, this.sun.target);
    s.fog = new THREE.Fog(0xcccccc, 150, 600);

    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() } },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    s.add(this.sky);
    // physically based daytime sky (Preetham); also used to light reflections
    this.physSky = new Sky();
    this.physSky.scale.setScalar(2600);
    this.physSky.frustumCulled = false;
    this.physSky.visible = false;
    s.add(this.physSky);
    this.pmrem = pm;
    const starPos = [];
    for (let i = 0; i < 1500; i++) {
      const u = Math.random() * Math.PI * 2, v = Math.random() * 0.45 + 0.08;
      starPos.push(Math.cos(u) * Math.cos(v) * 1400, Math.sin(v) * 1400, Math.sin(u) * Math.cos(v) * 1400);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
    this.stars.frustumCulled = false;
    s.add(this.stars);

    // player headlights (night) + shield bubble
    this.headlight = new THREE.SpotLight(0xfff1d6, 0, 60, 0.55, 0.6, 1.2);
    this.headlight.target = new THREE.Object3D();
    s.add(this.headlight, this.headlight.target);
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 16), new THREE.MeshBasicMaterial({
      color: 0xffd000, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.shield.visible = false;
    s.add(this.shield);
  }

  initComposer() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: this.q.msaa });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (this.q.ao) {
      // ground-truth ambient occlusion: contact shadows under cars, in corners and alleys
      this.gtao = new GTAOPass(this.scene, this.camera, size.x, size.y);
      this.gtao.updateGtaoMaterial({ radius: 1.2, distanceExponent: 1.5, thickness: 1.5, scale: 1.2 });
      this.gtao.blendIntensity = 0.85;
      this.composer.addPass(this.gtao);
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.3, 0.5, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
  }

  applyQuality() {
    const q = QUALITY[this.save.settings.quality] || QUALITY.high;
    this.q = q;
    this.basePR = Math.min(window.devicePixelRatio || 1, q.pr);
    this.renderer.setPixelRatio(this.basePR);
    const shadows = q.shadows > 0;
    this.renderer.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows;
    if (shadows) {
      this.sun.shadow.mapSize.set(q.shadows, q.shadows);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
    if (this.composer && (this.composerMsaa !== q.msaa || this.composerAo !== !!q.ao)) { this.composer.dispose(); this.composer = null; this.gtao = null; }
    if (q.bloom && !this.composer) { this.initComposer(); this.composerMsaa = q.msaa; this.composerAo = !!q.ao; }
    this.dynScale = 1;
    this.traffic && (this.traffic.target = q.traffic);
    this.people && (this.people.target = q.people);
    this.humans && (this.humans.max = q.humans);
    this.resize();
    if (this.atmos) this.applyAtmosphere(this.map);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
    this.effects?.setScale(h * this.renderer.getPixelRatio(), this.camera.fov);
  }

  // ------------------------------------------------------------------ maps & atmosphere
  async loadMap(id) {
    const map = MAPS.find((m) => m.id === id) || MAPS[0];
    this.map = map;
    this.state = 'loading';
    this.ui.show('loading');
    this.ui.setLoading(`Building ${map.name}…`);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
    this.clearWorld();
    if (this.city) {
      this.scene.remove(this.city.group);
      this.city.dispose();
    }
    this.city = new City(map, { quality: this.save.settings.quality });
    this.scene.add(this.city.group);
    this.isNight = map.time === 'night';
    this.applyAtmosphere(map);
    this.minimap.build(this.city);
    this.people.setCity(this.city);
    this.effects.setWeather(map.id === 'night' ? 'rain' : map.id === 'snow' ? 'snow' : null);
    this.ui.setLoading('Warming up engines…');
    await new Promise((r) => setTimeout(r, 20));
    this.showroomCar(this.save.selected);
    this.placeShowroomCamera(true);
    this.renderer.compile(this.scene, this.camera);
  }

  applyAtmosphere(map) {
    const a = this.atmos = ATMOS[map.time];
    this.skyMat.uniforms.top.value.set(a.sky[0]);
    this.skyMat.uniforms.horizon.value.set(a.sky[1]);
    this.skyMat.uniforms.sunColor.value.set(a.sun).multiplyScalar(map.time === 'night' ? 0.4 : 1);
    this.sunDir = new THREE.Vector3(...a.sunDir).normalize();
    this.skyMat.uniforms.sunDir.value.copy(this.sunDir);
    this.scene.fog.color.set(a.fog);
    this.scene.fog.near = a.fogNear; this.scene.fog.far = a.fogFar;
    this.sun.color.set(a.sun); this.sun.intensity = a.sunI;
    this.hemi.color.set(a.hemi[0]); this.hemi.groundColor.set(a.hemi[1]); this.hemi.intensity = a.hemi[2];
    this.scene.environmentIntensity = a.env * (a.physical ? 0.09 / 0.55 * 1.0 : 1);
    this.renderer.toneMappingExposure = a.exposure;
    this.stars.visible = !!a.stars;
    if (this.bloom) {
      this.bloom.strength = a.bloom[0]; this.bloom.radius = a.bloom[1]; this.bloom.threshold = a.bloom[2];
    }
    // physical sky + matching reflections for daylight maps
    const ph = a.physical;
    // the analytic sky is far brighter than the scene; show the tuned gradient sky and
    // use the physical sky only (scaled way down) for reflections in paint and glass
    this.physSky.visible = false;
    this.sky.visible = true;
    if (ph) {
      const u = this.physSky.material.uniforms;
      u.turbidity.value = ph.turbidity; u.rayleigh.value = ph.rayleigh;
      u.mieCoefficient.value = ph.mie; u.mieDirectionalG.value = ph.mieG;
      u.sunPosition.value.copy(this.sunDir).multiplyScalar(1000);
      if (this.envKey !== map.time) {
        // bake the sky into the environment map used for paint / glass reflections
        const tmp = new THREE.Scene();
        const s2 = new Sky(); s2.scale.setScalar(1000);
        Object.assign(s2.material.uniforms.turbidity, { value: ph.turbidity });
        s2.material.uniforms.rayleigh.value = ph.rayleigh;
        s2.material.uniforms.mieCoefficient.value = ph.mie;
        s2.material.uniforms.mieDirectionalG.value = ph.mieG;
        s2.material.uniforms.sunPosition.value.copy(this.sunDir).multiplyScalar(1000);
        tmp.add(s2);
        this.envTex?.dispose?.();
        this.envTex = this.pmrem.fromScene(tmp).texture;
        this.scene.environment = this.envTex;
        this.envKey = map.time;
        this.envScale = 0.09;
      }
    } else if (this.envKey) {
      this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.envKey = null;
    }
    if (this.grade && a.grade) {
      const gu = this.grade.uniforms;
      gu.saturation.value = a.grade.sat; gu.contrast.value = a.grade.con; gu.vignette.value = a.grade.vig;
      gu.tint.value.setRGB(...a.grade.tint);
    }
    this.audio.setAmbient(map.id === 'night' ? 'rain' : map.id === 'snow' || map.id === 'desert' || map.id === 'giza' ? 'wind' : null);
  }

  selectMap(id) {
    if (id === this.save.map && this.city) { this.ui.showMenu(); return; }
    this.save.map = id;
    this.persist();
    this.loadMap(id).then(() => this.toMenu());
  }

  // ------------------------------------------------------------------ showroom
  showroomCar(carId) {
    const def = CARS.find((c) => c.id === carId) || BOATS.find((b) => b.id === carId) || CARS[0];
    if (this.showcase) {
      this.scene.remove(this.showcase.root);
      this.showcase.dispose();
    }
    const color = this.save.colors[def.id] || def.color;
    this.showcase = def.boat ? createBoat(def.kind) : def.model === 'tank' ? createTank() : createCar(def.model, { color, accent: def.accent, premium: true, neonColor: '#35f2ff' });
    if (def.weapons?.length) addWeaponVisuals(this.showcase, def);
    this.showcase.root.position.set(-4, def.boat ? 0.45 : 0, 0);
    this.showcase.root.rotation.y = 0.5;
    this.showcase.beam.visible = this.isNight;
    this.showcase.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.showcase.root.visible = this.state !== 'playing' && this.state !== 'over' && this.state !== 'paused';
    this.scene.add(this.showcase.root);
  }

  placeShowroomCamera(snap = false) {
    const c = this.showcase.root.position;
    const r = 9.5;
    const pos = new THREE.Vector3(c.x + Math.cos(this.showAngle) * r, 3.4, c.z + Math.sin(this.showAngle) * r);
    if (snap) this.camera.position.copy(pos); else this.camera.position.lerp(pos, 1 - Math.exp(-3.5 * (this.frameDt || 0.016)));
    // keep the car on the right-hand side of the screen (UI is on the left)
    const right = new THREE.Vector3().subVectors(c, this.camera.position).cross(new THREE.Vector3(0, 1, 0)).normalize();
    const look = new THREE.Vector3(c.x, 1.0, c.z).addScaledVector(right, -(innerWidth > 760 ? 3.2 : 0));
    if (innerWidth <= 760) look.y = -0.6;
    this.camera.lookAt(look);
    this.focus.x = c.x; this.focus.z = c.z;
  }

  // ------------------------------------------------------------------ flow
  toMenu() {
    this.clearWorld();
    this.state = 'menu';
    if (this.showcase) this.showcase.root.visible = true;
    this.shield.visible = false;
    this.headlight.intensity = 0;
    this.audio.intensity = 0;
    this.ui.showMenu();
  }

  clearWorld() {
    this.police.reset();
    this.traffic.reset();
    this.pickups.reset();
    this.military.reset();
    if (this.cine?.active) { this.cine.active = false; document.getElementById('cine').classList.remove('show'); this.audio.alarm?.(false); }
    this.effects.clear();
    for (const v of [...this.vehicles]) {
      if (v.kind === 'player' || v.kind === 'empty') { this.scene.remove(v.root); v.car.dispose(); }
    }
    this.boats.reset();
    this.vehicles.clear();
    this.abandoned = [];
    this.doorAnim = null;
    this.avatar.hide();
    this.avatar.reset();
    this.mission?.dispose();
    this.mission = null;
    this.combat.reset();
    this.car = null;
    this.player = null;
    this.city?.resetBreakables();
    this.fountains = [];
  }

  // Story mode: load the mission's map if needed, then start.
  async startMission(id) {
    const def = MISSIONS.find((m) => m.id === id);
    if (!def) return;
    if (def.map !== this.map.id) {
      this.save.map = def.map; this.persist();
      await this.loadMap(def.map);
    }
    this.startRun({ intro: def.id === 'm1' && this.save.settings.intro !== false, mission: def });
  }

  startRun({ intro = false, mission = null } = {}) {
    if (!this.city) return;
    this.pendingMission = mission;
    this.lastMission = mission;
    this.audio.init();
    this.clearWorld();
    const def = CARS.find((c) => c.id === this.save.selected) || CARS[0];
    const color = this.save.colors[def.id] || def.color;
    const p = this.player = this.car = new Vehicle({ model: def.model, stats: def.stats, color, accent: def.accent, kind: 'player', premium: true, neonColor: '#35f2ff', car: def.model === 'tank' ? createTank() : null });
    p.owned = true;
    this.armVehicle(p, def);
    p.car.root.traverse((o) => { if (o.isMesh && o !== p.car.shadow && o !== p.car.beam) o.castShadow = true; });
    const bank = this.city.bank;
    if (bank) p.place(bank.carX, bank.carZ, 0); else p.place(-4, -10, 0);
    this.scene.add(p.root);
    this.vehicles.add(p);
    p.car.beam.visible = this.isNight;
    if (this.showcase) this.showcase.root.visible = false;
    this.traffic.target = this.q.traffic;

    this.runTime = 0; this.score = 0; this.heat = 0; this.wantedLevel = 0; this.maxLevel = 0;
    this.runCoins = 0; this.nitro = 0.6; this.bustTimer = 0; this.wrecks = 0; this.nearMisses = 0;
    this.combo = 0; this.comboT = 0; this.driftScore = 0; this.driftIdle = 0; this.bestDrift = 0;
    for (const k of Object.keys(this.powerTimers)) this.powerTimers[k] = 0;
    this.slowmo = 0;
    this.shake = 0;
    this.focus.x = p.x; this.focus.z = p.z;
    this.camTarget = new THREE.Vector3(p.x, 0, p.z);
    this.audio.intensity = 0;
    this.boats.populate();
    // your own boat from the garage waits at the nearest river bank
    const boatDef = BOATS.find((b) => b.id === this.save.selectedBoat) || BOATS[0];
    this.armVehicle(this.boats.spawnOwned(boatDef, p.x, p.z), boatDef);
    // pre-populate some traffic around the start (kept clear of the bank)
    for (let k = 0; k < 10; k++) this.traffic.spawn(70, 180);
    if (intro && bank) {
      this.state = 'intro';
      this.ui.show();
      this.cine.start();
    } else this.beginChase();
  }

  // Mount a vehicle's weapon loadout (garage war vehicles, armed boats, stolen tanks).
  armVehicle(v, def) {
    if (!def.weapons?.length) return v;
    v.weapons = def.weapons;
    v.wIdx = 0;
    v.wv = addWeaponVisuals(v.car, def);
    return v;
  }

  // Player tank visuals: crawling tracks, barrel recoil and muzzle flash.
  animateOwnTank(v, dt) {
    const c = v.car;
    if (!c.linksA) return;
    const crawl = Math.floor((v.wheelSpin * c.spec.wr) / (c.pitch / 2));
    c.linksA.visible = (crawl & 1) === 0; c.linksB.visible = !c.linksA.visible;
    v.recoil = Math.max(0, (v.recoil || 0) - dt * 5);
    c.barrel.position.z = 2.25 - v.recoil * 0.7;
    v.gunFlash = Math.max(0, (v.gunFlash || 0) - dt);
    c.muzzleMat.opacity = v.gunFlash / 0.12;
  }

  beginChase() {
    const p = this.player;
    this.state = 'playing';
    this.ui.show('hud');
    const md = this.pendingMission;
    this.pendingMission = null;
    if (md) {
      this.heat = Math.max(this.heat, md.startHeat);
      const st = md.start || {};
      if (st.carGuns) this.combat.carGuns = st.carGuns;
      if (st.carRockets) this.combat.carRockets = st.carRockets;
      if (st.rpg) this.combat.ammo.rpg = st.rpg;
      this.mission = new MissionRun(this, md);
      this.ui.toast(md.name, 'warn');
    } else this.ui.toast('ESCAPE THE POLICE!', 'warn');
    this.camTarget = new THREE.Vector3(p.x, 0, p.z);
    this.last = performance.now();
  }

  // Blast damage + knockback for missiles, shells, bombs.
  explode(x, z, r, power, owner = null, friendly = false) {
    const p = this.player;
    const d = p ? Math.hypot(p.x - x, p.z - z) : 999;
    this.effects.explosion(x, z);
    this.effects.debrisBurst(x, z, [0.35, 0.3, 0.25], 14);
    if (d < 160) this.audio.explosion();
    this.shake = Math.min(1.6, this.shake + Math.max(0, 1.3 - d / 60));
    this.people.onExplosion(x, z, r);
    for (const q of this.people.list) if (!q.copFoot && Math.hypot(q.x - x, q.z - z) < r * 3) { this.audio.scream(d); break; }
    this.city.query(x, z, r, (o) => {
      if (o.type === 'circle' && o.breakable && o.alive && Math.hypot(o.x - x, o.z - z) < r) {
        const res = this.city.smash(o, (o.x - x) * 2, (o.z - z) * 2);
        if (res && res.kind === 'hydrant') this.fountains.push({ x: res.x, z: res.z, t: 6 });
      }
    });
    if (!this.car && this.avatar.active && !friendly) {
      const dd = Math.hypot(this.avatar.x - x, this.avatar.z - z);
      if (dd < r) {
        const k = 1 - dd / r;
        if (!(this.powerTimers.shield > 0) && this.state === 'playing') { this.avatar.damage(power * k * 0.9); this.ui.flash('hit'); }
        this.avatar.knock((this.avatar.x - x) / (dd || 1) * 12 * k, (this.avatar.z - z) / (dd || 1) * 12 * k, 1.2);
      }
    }
    for (const o of this.people.list) {
      if (!o.copFoot || o.dead) continue;
      const dd = Math.hypot(o.x - x, o.z - z);
      if (dd < r) { o.hp = (o.hp ?? 40) - power * (1 - dd / r) * 2; if (o.hp <= 0) { o.dead = true; this.onOfficerDown(o); } }
    }
    for (const v of [...this.vehicles]) {
      if (v === owner) continue;
      if (friendly && v === this.car) continue;
      const dd = Math.hypot(v.x - x, v.z - z);
      if (dd > r) continue;
      const k = 1 - dd / r;
      const nx = (v.x - x) / (dd || 1), nz = (v.z - z) / (dd || 1);
      v.applyImpulse(nx * 18 * k * v.mass, nz * 18 * k * v.mass, x, z);
      let dmg = power * k * (v.model === 'tank' ? 0.3 : 1);
      if (v === p) {
        if (this.powerTimers.shield > 0 || this.state !== 'playing') dmg = 0;
        if (dmg > 8) this.ui.flash('hit');
      }
      v.damage(dmg);
      if (v.kind === 'traffic') this.traffic.onHit(v, 10);
      if (v !== p && !v.alive && !v.destroyed) this.onDestroyed(v);
    }
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.show('hud', 'pause');
  }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.last = performance.now();
    this.ui.show('hud');
  }

  persist() { writeSave(this.save); }

  setSetting(key, v) {
    this.save.settings[key] = v;
    this.persist();
    if (key === 'quality') this.applyQuality();
    if (key === 'sound') this.audio.setMuted(!v);
    if (key === 'music') this.audio.setMusic(v);
    if (key === 'fps' && !v) this.ui.setFps('');
    if (key === 'joyInvSteer') this.joy.invert.steer = v;
    if (key === 'joyInvThrottle') this.joy.invert.throttle = v;
  }

  gameOver(reason) {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.slowmo = 1.4;
    const p = this.player;
    if (reason === 'down') {
      this.avatar.knock(0, 0, 999);
    } else if (reason === 'wrecked') {
      this.effects.explosion(p.x, p.z);
      this.audio.explosion();
      p.car.paintMat.color.multiplyScalar(0.25);
      p.alive = false;
    }
    this.audio.gameOver();
    this.ui.flash(reason === 'wrecked' ? 'white' : 'hit');
    const earned = this.mission ? this.runCoins * COIN_VALUE : this.runCoins * COIN_VALUE + this.wrecks * 15 + Math.floor(this.runTime / 10) * 3;
    if (this.mission) this.mission.failed = true;
    const s = this.save;
    s.coins += earned;
    s.totals.runs++; s.totals.copsWrecked += this.wrecks; s.totals.coins += earned; s.totals.time += this.runTime;
    const prev = s.best[this.map.id];
    const newBest = !prev || this.score > prev.score;
    if (newBest) s.best[this.map.id] = { score: Math.floor(this.score), time: this.runTime };
    this.persist();
    const result = {
      reason, time: this.runTime, score: this.score, wrecks: this.wrecks, nearMisses: this.nearMisses,
      maxLevel: this.maxLevel, bestDrift: this.bestDrift, earned, newBest: newBest && !this.mission,
      mission: this.mission?.def,
    };
    setTimeout(() => { if (this.state === 'over') { this.ui.showGameOver(result); this.ui.updateWallet(); } }, 1700);
  }

  // ------------------------------------------------------------------ human soundscape
  soundscape(dt) {
    const A = this.audio, av = this.avatar;
    const sd = this.sd || (this.sd = { step: 0, breath: 0, crowd: 0, radio: 8, shout: 3 });
    if (!this.car && av.active && av.state === 'foot') {
      // footsteps follow the actual stride
      sd.step += av.speed * dt;
      const stride = av.swimming ? 1.6 : av.speed > 6 ? 1.15 : 0.75;
      if (sd.step > stride && av.speed > 0.5 && (av.onGround || av.swimming)) {
        sd.step = 0;
        A.footstep(av.swimming ? 0.05 : av.speed > 6 ? 0.1 : 0.06, av.swimming ? 'water' : 'hard');
      }
      // heavy breathing when sprinting or winded
      sd.breath -= dt;
      if (sd.breath <= 0 && (av.stamina < 0.35 || (av.speed > 7 && av.stamina < 0.8))) { sd.breath = 0.55 + av.stamina * 0.4; A.breath(0.03 + (1 - av.stamina) * 0.05); }
    }
    // police officers shouting at you
    sd.shout -= dt;
    if (sd.shout <= 0) {
      sd.shout = 2;
      let near = null, nd = 40;
      for (const o of this.people.list) {
        if (!o.copFoot || o.dead) continue;
        const d = Math.hypot(o.x - this.player.x, o.z - this.player.z);
        if (d < nd) { nd = d; near = o; }
      }
      if (near) {
        const lines = this.car ? ['Pull over!', 'Stop the vehicle!', 'Out of the car, now!'] : near.arresting ? ['Get down on the ground!', 'Hands behind your back!'] : ['Freeze! Police!', 'Suspect on foot!', 'Drop the weapon!', 'Stop right there!', 'Shots fired!'];
        A.shout(lines[Math.floor(Math.random() * lines.length)], nd);
        sd.shout = 5 + Math.random() * 4;
      }
    }
    // crowd murmur from people nearby
    sd.crowd -= dt;
    if (sd.crowd <= 0) {
      sd.crowd = 0.5;
      let n = 0;
      for (const q of this.people.list) if (!q.copFoot && Math.abs(q.x - this.player.x) < 35 && Math.abs(q.z - this.player.z) < 35) n++;
      A.setCrowd(n);
    }
    // police radio chatter during a chase
    sd.radio -= dt;
    if (sd.radio <= 0) { sd.radio = 12 + Math.random() * 10; if (this.copsNear > 0) A.radio(0.35); }
  }

  // ------------------------------------------------------------------ campaign
  missionComplete() {
    if (this.state !== 'playing') return;
    const m = this.mission, def = m.def;
    this.state = 'over';
    this.slowmo = 1.2;
    const stars = m.stars();
    const s = this.save;
    const camp = s.campaign ||= { unlocked: 1, stars: {} };
    const idx = MISSIONS.indexOf(def);
    const prevStars = camp.stars[def.id] || 0;
    camp.stars[def.id] = Math.max(prevStars, stars);
    camp.unlocked = Math.max(camp.unlocked, Math.min(MISSIONS.length, idx + 2));
    const reward = Math.round(def.reward * (0.5 + stars / 6)) + this.runCoins * COIN_VALUE;
    s.coins += reward;
    s.totals.coins += reward;
    let unlocked = null;
    if (def.unlock && CARS.some((c) => c.id === def.unlock) && !s.owned.includes(def.unlock)) { s.owned.push(def.unlock); unlocked = CARS.find((c) => c.id === def.unlock).name; }
    if (idx === MISSIONS.length - 1) this.unlockTrophy('story');
    this.persist();
    this.audio.levelUp();
    this.police.suppress = true;
    const next = MISSIONS[idx + 1] && camp.unlocked > idx + 1 ? MISSIONS[idx + 1] : null;
    setTimeout(() => {
      if (this.state === 'over') { this.ui.showMissionWin({ def, stars, reward, unlocked, time: m.t, next }); this.ui.updateWallet(); }
    }, 1500);
  }

  unlockTrophy(id) {
    const s = this.save;
    s.trophies ||= {};
    if (s.trophies[id]) return;
    s.trophies[id] = true;
    s.coins += 100;
    this.persist();
    const t = TROPHIES.find((x) => x.id === id);
    this.ui.toast(`🏆 TROPHY: ${t.name.toUpperCase()} +100`, 'good');
    this.audio.powerup();
  }

  checkTrophies() {
    const s = this.save, t = s.totals;
    if (this.wrecks > 0) this.unlockTrophy('first_wreck');
    if (t.copsWrecked + this.wrecks >= 50) this.unlockTrophy('wrecker');
    if (this.runTime >= 180) this.unlockTrophy('survivor');
    if (this.runTime >= 360) this.unlockTrophy('marathon');
    if (this.wantedLevel >= 4) this.unlockTrophy('five_star');
    if (this.wantedLevel >= 6) this.unlockTrophy('seven_star');
    if ((t.carsStolen || 0) >= 10) this.unlockTrophy('carjacker');
    if ((t.officersDown || 0) >= 25) this.unlockTrophy('gunslinger');
    if (t.coins >= 10000) this.unlockTrophy('rich');
    // swimming across the river: entered from one bank, climbed out on the other
    const a = this.avatar;
    if (a.active) {
      if (a.swimming && this.swimFrom === undefined) this.swimFrom = Math.sign(a.z - (this.riverMid ?? (a.z)));
      if (a.swimming) this.riverMid ??= a.z;
      if (!a.swimming && this.swimFrom !== undefined) {
        if (Math.sign(a.z - this.riverMid) !== this.swimFrom && Math.abs(a.z - this.riverMid) > 20) this.unlockTrophy('swimmer');
        this.swimFrom = undefined; this.riverMid = undefined;
      }
    }
  }

  // ------------------------------------------------------------------ on foot
  exitCar(bail = false) {
    const v = this.car;
    if (!v) return;
    const sp = v.speed;
    const s = Math.sin(v.heading), c = Math.cos(v.heading);
    // driver's door is on the car's left: (cos h, -sin h)
    let x = v.x + c * (v.W / 2 + 0.8), z = v.z - s * (v.W / 2 + 0.8);
    if (this.city.pointBlocked(x, z, 0.4)) { x = v.x - c * (v.W / 2 + 0.8); z = v.z + s * (v.W / 2 + 0.8); }
    this.avatar.spawn(x, z, v.heading, v.vx * 0.5, v.vz * 0.5);
    const av0 = this.avatar;
    if (bail || sp > 14) {
      this.avatar.knock(v.vx, v.vz, 1.1);
      if (!bail) { this.avatar.damage(Math.min(22, sp * 0.45)); this.ui.toast('BAILED OUT!', 'warn'); }
    } else if (!v.boat && v.model !== 'tank') {
      this.endDoor();
      this.doorAnim = { v, t: 0, mode: 'exit', door: this.makeDoor(v) };
      av0.heading = v.heading + Math.PI / 2;
    }
    v.kind = 'empty';
    v.input = { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false };
    v.nitroActive = false;
    v.car.beam.visible = false;
    this.abandoned.push(v);
    this.car = null;
    this.player = this.avatar;
    this.nitro = this.avatar.stamina;
    if (!this.hintShown) { this.hintShown = true; this.ui.toast('ON FOOT: F / RIGHT-STICK TO STEAL A CAR', 'warn'); }
  }

  tryEnterCar() {
    const av = this.avatar;
    if (av.state !== 'foot') return false;
    let best = null, bd = Infinity;
    for (const v of this.vehicles) {
      if (!v.alive || v.speed > 4 || v.destroyed) continue;
      if (av.swimming && !v.boat) continue;
      const d = Math.hypot(v.x - av.x, v.z - av.z) - v.L / 2;
      const reach = v.boat ? 3.6 : 2.4;
      if (d < reach && d < bd) { bd = d; best = v; }
    }
    if (!best) { this.ui.toast('NO VEHICLE IN REACH'); return false; }
    const v = best;
    // hold the vehicle still while we get in
    if (v.kind === 'traffic') { const i = this.traffic.cars.indexOf(v); if (i >= 0) this.traffic.cars.splice(i, 1); v.kind = 'held'; }
    else if (v.kind === 'police') { const i = this.police.cops.indexOf(v); if (i >= 0) this.police.cops.splice(i, 1); v.kind = 'heldPolice'; }
    v.input = { throttle: 0, brake: 1, steer: 0, handbrake: false, nitro: false, hold: true };
    if (v.boat || v.model === 'tank') { this.commitEnter(v); return true; }
    // walk to the driver's door, open it, climb in, shut it
    this.doorAnim = { v, t: 0, phase: 'walk', mode: 'enter', door: this.makeDoor(v) };
    av.state = 'busy';
    return true;
  }

  // A door panel (paint + window) hinged at its front edge on the driver's side (+x).
  makeDoor(v) {
    const s = v.car.spec;
    if (!s.cowlZ) return null;
    const zf = Math.min(s.cowlZ + 0.05, s.fa - s.wr - 0.1), len = Math.min(1.25, zf - (s.ra + s.wr + 0.2));
    const belt = (s.hoodY + s.deckY) / 2;
    const g = new THREE.Group();
    const doorMat = new THREE.MeshStandardMaterial({ color: v.car.paintMat.color.clone(), roughness: 0.34, metalness: 0.3 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.07, belt - s.yb - 0.1, len), doorMat);
    panel.position.set(0, (belt + s.yb + 0.1) / 2, -len / 2);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.04, (s.roofY - 0.12) - belt, len * 0.9), new THREE.MeshStandardMaterial({ color: 0x1b2a3a, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.75 }));
    win.position.set(0, (s.roofY - 0.12 + belt) / 2, -len / 2 - len * 0.05);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.18), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    handle.position.set(0.05, belt - 0.12, -len + 0.25);
    g.add(panel, win, handle);
    g.position.set(s.W / 2 + 0.02, 0, zf);
    v.car.body.add(g);
    return g;
  }

  // Door animation + the walk to the car. Runs every frame while active.
  updateDoor(dt) {
    const d = this.doorAnim;
    if (!d) return;
    const v = d.v, av = this.avatar, s = Math.sin(v.heading), c = Math.cos(v.heading);
    d.t += dt;
    const doorPos = { x: v.x + c * (v.W / 2 + 0.75), z: v.z - s * (v.W / 2 + 0.75) };
    const ang = (a) => { if (d.door) d.door.rotation.y = -a; };
    if (d.mode === 'enter') {
      if (d.phase === 'walk') {
        const dx = doorPos.x - av.x, dz = doorPos.z - av.z, dist = Math.hypot(dx, dz);
        av.x += (dx / (dist || 1)) * Math.min(dist, 4.5 * dt); av.z += (dz / (dist || 1)) * Math.min(dist, 4.5 * dt);
        av.heading = Math.atan2(dx, dz); av.vx = av.vz = 0; av.sync();
        if (av.person) av.person.speed = dist > 0.2 ? 3 : 0;
        if (dist < 0.25 || d.t > 1.2) { d.phase = 'open'; d.t = 0; this.audio.doorSlam?.(); }
      } else if (d.phase === 'open') {
        ang(Math.min(1, d.t / 0.25) * 1.15);
        av.heading = v.heading + Math.PI / 2; if (av.person) av.person.speed = 0; av.sync();
        if (d.t > 0.3 && !d.pulled) {
          d.pulled = true;
          if (v.kind === 'held') {
            // the driver is dragged out and runs off
            const drv = this.people.make(doorPos.x + c * 0.6, doorPos.z - s * 0.6, { heading: v.heading - Math.PI / 2 });
            this.people.knock(drv, c * 4, -s * 4, 0.6);
          }
        }
        if (d.t > 0.55) { this.commitEnter(v); d.phase = 'close'; d.t = 0; }
      } else if (d.phase === 'close') {
        ang((1 - Math.min(1, d.t / 0.25)) * 1.15);
        if (d.t > 0.3) { this.audio.doorSlam?.(); this.endDoor(); }
      }
    } else {
      // exiting: door swings open, you step out, it closes behind you
      const a = d.t < 0.25 ? d.t / 0.25 : d.t < 0.6 ? 1 : 1 - Math.min(1, (d.t - 0.6) / 0.25);
      ang(a * 1.15);
      if (d.t > 0.9) { this.audio.doorSlam?.(); this.endDoor(); }
    }
  }

  endDoor() {
    const d = this.doorAnim;
    if (d?.door) { d.door.parent?.remove(d.door); d.door.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
    this.doorAnim = null;
  }

  commitEnter(v) {
    const av = this.avatar;
    if (v.kind === 'held') {
      this.heat += 3;
      this.ui.toast('CARJACKED!', 'warn');
      this.save.totals.carsStolen = (this.save.totals.carsStolen || 0) + 1;
    } else if (v.kind === 'heldPolice') {
      this.heat += v.copType === 'tank' ? 45 : 15;
      this.ui.toast(v.copType === 'tank' ? 'YOU STOLE A TANK!' : 'STOLE A POLICE CAR!', 'bad');
      this.save.totals.carsStolen = (this.save.totals.carsStolen || 0) + 1;
      if (v.copType === 'tank') this.unlockTrophy('tank_thief');
    }
    const i = this.abandoned.indexOf(v); if (i >= 0) this.abandoned.splice(i, 1);
    v.kind = 'player';
    v.ai = null;
    v.input = { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false };
    v.disabledTimer = 0;
    v.speedMul = 1;
    if (v.model === 'tank' && !v.weapons) this.armVehicle(v, { model: 'tank', weapons: ['cannon', 'mg'] });
    if (v.weapons && !this.armedHint) { this.armedHint = true; this.ui.toast('ARMED: CLICK / J / JOYSTICK R FIRES · Q SWITCHES', 'good'); }
    if (v.stats.speed < 34 && !v.boat && !v.owned) v.stats = { ...v.stats, speed: 34, accel: Math.max(v.stats.accel, 20), handling: Math.max(v.stats.handling, 2.5) };
    v.car.beam.visible = this.isNight;
    this.car = v;
    this.player = v;
    av.hide();
    this.audio.doorSlam?.();
    return true;
  }

  // "Screen up" direction on the ground, for camera-relative movement on foot.
  screenForward() {
    const cam = this.camera, t = this.camTarget || this.player;
    let fx = t.x - cam.position.x, fz = t.z - cam.position.z;
    const n = Math.hypot(fx, fz) || 1;
    return { x: fx / n, z: fz / n };
  }

  mouseGround(h = 1) {
    const m = this.input.mouse;
    const ndc = new THREE.Vector2((m.x / innerWidth) * 2 - 1, -(m.y / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -h);
    const pt = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, pt) ? pt : null;
  }

  onPlayerShot(dmg) {
    if (this.state !== 'playing' || this.powerTimers.shield > 0) return;
    this.player.damage(dmg);
    this.shake = Math.min(1, this.shake + 0.12);
    if (!this.car) this.ui.flash('hit');
  }

  onOfficerDown(o) {
    if (this.state !== 'playing') return;
    this.score += 150;
    this.heat += 4;
    this.combat.kills++;
    this.save.totals.officersDown = (this.save.totals.officersDown || 0) + 1;
    if ((this.offToastT || 0) < this.time) { this.ui.toast('OFFICER DOWN +150', 'good'); this.offToastT = this.time + 3; }
  }

  onOfficersDeployed() {
    if ((this.depToastT || 0) < this.time) { this.ui.toast('OFFICERS ON FOOT!', 'bad'); this.depToastT = this.time + 10; }
  }

  onCivilianShot() {
    if (this.state !== 'playing') return;
    this.score = Math.max(0, this.score - 150);
    this.heat += 5;
    if ((this.civToastT || 0) < this.time) { this.ui.toast('CIVILIAN HIT −150', 'bad'); this.civToastT = this.time + 3; }
  }

  // Bullets / rockets hitting a helicopter (police or military).
  damageHeli(h, dmg) {
    if (h.falling) return;
    h.hp = (h.hp ?? 150) - dmg;
    if (h.hp > 0) return;
    h.falling = true;
    if (h.laser) { this.military.removeWarning(h.laser); h.laser = null; }
    h.aimT = 0;
    this.effects.explosion(h.x, h.z);
    this.audio.explosion();
    if (this.state === 'playing') {
      this.score += 600;
      this.heat += 12;
      this.combat.kills++;
      this.ui.toast('HELICOPTER DOWN! +600', 'good');
      this.unlockTrophy('sky_hunter');
    }
  }

  // ------------------------------------------------------------------ events
  onCoin(c) {
    this.runCoins++;
    this.score += 25;
    this.audio.coin();
    this.effects.sparkle(c.x, 1.2, c.z, [1, 0.8, 0.2]);
  }

  onPowerup(type, x, z) {
    const p = this.player;
    this.audio.powerup();
    this.effects.sparkle(x, 1.5, z, [1, 1, 1]);
    switch (type) {
      case 'nitro': this.nitro = 1; this.avatar.stamina = 1; this.ui.toast(this.car ? 'NITRO FULL' : 'STAMINA FULL', 'good'); break;
      case 'guns':
        if (this.car) { this.combat.carGuns = 15; this.ui.toast('MACHINE GUNS: AUTO-FIRE 15s', 'good'); } else { this.combat.ammo.smg += 150; this.combat.weapon = 'smg'; this.ui.toast('SMG +150', 'good'); }
        break;
      case 'rockets':
        if (this.car) { this.combat.carRockets += 6; this.ui.toast('ROCKETS x6: AUTO-LOCK', 'good'); } else { this.combat.ammo.rpg += 6; this.combat.weapon = 'rpg'; this.ui.toast('ROCKET LAUNCHER x6', 'good'); }
        break;
      case 'repair': p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.45); this.ui.toast('REPAIRED', 'good'); break;
      case 'shield': this.powerTimers.shield = 8; this.ui.toast('SHIELD ON', 'good'); break;
      case 'magnet': this.powerTimers.magnet = 12; this.ui.toast('COIN MAGNET', 'good'); break;
      case 'emp': {
        let n = 0;
        for (const c of this.police.cops) {
          if (c.alive && Math.hypot(c.x - p.x, c.z - p.z) < 48) { c.disabledTimer = 5.5; n++; }
        }
        this.effects.empWave(p.x, p.z);
        this.audio.emp();
        this.ui.toast(n ? `EMP! ${n} COP${n > 1 ? 'S' : ''} DISABLED` : 'EMP BLAST', 'good');
        break;
      }
    }
  }

  onSpikes() {
    const p = this.player;
    if (!this.car) return;
    if (this.powerTimers.shield > 0) { this.ui.toast('SHIELD BLOCKED SPIKES', 'good'); return; }
    this.powerTimers.spikes = 6;
    this.audio.spikes();
    this.effects.sparks(p.x, 0.4, p.z, Math.sin(p.heading), Math.cos(p.heading), 30, 8);
    this.ui.toast('TIRES POPPED!', 'bad');
    p.damage(8);
  }

  onStaticHit(info) {
    const v = info.v;
    const nearP = this.player && Math.hypot(v.x - this.player.x, v.z - this.player.z) < 70;
    if (info.type === 'smash') {
      const r = this.city.smash(info.collider, v.vx, v.vz);
      if (!r) return;
      this.effects.debrisBurst(r.x, r.z, r.kind === 'hydrant' ? [0.8, 0.15, 0.15] : [0.5, 0.5, 0.5], 6);
      if (nearP) this.audio.smash();
      if (r.kind === 'hydrant') this.fountains.push({ x: r.x, z: r.z, t: 6 });
      if (v === this.player && this.state === 'playing') { this.score += 15; this.heat += 0.6; }
      return;
    }
    const impact = info.impact;
    if (impact > 10) this.people.onNoise(info.x, info.z, Math.min(1.3, impact / 18));
    if (impact > 5) this.effects.sparks(info.x, 0.7, info.z, info.nx, info.nz, Math.min(30, impact | 0), impact * 0.5);
    if (nearP && impact > 4) this.audio.crash(impact);
    let dmg = Math.max(0, impact - 9) * 1.05;
    if (v === this.player) {
      if (this.powerTimers.shield > 0 || this.state !== 'playing') dmg = 0;
      this.shake = Math.min(1.2, this.shake + impact * 0.03);
      if (dmg > 10) this.ui.flash('hit');
      v.damage(dmg);
    } else {
      v.damage(dmg * 0.8);
      if (v.kind === 'traffic') this.traffic.onHit(v, impact);
      if (!v.alive && !v.destroyed) this.onDestroyed(v);
    }
  }

  onCarHit({ a, b, impact, x, z, nx, nz }) {
    const p = this.player;
    const involvesP = a === p || b === p;
    if (involvesP) {
      const o = a === p ? b : a;
      o.lastHitP = this.time;
      o.nmPending = false;
    }
    if (impact < 2.5) return;
    if (impact > 8) this.people.onNoise(x, z, Math.min(1.5, impact / 15));
    const nearP = p && Math.hypot(x - p.x, z - p.z) < 70;
    this.effects.sparks(x, 0.8, z, nx, nz, Math.min(24, (impact * 0.8) | 0), impact * 0.4);
    if (nearP) this.audio.crash(impact * 0.9);
    const base = Math.max(0, impact - 6) * 1.2;
    const tot = a.mass + b.mass;
    let da = base * (b.mass / tot) * 2, db = base * (a.mass / tot) * 2;
    if (involvesP) {
      const shielded = this.powerTimers.shield > 0 || this.state !== 'playing';
      if (a === p) { da = shielded ? 0 : da * 0.7; db *= shielded ? 2.2 : 1.4; } else { db = shielded ? 0 : db * 0.7; da *= shielded ? 2.2 : 1.4; }
      this.shake = Math.min(1.2, this.shake + impact * 0.035);
      if ((a === p ? da : db) > 10) this.ui.flash('hit');
      const o = a === p ? b : a;
      if (o.kind === 'traffic' && this.state === 'playing') this.heat += 1;
    }
    if (a.copType === 'tank') db *= 1.6;
    if (b.copType === 'tank') da *= 1.6;
    a.damage(da); b.damage(db);
    for (const v of [a, b]) {
      if (v.kind === 'traffic') this.traffic.onHit(v, impact);
      if (v !== p && !v.alive && !v.destroyed) this.onDestroyed(v);
    }
  }

  onPedestrianHit(p, v) {
    const pl = this.player;
    const d = pl ? Math.hypot(p.x - pl.x, p.z - pl.z) : 999;
    if (d < 60) { this.audio.thud?.(); this.audio.scream(d); }
    v.vx *= 0.93; v.vz *= 0.93;
    if (v !== pl || this.state !== 'playing') return;
    this.score = Math.max(0, this.score - 100);
    this.heat += 5;
    this.shake = Math.min(1, this.shake + 0.2);
    if (this.people.toastT <= 0) { this.ui.toast('PEDESTRIAN HIT  −100', 'bad'); this.people.toastT = 2; }
  }

  onDestroyed(v) {
    v.destroyed = true;
    const p = this.player;
    const d = p ? Math.hypot(v.x - p.x, v.z - p.z) : 999;
    this.effects.explosion(v.x, v.z);
    if (d < 120) this.audio.explosion();
    if (d < 40) this.shake = Math.min(1.4, this.shake + 0.6);
    v.car.paintMat.color.multiplyScalar(0.22);
    if (v.car.red) { v.car.red.color.setRGB(0.1, 0.02, 0.02); v.car.blue.color.setRGB(0.02, 0.02, 0.1); }
    if (v.car.pool) v.car.pool.visible = false;
    v.car.beam.visible = false;
    if (this.state !== 'playing') return;
    if (v.kind === 'police') {
      this.wrecks++;
      this.score += 300;
      this.heat += 10;
      this.runCoins += 2;
      this.ui.toast(`COP WRECKED +300`, 'good');
    } else {
      this.score += 40;
      this.heat += 2;
    }
  }

  // ------------------------------------------------------------------ main loop
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.frameDt = dt;
    if (this.frozen) { this.render(); return; } // dev: simulation stepped manually
    if (this.save.settings.fps) {
      this.fpsAcc += dt; this.fpsFrames++;
      if (this.fpsAcc > 0.5) { this.ui.setFps(`${Math.round(this.fpsFrames / this.fpsAcc)} FPS · ${this.renderer.info.render.calls} calls`); this.fpsAcc = 0; this.fpsFrames = 0; }
    }
    this.handleKeys();
    this.handleJoystick(dt);
    if (this.state === 'loading') { this.render(); this.input.endFrame(); return; }
    if (this.slowmo > 0) { this.slowmo -= dt; dt *= 0.35; }
    this.time += dt;

    const tu = performance.now();
    if (this.state === 'playing' || this.state === 'over' || this.state === 'intro') this.updatePlay(dt);
    else if (this.state === 'menu') this.updateMenu(dt);
    const tr = performance.now();

    if (this.state !== 'paused') {
      this.city.update(dt, this.time);
      this.effects.update(dt, this.camera.position.x, this.camera.position.z);
    }
    this.render();
    const te = performance.now();
    const pf = this.perf || (this.perf = { update: 0, render: 0 });
    pf.update = pf.update * 0.95 + (tr - tu) * 0.05;
    pf.render = pf.render * 0.95 + (te - tr) * 0.05;
    this.adaptResolution(dt);
    this.input.endFrame();
  }

  // Dynamic resolution: drop render scale when frames are consistently slow, recover when fast.
  adaptResolution(dt) {
    if (this.state !== 'playing') return;
    const ft = this.frameDt * 1000;
    this.ftAvg = (this.ftAvg ?? 16) * 0.97 + ft * 0.03;
    this.adaptT = (this.adaptT || 0) + dt;
    if (this.adaptT < 1.5) return;
    let next = this.dynScale;
    if (this.ftAvg > 24 && this.dynScale > 0.55) next = Math.max(0.55, this.dynScale - 0.1);
    else if (this.ftAvg < 15 && this.dynScale < 1) next = Math.min(1, this.dynScale + 0.05);
    if (next !== this.dynScale) {
      this.dynScale = next;
      this.adaptT = 0;
      this.renderer.setPixelRatio(this.basePR * next);
      if (this.composer) { this.composer.setPixelRatio(this.basePR * next); this.composer.setSize(innerWidth, innerHeight); }
      this.effects.setScale(innerHeight * this.renderer.getPixelRatio(), this.camera.fov);
    }
  }

  // Arduino controller: pause combo while driving, full menu navigation elsewhere.
  handleJoystick(dt) {
    const j = this.joy;
    j.poll(dt);
    if (!j.events.size) return;
    const ev = j.events;
    if (ev.has('pause')) {
      if (this.state === 'playing') { this.pause(); return; }
      if (this.state === 'paused') { this.resume(); return; }
    }
    if (this.state === 'playing' || this.state === 'loading') return;
    if (this.state === 'over' && !document.getElementById('gameover').classList.contains('show')) return;
    this.audio.init();
    for (const e of ev) this.ui.navInput(e);
  }

  handleKeys() {
    const I = this.input;
    if (I.wasPressed('Escape') || I.wasPressed('KeyP')) {
      if (this.state === 'playing') this.pause(); else if (this.state === 'paused') this.resume();
    }
    if (I.wasPressed('KeyC')) {
      this.setSetting('camera', this.save.settings.camera === 'top' ? 'chase' : 'top');
      if (this.state === 'playing') this.ui.toast(this.save.settings.camera === 'top' ? 'TOP-DOWN CAMERA' : 'CHASE CAMERA');
    }
    if (I.wasPressed('KeyM')) this.setSetting('sound', !this.save.settings.sound);
    if (I.wasPressed('KeyH')) {
      if (this.state === 'playing') { this.pause(); this.ui.openControls(); } else if (this.ui.current.includes('controls')) this.ui.closeControls();
      else if (this.state === 'menu' || this.state === 'paused') this.ui.openControls();
    }
    if (I.wasPressed('Enter')) {
      if (this.state === 'menu') this.startRun({ intro: this.save.settings.intro !== false });
      else if (this.state === 'over' && document.getElementById('gameover').classList.contains('show')) this.startRun();
    }
    if (I.wasPressed('KeyR') && this.state === 'over' && document.getElementById('gameover').classList.contains('show')) this.startRun();
  }

  updateMenu(dt) {
    this.showAngle += dt * 0.12;
    this.people.update(dt);
    this.humans.update(dt);
    this.placeShowroomCamera();
    const c = this.showcase;
    if (c) {
      for (const w of c.wheels) w.spin.rotation.x = 0;
    }
    this.audio.update({ active: false });
    // headlight glow in showroom at night
    this.headlight.intensity = 0;
  }

  updatePlay(dt) {
    const playing = this.state === 'playing';
    if (this.state === 'intro') this.cine.update(dt);
    const intro = this.state === 'intro';
    for (const k of Object.keys(this.powerTimers)) this.powerTimers[k] = Math.max(0, this.powerTimers[k] - dt);

    // get in / out of vehicles
    this.updateDoor(dt);
    if (playing && !(this.doorAnim && this.doorAnim.mode === 'enter')) {
      const I = this.input, J = this.joy.events;
      const toggle = I.wasPressed('KeyF') || I.wasPressed('KeyE')
        || (this.car && !this.car.weapons && J.has('RHOLD') && this.car.input.throttle === 0)
        || (this.car && this.car.weapons && J.has('LHOLD') && this.car.speed < 2)
        || (!this.car && J.has('R'));
      if (toggle) { if (this.car) this.exitCar(); else this.tryEnterCar(); }
      if (I.wasPressed('KeyQ')) {
        if (!this.car) this.ui.toast(WEAPONS[this.combat.nextWeapon()].name);
        else if (this.car.weapons?.length > 1) this.ui.toast(this.combat.nextVehicleWeapon(this.car));
      }
    }

    if (this.car) {
      const p = this.car;
      const inp = intro ? this.cine.input : playing ? this.input.read() : { steer: 0, throttle: 0, brake: 1, handbrake: false, nitro: false };
      p.input.steer = inp.steer; p.input.throttle = inp.throttle; p.input.brake = inp.brake; p.input.handbrake = inp.handbrake;
      // nitro
      const wasN = p.nitroActive;
      const joyTrigger = p.weapons && this.joy.active && this.joy.raw.rb === 1; // armed: joystick R fires, not nitro
      p.nitroActive = playing && inp.nitro && !joyTrigger && this.nitro > 0.01 && inp.throttle > 0;
      if (p.nitroActive) this.nitro = Math.max(0, this.nitro - dt * 0.3);
      else this.nitro = Math.min(1, this.nitro + dt * 0.018);
      if (p.nitroActive && !wasN) this.audio.nitroStart();
      p.gripMul = this.powerTimers.spikes > 0 ? 0.5 : 1;
      p.speedMul = this.powerTimers.spikes > 0 ? 0.72 : 1;
      if (intro && this.cine.hold) { p.speedMul = 0.001; p.vx *= 0.8; p.vz *= 0.8; }
      // armed vehicle: aim (mouse / right stick / auto-lock) and fire
      if (p.weapons && !intro) {
        const wi = playing ? this.input.readWeapon(this.screenForward()) : { fire: false, aimYaw: null, manual: false };
        if (wi.aimYaw === null && this.input.mouseActive()) {
          const pt = this.mouseGround(1);
          if (pt) { wi.aimYaw = Math.atan2(pt.x - p.x, pt.z - p.z); wi.manual = true; }
        }
        this.combat.vehicleWeapons(p, wi, dt);
      }
      if (p.model === 'tank') this.animateOwnTank(p, dt);
    } else {
      // on foot: move, jump, sprint, aim and shoot
      const av = this.avatar;
      const fi = playing ? this.input.readFoot(this.screenForward()) : { mx: 0, mz: 0, sprint: false, jump: false, fire: false, aimYaw: null, manual: false };
      let aimYaw = fi.aimYaw, manual = fi.manual;
      if (aimYaw === null && this.input.mouseActive()) {
        const pt = this.mouseGround(av.y + 1.2);
        if (pt) { aimYaw = Math.atan2(pt.x - av.x, pt.z - av.z); manual = true; }
      }
      if (aimYaw === null) aimYaw = av.heading;
      av.firing = Math.max(0, av.firing - dt);
      av.aimYaw = manual || av.firing > 0 ? aimYaw : null;
      if (fi.fire && playing && av.state === 'foot' && !av.swimming) this.combat.playerShoot(av, { yaw: aimYaw, manual });
      if (av.state !== 'busy') av.update(dt, fi);
      this.nitro = av.stamina; // the blue bar shows stamina on foot
    }
    const p = this.player;

    this.focus.x = p.x; this.focus.z = p.z;
    this.police.update(dt);
    this.traffic.update(dt);
    this.pickups.update(dt);
    this.people.update(dt);
    this.humans.update(dt);
    this.military.update(dt);
    this.combat.update(dt);
    this.boats.update(dt);
    for (let i = this.abandoned.length - 1; i >= 0; i--) {
      const v = this.abandoned[i];
      if (Math.hypot(v.x - p.x, v.z - p.z) > 320) { this.scene.remove(v.root); v.car.dispose(); this.vehicles.delete(v); this.abandoned.splice(i, 1); }
    }

    // fixed-step physics
    const h = 1 / 60;
    this.acc += dt;
    let steps = 0;
    const grip = this.map.grip;
    const list = [...this.vehicles];
    const onStatic = (i) => this.onStaticHit(i);
    const onCar = (i) => this.onCarHit(i);
    while (this.acc >= h && steps < 4) {
      for (const v of list) v.step(h, grip);
      for (const v of list) { if (v.boat) this.boats.constrain(v); else collideStatic(v, this.city, onStatic); }
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (!list[i].boat === !list[j].boat) collidePair(list[i], list[j], onCar);
      this.acc -= h;
      steps++;
    }
    if (steps === 4) this.acc = 0;

    if (playing) this.updateRules(dt);

    // visuals
    const nightMode = this.isNight;
    for (const v of list) {
      v.sync(dt, v.boat ? WATER_Y + 0.05 + Math.sin(this.time * 2 + v.id) * 0.06 : this.city.groundHeight(v.x, v.z));
      this.vehicleFx(v, dt);
    }
    this.shield.visible = this.powerTimers.shield > 0;
    if (this.shield.visible) {
      this.shield.position.set(p.x, 1, p.z);
      this.shield.material.opacity = 0.12 + Math.sin(this.time * 10) * 0.04 + (this.powerTimers.shield < 2 ? Math.sin(this.time * 30) * 0.08 : 0);
    }
    if (nightMode && p.alive && this.car) {
      this.headlight.intensity = 120;
      this.headlight.position.set(p.x + Math.sin(p.heading) * 2, 1.2, p.z + Math.cos(p.heading) * 2);
      this.headlight.target.position.set(p.x + Math.sin(p.heading) * 20, 0, p.z + Math.cos(p.heading) * 20);
    } else this.headlight.intensity = 0;
    for (let k = this.fountains.length - 1; k >= 0; k--) {
      const f = this.fountains[k];
      f.t -= dt;
      if (Math.random() < 0.8) this.effects.splash(f.x, f.z);
      if (f.t <= 0) this.fountains.splice(k, 1);
    }

    if (!intro) this.updateCamera(dt);
    this.updateAudio();
    if (playing) {
      this.ui.updateHUD(dt);
      this.ui.updateCombatHUD();
      this.ui.updateMissionHUD();
      this.soundscape(dt);
      this.minimap.draw(this, this.save.settings.camera === 'chase' ? p.heading - Math.PI : 0);
    }
  }

  updateRules(dt) {
    const p = this.player;
    this.runTime += dt;
    this.score += dt * 10 * (1 + this.wantedLevel * 0.25);
    this.heat += dt * 1.1;
    // wanted level from heat (missions cap it)
    this.mission?.capHeat();
    let lvl = 0;
    for (let i = 0; i < WANTED.length; i++) if (this.heat >= WANTED[i].heat) lvl = i;
    if (this.mission) lvl = Math.min(lvl, this.mission.def.wantedCap - 1);
    if (lvl > this.wantedLevel) {
      this.wantedLevel = lvl;
      this.maxLevel = Math.max(this.maxLevel, lvl);
      this.audio.levelUp();
      this.ui.toast(lvl === 4 ? `WANTED LEVEL ${lvl + 1}: SWAT TEAMS` : lvl === 5 ? `WANTED LEVEL ${lvl + 1}: ARMY TANKS` : lvl === 6 ? `WANTED LEVEL ${lvl + 1}: AIR STRIKE` : `WANTED LEVEL ${lvl + 1}`, 'bad');
      this.audio.intensity = lvl;
    }

    // your car is scrap: bail out and keep running on foot
    if (this.car && this.car.hp <= 0) {
      const v = this.car;
      this.effects.explosion(v.x, v.z);
      this.audio.explosion();
      v.car.paintMat.color.multiplyScalar(0.25);
      v.destroyed = true;
      this.exitCar(true);
      this.avatar.damage(15);
      this.ui.toast('CAR WRECKED! RUN!', 'bad');
      return;
    }
    // busted: slow + cops touching (car), or officers grabbing you (on foot)
    let touching = 0, near = 0;
    for (const c of this.police.cops) {
      if (!c.alive || c.disabledTimer > 0) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < (this.car ? 8.5 : 4.5)) touching++;
      if (d < 45) near++;
    }
    let grabbing = 0;
    if (!this.car) for (const o of this.people.list) if (o.copFoot && o.arresting && !o.dead && o.mode === 'copFoot') { grabbing++; near++; }
    this.copsNear = near;
    if (this.car) {
      if (p.speed < 4.5 && touching > 0) this.bustTimer += dt * (0.75 + touching * 0.35);
      else this.bustTimer = Math.max(0, this.bustTimer - dt * 1.3);
    } else {
      const pinned = grabbing > 0 || (touching > 0 && p.speed < 1.5);
      if (pinned && this.avatar.state !== 'down') this.bustTimer += dt * (0.7 + grabbing * 0.45);
      else this.bustTimer = Math.max(0, this.bustTimer - dt * 1.6);
    }
    if (this.bustTimer >= this.bustLimit) { this.gameOver('busted'); return; }
    if (p.hp <= 0) { this.gameOver(this.car ? 'wrecked' : 'down'); return; }
    if (this.mission) { this.mission.update(dt); if (this.state !== 'playing') return; }
    this.trophyT = (this.trophyT || 0) - dt;
    if (this.trophyT <= 0) { this.trophyT = 1; this.checkTrophies(); }

    // near misses (register when close, award when we pull away cleanly)
    const sp = this.car ? p.speed : 0;
    for (const v of this.vehicles) {
      if (v === p || !v.alive) continue;
      const d = Math.hypot(v.x - p.x, v.z - p.z);
      const R = (p.W + v.W) / 2 + 2.2;
      if (d < R && sp > 20 && !(v.nmCool > this.time)) {
        if (!v.nmPending && this.time - (v.lastHitP || -9) > 1) v.nmPending = true;
      } else if (v.nmPending && d > R + 1.5) {
        v.nmPending = false;
        v.nmCool = this.time + 4;
        this.nearMisses++;
        this.combo = this.comboT > 0 ? this.combo + 1 : 1;
        this.comboT = 3;
        const pts = 50 * this.combo;
        this.score += pts;
        this.nitro = Math.min(1, this.nitro + 0.07);
        this.audio.nearMiss();
        if (v.kind === 'traffic' && Math.random() < 0.6) this.audio.horn(0);
        this.ui.combo(`NEAR MISS${this.combo > 1 ? ' x' + this.combo : ''}  +${pts}`);
      }
    }
    this.comboT -= dt;

    // drift scoring
    if (p.drift > 5 && p.speed > 14) {
      this.driftScore += dt * p.drift * 12;
      this.driftIdle = 0;
      this.nitro = Math.min(1, this.nitro + dt * 0.04);
    } else if (this.driftScore > 0) {
      this.driftIdle += dt;
      if (this.driftIdle > 0.35) {
        if (this.driftScore > 120) {
          const pts = Math.floor(this.driftScore);
          this.score += pts;
          this.bestDrift = Math.max(this.bestDrift, pts);
          this.ui.combo(`DRIFT  +${pts}`);
        }
        this.driftScore = 0;
      }
    }
  }

  vehicleFx(v, dt) {
    const p = this.player;
    if (v.boat) return;
    const d = Math.hypot(v.x - this.focus.x, v.z - this.focus.z);
    if (d > 110) { v.skidPrev = null; return; }
    const s = v.car.spec;
    const sin = Math.sin(v.heading), cos = Math.cos(v.heading);
    const wx = s.W / 2 - s.ww / 2;
    const rl = [v.x + sin * s.ra - cos * wx, v.z + cos * s.ra + sin * wx];
    const rr = [v.x + sin * s.ra + cos * wx, v.z + cos * s.ra - sin * wx];
    const skidding = (v.drift > 3.2 && v.speed > 6) || (v.braking && v.speed > 16) || (v === p && this.powerTimers.spikes > 0 && v.speed > 5);
    if (skidding) {
      if (v.skidPrev) {
        this.effects.skids.add(v.skidPrev[0], v.skidPrev[1], rl[0], rl[1], v.y);
        this.effects.skids.add(v.skidPrev[2], v.skidPrev[3], rr[0], rr[1], v.y);
      }
      v.skidPrev = [rl[0], rl[1], rr[0], rr[1]];
      const amount = clamp(v.drift / 12, 0.3, 1);
      const theme = this.map.theme;
      if (Math.random() < 0.6) {
        const w = Math.random() < 0.5 ? rl : rr;
        if (theme === 'desert') this.effects.dust(w[0], w[1]);
        else this.effects.tireSmoke(w[0], w[1], amount, theme === 'snow' ? 0.97 : 0.85);
      }
    } else v.skidPrev = null;
    if (v.nitroActive) {
      const ex = v.x - sin * (s.L / 2 + 0.1), ez = v.z - cos * (s.L / 2 + 0.1);
      this.effects.nitro(ex, v.y + s.tailBot + 0.1, ez, -sin, -cos);
    }
    if (v.alive && v.hp < v.maxHp * 0.35 && Math.random() < dt * 10) {
      this.effects.damageSmoke(v.x + sin * (s.L / 2 - 0.6), v.y + s.hoodY, v.z + cos * (s.L / 2 - 0.6), v.hp < v.maxHp * 0.15);
    }
  }

  updateCamera(dt) {
    const p = this.player;
    const cam = this.camera;
    const mode = this.save.settings.camera;
    const sp = p.speed;
    if (!this.camTarget) this.camTarget = new THREE.Vector3(p.x, 0, p.z);
    let fov = 50 + (p.nitroActive ? 8 : 0);
    if (mode === 'top') {
      const look = clamp(sp / 50, 0, 1) * 0.55;
      const tx = p.x + clamp(p.vx * look, -22, 22), tz = p.z + clamp(p.vz * look, -22, 22);
      this.camTarget.x = damp(this.camTarget.x, tx, 4, dt);
      this.camTarget.z = damp(this.camTarget.z, tz, 4, dt);
      const zoom = (this.car ? 1 + clamp(sp / 55, 0, 1) * 0.3 + this.wantedLevel * 0.03 : 0.5 + this.wantedLevel * 0.015);
      const want = new THREE.Vector3(this.camTarget.x, 42 * zoom, this.camTarget.z + 21 * zoom);
      cam.position.x = damp(cam.position.x, want.x, 6, dt);
      cam.position.y = damp(cam.position.y, want.y, 3, dt);
      cam.position.z = damp(cam.position.z, want.z, 6, dt);
      cam.lookAt(this.camTarget.x, 0, this.camTarget.z);
    } else {
      const back = 11 + clamp(sp / 50, 0, 1) * 3;
      const want = new THREE.Vector3(p.x - Math.sin(p.heading) * back, 5.2, p.z - Math.cos(p.heading) * back);
      cam.position.x = damp(cam.position.x, want.x, 5, dt);
      cam.position.y = damp(cam.position.y, want.y, 5, dt);
      cam.position.z = damp(cam.position.z, want.z, 5, dt);
      this.camTarget.set(p.x + Math.sin(p.heading) * 6, 1.2, p.z + Math.cos(p.heading) * 6);
      cam.lookAt(this.camTarget);
      fov += clamp(sp / 55, 0, 1) * 10;
    }
    if (this.shake > 0.001) {
      const s = this.shake;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
      this.shake = damp(this.shake, 0, 6, dt);
    }
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = lerp(cam.fov, fov, Math.min(1, dt * 4));
      cam.updateProjectionMatrix();
      this.effects.setScale(innerHeight * this.renderer.getPixelRatio(), cam.fov);
    }
  }

  updateAudio() {
    const p = this.player;
    const n = this.police.nearestCopDistance();
    const siren = n.d < 200 ? (1 - n.d / 200) * 0.09 * Math.min(1.5, 0.6 + this.copsNear * 0.2) : 0;
    this.audio.update({
      active: this.state === 'playing' || this.state === 'over' || this.state === 'intro',
      speedRatio: clamp(p.speed / (p.stats.speed * 1.3), 0, 1),
      throttle: p.input.throttle,
      drift: p.drift > 3.5 && p.speed > 8 ? p.drift : (p.braking && p.speed > 16 ? 6 : 0),
      siren, sirenPan: n.dx / 60,
      rotor: Math.min(0.45, this.police.rotorVolume() + this.military.rotorVolume()),
      nitro: p.nitroActive,
      foot: !this.car,
    });
  }

  render() {
    // keep the shadow frustum + sky centred on the action
    const f = this.focus;
    const snap = 2;
    const fx = Math.round(f.x / snap) * snap, fz = Math.round(f.z / snap) * snap;
    if (this.sunDir) {
      this.sun.position.set(fx + this.sunDir.x * 200, this.sunDir.y * 200, fz + this.sunDir.z * 200);
      this.sun.target.position.set(fx, 0, fz);
    }
    this.sky.position.copy(this.camera.position);
    this.physSky.position.copy(this.camera.position);
    const p = this.player;
    cutout.uCutOn.value = p && this.state !== 'menu' ? 1 : 0;
    if (p) cutout.uCutPos.value.set(p.x, p.y + 1, p.z);
    cutout.uCamPos.value.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    if (this.q.bloom && this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}

// ---------------------------------------------------------------- dev/testing helpers
// Fast-forward the simulation without rendering. With autopilot, the player car
// drives itself through the street grid, fleeing from the nearest police car.
Game.prototype.simulate = function (seconds, autopilot = true, dt = 1 / 30) {
  const city = this.city;
  const orig = this.input.read.bind(this.input);
  const ap = this.ap || (this.ap = { path: [], t: 0 });
  if (autopilot) {
    this.input.read = () => {
      const p = this.player;
      if (!ap.path.length || ap.t <= 0) {
        ap.t = 3;
        // flee: pick a node far from the nearest cop, roughly ahead of us
        const n = this.police.cops.filter((c) => c.alive).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
        let best = null, bs = -1e9;
        for (let k = 0; k < 20; k++) {
          const id = Math.floor(Math.random() * (CITY.N + 1) ** 2);
          const np = city.nodePos(id);
          const d = Math.hypot(np.x - p.x, np.z - p.z);
          if (d < 120 || d > 400) continue;
          const away = n ? Math.hypot(np.x - n.x, np.z - n.z) : 0;
          const ahead = (np.x - p.x) * Math.sin(p.heading) + (np.z - p.z) * Math.cos(p.heading);
          const sc = away + ahead * 0.5;
          if (sc > bs) { bs = sc; best = id; }
        }
        if (best !== null) ap.path = city.findPath(city.nearestNode(p.x, p.z), best);
      }
      ap.t -= dt;
      let tx = p.x + Math.sin(p.heading) * 10, tz = p.z + Math.cos(p.heading) * 10;
      if (ap.path.length) {
        const wp = city.nodePos(ap.path[0]);
        if (Math.hypot(wp.x - p.x, wp.z - p.z) < 10) ap.path.shift();
        tx = wp.x; tz = wp.z;
      }
      const err = Math.atan2(Math.sin(Math.atan2(tx - p.x, tz - p.z) - p.heading), Math.cos(Math.atan2(tx - p.x, tz - p.z) - p.heading));
      if (p.speed < 1.5) ap.stuck = (ap.stuck || 0) + dt; else ap.stuck = 0;
      if (ap.stuck > 1) ap.rev = 0.8;
      if (ap.rev > 0) { ap.rev -= dt; return { steer: clamp(err * 2, -1, 1), throttle: 0, brake: 1, handbrake: false, nitro: false }; }
      return { steer: clamp(-err * 2.2, -1, 1), throttle: Math.abs(err) > 1.2 ? 0.4 : 1, brake: 0, handbrake: Math.abs(err) > 0.8 && p.speed > 18, nitro: this.nitro > 0.5 };
    };
  }
  const steps = Math.round(seconds / dt);
  const t0 = performance.now();
  for (let i = 0; i < steps && (this.state === 'playing' || this.state === 'over'); i++) {
    this.time += dt;
    this.updatePlay(dt);
    this.city.update(dt, this.time);
    this.effects.update(dt, this.camera.position.x, this.camera.position.z);
  }
  this.input.read = orig;
  return (performance.now() - t0) / steps;
};

window.game = new Game();
void CITY;
