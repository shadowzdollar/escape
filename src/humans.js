// Level-3 humans: real rigged character models (CC0, Quaternius "Ultimate Animated
// Character Pack") driven by motion-captured animation clips. The nearest people to
// the camera get a full skinned character; everyone else keeps the lightweight
// procedural body from people.js (distance LOD). Each character is merged into one
// skinned mesh with baked vertex colours, so it costs a single draw call, and its
// clothing / skin colours are varied per person.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { clamp, wrapAngle } from './utils.js';

const BASE = `${import.meta.env.BASE_URL}models/people/`;
const CIVILIANS = ['business', 'casual', 'woman2', 'worker', 'hoodie', 'punk', 'punk2', 'farmer', 'adventurer'];
const WEIGHTS = { business: 3, casual: 4, woman2: 4, worker: 2, hoodie: 3, punk: 2, punk2: 3, farmer: 1, adventurer: 1 };
const KEEP = new Set(['skin', 'skin_darker', 'eye', 'eyes', 'eyebrows', 'visor', 'moustache', 'earrings', 'gold', 'white']);
const SKIN_TONES = ['#f3cfa6', '#e8b88a', '#d49a6a', '#b07548', '#8d5524', '#6b3e1f', '#c68642'];
const MODEL_HEIGHT = 1.825;
const WALK_REF = 1.35; // m/s at timeScale 1 (tuned so feet don't slide)
const RUN_REF = 4.6;

export class Humans {
  constructor(game) {
    this.game = game;
    this.ready = false;
    this.templates = {};
    this.clips = {};
    this.pool = {};      // kind -> [free instances]
    this.active = new Set();
    this.max = 24;
    this.radius = 62;
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.04 });
    this.propMats = {
      phone: new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.3, metalness: 0.6 }),
      gun: new THREE.MeshStandardMaterial({ color: 0x1d1f1b, roughness: 0.5, metalness: 0.6 }),
      bag: new THREE.MeshStandardMaterial({ color: 0x6b7f3a, roughness: 0.9 }),
    };
    this.propGeo = {
      phone: new THREE.BoxGeometry(0.07, 0.13, 0.012),
      gun: (() => { const g = new THREE.BoxGeometry(0.06, 0.1, 0.75); g.translate(0, 0, 0.2); return g; })(),
      bag: new THREE.IcosahedronGeometry(0.2, 1).scale(1, 1.15, 0.9),
    };
    this.tmpV = new THREE.Vector3();
    this.variants = {};
  }

  // ---------------------------------------------------------------- loading
  async load() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const draco = new DRACOLoader();
    draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    loader.setDRACOLoader(draco);
    const kinds = [...CIVILIANS, 'swat'];
    await Promise.all(kinds.map(async (k) => {
      const gltf = await loader.loadAsync(`${BASE}${k}.glb`);
      if (gltf.animations.length) for (const c of gltf.animations) this.clips[c.name.replace('CharacterArmature|', '')] = c;
      this.templates[k] = this.buildTemplate(gltf.scene);
    }));
    for (const k of kinds) this.variants[k] = this.bakeVariants(k);
    // pre-create a few instances per kind so nothing is cloned mid-chase
    for (const k of kinds) for (let i = 0; i < (k === 'swat' ? 2 : 2); i++) this.pool[k] = [...(this.pool[k] || []), this.acquire(k)];
    this.ready = true;
  }

  // A handful of recoloured copies of each character's colour buffer:
  // hue-shifted clothing and different skin tones. Uniforms keep their colours.
  bakeVariants(kind) {
    let body = null;
    this.templates[kind].traverse((o) => { if (o.isSkinnedMesh) body = o; });
    const src = body.geometry.attributes.color.array;
    const { tint, skin } = body.geometry.userData;
    const uniform = kind === 'worker' || kind === 'swat';
    const out = [];
    const c = new THREE.Color(), hsl = {};
    const n = uniform ? 4 : 8;
    for (let vi = 0; vi < n; vi++) {
      const skinC = new THREE.Color(SKIN_TONES[(vi * 3 + kind.length) % SKIN_TONES.length]);
      const shift = uniform || vi === 0 ? 0 : ((vi * 0.137) % 0.35) - 0.17 + (vi % 3 === 0 ? 0.5 : 0);
      const arr = new Float32Array(src.length);
      for (let v = 0; v < tint.length; v++) {
        if (skin[v]) { arr[v * 3] = skinC.r; arr[v * 3 + 1] = skinC.g; arr[v * 3 + 2] = skinC.b; continue; }
        c.setRGB(src[v * 3], src[v * 3 + 1], src[v * 3 + 2]);
        if (tint[v] && shift) { c.getHSL(hsl); c.setHSL(((hsl.h + shift) % 1 + 1) % 1, hsl.s, hsl.l); }
        arr[v * 3] = c.r; arr[v * 3 + 1] = c.g; arr[v * 3 + 2] = c.b;
      }
      out.push(new THREE.BufferAttribute(arr, 3));
    }
    // special looks
    const dark = new Float32Array(src.length), olive = new Float32Array(src.length);
    for (let v = 0; v < tint.length; v++) {
      c.setRGB(src[v * 3], src[v * 3 + 1], src[v * 3 + 2]);
      if (tint[v]) { dark.set([c.r * 0.18, c.g * 0.18, c.b * 0.18], v * 3); c.getHSL(hsl); c.setHSL(0.22, 0.35, Math.min(0.35, hsl.l)); olive.set([c.r, c.g, c.b], v * 3); } else { dark.set([c.r, c.g, c.b], v * 3); olive.set([c.r, c.g, c.b], v * 3); }
    }
    out.dark = new THREE.BufferAttribute(dark, 3);
    out.olive = new THREE.BufferAttribute(olive, 3);
    return out;
  }

  // Merge every skinned sub-mesh into one geometry bound to a unified skeleton,
  // baking each material's colour into vertex colours (plus a "tint" mask for
  // clothing and a "skin" mask so both can be recoloured per person).
  buildTemplate(scene) {
    scene.updateMatrixWorld(true);
    const skinned = [];
    scene.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
    const bones = [];
    const inverses = [];
    const index = new Map();
    for (const m of skinned) {
      m.skeleton.bones.forEach((b, i) => {
        if (!index.has(b.name)) { index.set(b.name, bones.length); bones.push(b); inverses.push(m.skeleton.boneInverses[i].clone()); }
      });
    }
    const parts = [];
    for (const m of skinned) {
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
      const n = g.attributes.position.count;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const col = new Float32Array(n * 3), tint = new Float32Array(n), skin = new Float32Array(n);
      const groups = g.groups.length ? g.groups : [{ start: 0, count: n, materialIndex: 0 }];
      for (const gr of groups) {
        const mat = mats[gr.materialIndex] || mats[0];
        const c = mat.color || new THREE.Color(1, 1, 1);
        const nm = (mat.name || '').toLowerCase();
        const isSkin = nm.startsWith('skin');
        const keep = KEEP.has(nm) || nm.includes('hair') || nm.includes('eye');
        for (let v = gr.start; v < Math.min(n, gr.start + gr.count); v++) {
          col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
          tint[v] = !isSkin && !keep ? 1 : 0;
          skin[v] = isSkin ? 1 : 0;
        }
      }
      // remap bone indices to the unified skeleton
      const si = g.attributes.skinIndex;
      for (let v = 0; v < si.count; v++) {
        for (let k = 0; k < 4; k++) {
          const old = si.getComponent(v, k);
          const b = m.skeleton.bones[old];
          si.setComponent(v, k, b ? index.get(b.name) : 0);
        }
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', g.attributes.position);
      out.setAttribute('normal', g.attributes.normal);
      out.setAttribute('skinIndex', si);
      out.setAttribute('skinWeight', g.attributes.skinWeight);
      out.setAttribute('color', new THREE.BufferAttribute(col, 3));
      out.userData = { tint, skin };
      parts.push(out);
    }
    // concatenate
    let total = 0;
    for (const p of parts) total += p.attributes.position.count;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
    const sIdx = new Uint16Array(total * 4), sW = new Float32Array(total * 4), tint = new Float32Array(total), skin = new Float32Array(total);
    let o = 0;
    for (const p of parts) {
      const c = p.attributes.position.count;
      for (let v = 0; v < c; v++) {
        pos[(o + v) * 3] = p.attributes.position.getX(v); pos[(o + v) * 3 + 1] = p.attributes.position.getY(v); pos[(o + v) * 3 + 2] = p.attributes.position.getZ(v);
        nor[(o + v) * 3] = p.attributes.normal.getX(v); nor[(o + v) * 3 + 1] = p.attributes.normal.getY(v); nor[(o + v) * 3 + 2] = p.attributes.normal.getZ(v);
        for (let k = 0; k < 4; k++) { sIdx[(o + v) * 4 + k] = p.attributes.skinIndex.getComponent(v, k); sW[(o + v) * 4 + k] = p.attributes.skinWeight.getComponent(v, k); }
      }
      col.set(p.attributes.color.array, o * 3);
      tint.set(p.userData.tint, o);
      skin.set(p.userData.skin, o);
      o += c;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(sIdx, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sW, 4));
    geo.computeBoundingSphere();
    geo.userData = { tint, skin };
    // replace the original meshes with the merged one
    const first = skinned[0];
    const parent = first.parent;
    for (const m of skinned) m.parent.remove(m);
    const mesh = new THREE.SkinnedMesh(geo, this.material);
    mesh.name = 'body';
    parent.add(mesh);
    mesh.bind(new THREE.Skeleton(bones, inverses), first.bindMatrix);
    return scene;
  }

  // ---------------------------------------------------------------- instances
  kindFor(p) {
    if (p.rigKind) return p.rigKind;
    if (p.mode === 'guard' || p.soldier || p.copFoot) return (p.rigKind = 'swat');
    if (p.bags) return (p.rigKind = 'hoodie');
    let total = 0;
    for (const k of CIVILIANS) total += WEIGHTS[k];
    let r = Math.random() * total;
    for (const k of CIVILIANS) { r -= WEIGHTS[k]; if (r <= 0) return (p.rigKind = k); }
    return (p.rigKind = 'casual');
  }

  acquire(kind) {
    const free = this.pool[kind] || (this.pool[kind] = []);
    if (free.length) return free.pop();
    const root = SkeletonUtils.clone(this.templates[kind]);
    let body = null;
    root.traverse((o) => { if (o.isSkinnedMesh) body = o; });
    // per-instance colour buffer (geometry attributes otherwise shared)
    const geo = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'skinIndex', 'skinWeight']) geo.setAttribute(k, body.geometry.attributes[k]);
    geo.boundingSphere = body.geometry.boundingSphere;
    geo.setAttribute('color', body.geometry.attributes.color);
    geo.userData = body.geometry.userData;
    body.geometry = geo;
    body.castShadow = true;
    body.frustumCulled = false;
    const bones = {};
    root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    for (const [name, clip] of Object.entries(this.clips)) actions[name] = mixer.clipAction(clip);
    const inst = { kind, root, body, bones, mixer, actions, current: null, props: {} };
    return inst;
  }

  release(inst) {
    this.game.scene.remove(inst.root);
    for (const k of Object.keys(inst.props)) { inst.props[k].parent?.remove(inst.props[k]); }
    inst.props = {};
    inst.mixer.stopAllAction();
    inst.current = null;
    inst.person = null;
    this.pool[inst.kind].push(inst);
  }

  // Attach a prop to a bone, cancelling the armature's internal scale so the
  // prop keeps its real-world size and offset.
  attach(inst, boneName, mesh, x = 0, y = 0, z = 0) {
    const bone = inst.bones[boneName];
    if (!bone) return;
    inst.root.updateMatrixWorld(true);
    const ws = bone.getWorldScale(this.tmpV).x || 1;
    const k = inst.root.scale.x / ws;
    mesh.scale.multiplyScalar(k);
    mesh.position.set(x * k, y * k, z * k);
    bone.add(mesh);
  }

  // Recolour clothing (hue shift of the tinted vertices) and skin for this person.
  dress(inst, p) {
    const V = this.variants[inst.kind];
    let attr;
    if (p.mode === 'guard' || p.soldier) attr = V.olive;
    else if (p.bags || p.outfit === 'dark') attr = V.dark;
    else attr = V[(p.variant ??= Math.floor(Math.random() * 1e6)) % V.length];
    inst.body.geometry.setAttribute('color', attr);
    // props on the hands
    if (p.bags) {
      for (const [side, bone] of [['bagL', 'WristL'], ['bagR', 'WristR']]) {
        const m = new THREE.Mesh(this.propGeo.bag, this.propMats.bag);
        this.attach(inst, bone, m, 0, 0.22, 0);
        inst.props[side] = m;
      }
    }
    if (p.mode === 'guard' || p.soldier || p.armed || p.copFoot) {
      const gun = new THREE.Mesh(this.propGeo.gun, this.propMats.gun);
      gun.rotation.x = Math.PI / 2;
      if (p.armed || p.copFoot) gun.scale.set(1, 1, 0.42);
      this.attach(inst, 'WristR', gun, 0, 0.08, 0.02);
      inst.props.gun = gun;
    }
    const phone = new THREE.Mesh(this.propGeo.phone, this.propMats.phone);
    phone.visible = false;
    this.attach(inst, 'WristR', phone, 0, 0.1, 0.04);
    inst.props.phone = phone;
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    if (!this.ready) return;
    const g = this.game, people = g.people.list;
    const fx = g.focus.x, fz = g.focus.z;
    // choose who deserves a full model: nearest people (not seated) within range
    const R = this.radius;
    const cand = [];
    for (const p of people) {
      if (p.mode === 'sit') continue;
      const d = Math.hypot(p.x - fx, p.z - fz);
      if (d < R + (p.rig ? 14 : 0) || p.priority) cand.push({ p, d: d - (p.rig ? 10 : 0) - (p.priority ? 1000 : 0) - (p.copFoot ? 30 : 0) });
    }
    cand.sort((a, b) => a.d - b.d);
    const want = new Set();
    for (let i = 0; i < Math.min(this.max, cand.length); i++) want.add(cand[i].p);
    const alive = new Set(people);
    for (const inst of [...this.active]) {
      if (!want.has(inst.person) || !alive.has(inst.person)) {
        if (inst.person) inst.person.rig = null;
        this.active.delete(inst);
        this.release(inst);
      }
    }
    let budget = 3; // new assignments per frame (spreads the cost)
    for (const p of want) {
      if (p.rig) continue;
      if (budget-- <= 0) break;
      const inst = this.acquire(this.kindFor(p));
      inst.person = p;
      p.rig = inst;
      inst.root.scale.setScalar(p.height / MODEL_HEIGHT);
      this.dress(inst, p);
      g.scene.add(inst.root);
      this.active.add(inst);
      this.play(inst, this.clipFor(p), 0);
    }
    // only the closest few cast real shadows (skinned shadow passes are costly)
    const ranked = [...this.active].sort((a, b) => Math.hypot(a.person.x - fx, a.person.z - fz) - Math.hypot(b.person.x - fx, b.person.z - fz));
    ranked.forEach((inst, i) => { inst.body.castShadow = i < 6; });
    for (const inst of this.active) this.drive(inst, dt);
  }

  clipFor(p) {
    if (p.dead && p.mode === 'down') return p.hitT < 0.3 ? 'HitRecieve' : 'Death';
    // armed characters (player on foot, police officers)
    if ((p.combatPose || p.copFoot) && p.mode !== 'down' && p.mode !== 'getup') {
      if (p.swim) return (p.swimBlend || 0) > 0.5 ? 'Run' : 'Walk';
      if (p.arresting) return 'Punch_Right';
      if (p.speed > 1.0) return p.firing ? 'Run_Shoot' : (p.speed > 2.3 ? 'Run' : 'Walk');
      if (p.firing) return 'Idle_Gun_Shoot';
      return p.aiming ? 'Idle_Gun_Pointing' : 'Idle_Gun';
    }
    switch (p.mode) {
      case 'down': return p.hitT === undefined || p.hitT < 0.35 ? 'HitRecieve' : 'Death';
      case 'getup': return 'Death';
      case 'dodge': return 'Roll';
      case 'guard': return 'Idle_Gun_Pointing';
      case 'talk': {
        const c = p.cluster;
        return c && c.members[c.speaker] === p ? (Math.sin(this.game.time * 0.9 + p.phase) > 0.6 ? 'Wave' : 'Interact') : 'Idle_Neutral';
      }
    }
    if (p.film && p.speed < 0.3) return 'Idle_Gun_Pointing';
    if (p.startle > 0 && p.speed < 1) return 'HitRecieve_2';
    if (p.speed > 2.3) return 'Run';
    if (p.speed > 0.18) return 'Walk';
    return p.idleClip ??= (Math.random() < 0.5 ? 'Idle' : 'Idle_Neutral');
  }

  play(inst, name, fade = 0.25) {
    if (inst.current === name) return;
    const next = inst.actions[name];
    if (!next) return;
    const once = name === 'Roll' || name === 'HitRecieve' || name === 'HitRecieve_2' || name === 'Death';
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.enabled = true;
    next.setEffectiveTimeScale(1).setEffectiveWeight(1);
    const prev = inst.current && inst.actions[inst.current];
    if (prev && fade > 0) next.crossFadeFrom(prev, fade, false); else if (prev) prev.stop();
    next.play();
    inst.current = name;
  }

  drive(inst, dt) {
    const p = inst.person;
    if (p.mode === 'down') p.hitT = (p.hitT || 0) + dt; else p.hitT = undefined;
    const name = this.clipFor(p);
    // getting up: play the fall backwards
    if (p.mode === 'getup') {
      if (inst.current !== 'getupRev') {
        const a = inst.actions.Death;
        a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
        a.time = a.getClip().duration; a.play();
        const prev = inst.current && inst.current !== 'Death' && inst.actions[inst.current];
        if (prev) prev.stop();
        inst.current = 'getupRev';
      }
      inst.actions.Death.setEffectiveTimeScale(-1.1);
    } else {
      if (inst.current === 'getupRev') { inst.actions.Death.stop(); inst.current = null; }
      this.play(inst, name, name === 'Roll' || name.startsWith('Hit') ? 0.1 : 0.25);
      const a = inst.actions[name];
      if (name === 'Walk') a.setEffectiveTimeScale(p.swim ? 0.4 : clamp(p.speed / WALK_REF, 0.35, 1.8));
      else if (name === 'Run') a.setEffectiveTimeScale(p.swim ? 0.55 + p.speed * 0.14 : clamp(p.speed / RUN_REF, 0.6, 2.4));
      else if (a) a.setEffectiveTimeScale(1);
    }
    inst.mixer.update(dt);
    // placement: the physics body position; the clip itself animates falling
    inst.root.position.set(p.x, p.y, p.z);
    if (p.swim) {
      // front crawl: body tips forward to horizontal and rises to the surface
      const k = p.swimBlend || 0;
      inst.root.rotation.set(k * 1.38, p.heading, Math.sin(this.game.time * 5.5) * 0.12 * k, 'YXZ');
      inst.root.position.y = p.y + k * 1.1 + Math.sin(this.game.time * 3) * 0.04;
    } else inst.root.rotation.set(0, p.heading, 0, 'YXZ');
    // head turns toward whatever the person is looking at
    const head = inst.bones.Head;
    if (head && p.look && p.mode !== 'down' && p.mode !== 'getup') {
      const yaw = clamp(wrapAngle(Math.atan2(p.look.x - p.x, p.look.z - p.z) - p.heading), -1.1, 1.1);
      p.headYawS = (p.headYawS || 0) + (yaw - (p.headYawS || 0)) * Math.min(1, dt * 6);
    } else if (p.headYawS) p.headYawS *= Math.max(0, 1 - dt * 4);
    if (head && p.headYawS) head.rotateY(p.headYawS);
    if (inst.props.phone) inst.props.phone.visible = !!(p.phoneOut || p.film) && p.mode !== 'down';
  }

  releaseAll() {
    for (const inst of [...this.active]) { if (inst.person) inst.person.rig = null; this.release(inst); }
    this.active.clear();
  }
}
