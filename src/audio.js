// Fully synthesized audio: engine, siren, tyres, rotor, one-shots and adaptive music.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.platformMuted = false;
    this.adMuted = false;
    this.tabHidden = false;
    this.musicOn = true;
    this.intensity = 0; // 0..4 music layers
  }

  get isMuted() {
    return !!(this.muted || this.platformMuted || this.adMuted || this.tabHidden);
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.isMuted) {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = this.isMuted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.musicOn ? 0.32 : 0; this.musicBus.connect(this.master);

    // white noise buffer
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.buildEngine();
    this.buildSiren();
    this.buildLoops();
    this.startMusic();
  }

  refreshGain() {
    const m = this.isMuted;
    if (m) window.speechSynthesis?.cancel?.();
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.04);
    }
  }
  setMuted(m) {
    this.muted = !!m;
    this.refreshGain();
  }
  setPlatformMuted(m) {
    this.platformMuted = !!m;
    this.refreshGain();
  }
  setAdMuted(m) {
    this.adMuted = !!m;
    this.refreshGain();
  }
  setTabHidden(hidden) {
    this.tabHidden = !!hidden;
    this.refreshGain();
    if (hidden && this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    } else if (!hidden && this.ctx && this.ctx.state === 'suspended' && !this.isMuted) {
      this.ctx.resume().catch(() => {});
    }
  }
  setMusic(on) {
    this.musicOn = on;
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.1);
  }

  noiseSource(loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise; s.loop = loop;
    return s;
  }

  buildEngine() {
    const ctx = this.ctx;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 600; this.engFilter.Q.value = 3;
    this.eng1 = ctx.createOscillator(); this.eng1.type = 'sawtooth'; this.eng1.frequency.value = 50;
    this.eng2 = ctx.createOscillator(); this.eng2.type = 'square'; this.eng2.frequency.value = 25;
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    this.eng1.connect(this.engFilter); this.eng2.connect(g2).connect(this.engFilter);
    this.engFilter.connect(this.engGain).connect(this.sfx);
    this.eng1.start(); this.eng2.start();
  }

  buildSiren() {
    const ctx = this.ctx;
    this.sirenGain = ctx.createGain(); this.sirenGain.gain.value = 0;
    this.sirenPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 900;
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.55;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 320;
    lfo.connect(lfoGain).connect(osc.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
    osc.connect(f).connect(this.sirenGain);
    if (this.sirenPan) this.sirenGain.connect(this.sirenPan).connect(this.sfx); else this.sirenGain.connect(this.sfx);
    osc.start(); lfo.start();
    this.sirenLfo = lfo;
  }

  buildLoops() {
    const ctx = this.ctx;
    // tyre squeal
    const skid = this.noiseSource();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 6;
    this.skidGain = ctx.createGain(); this.skidGain.gain.value = 0;
    skid.connect(bp).connect(this.skidGain).connect(this.sfx);
    skid.start();
    // helicopter rotor chop
    const rot = this.noiseSource();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    const chop = ctx.createGain(); chop.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 13;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.5;
    const bias = ctx.createConstantSource ? ctx.createConstantSource() : null;
    lfo.connect(lfoG).connect(chop.gain);
    if (bias) { bias.offset.value = 0.5; bias.connect(chop.gain); bias.start(); }
    this.rotorGain = ctx.createGain(); this.rotorGain.gain.value = 0;
    rot.connect(lp).connect(chop).connect(this.rotorGain).connect(this.sfx);
    rot.start(); lfo.start();
    // ambient (rain/wind)
    const amb = this.noiseSource();
    this.ambFilter = ctx.createBiquadFilter(); this.ambFilter.type = 'highpass'; this.ambFilter.frequency.value = 1500;
    this.ambGain = ctx.createGain(); this.ambGain.gain.value = 0;
    amb.connect(this.ambFilter).connect(this.ambGain).connect(this.sfx);
    amb.start();
  }

  setAmbient(kind) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (kind === 'rain') { this.ambFilter.type = 'highpass'; this.ambFilter.frequency.setValueAtTime(1500, t); this.ambGain.gain.setTargetAtTime(0.05, t, 0.5); } else if (kind === 'wind') { this.ambFilter.type = 'lowpass'; this.ambFilter.frequency.setValueAtTime(500, t); this.ambGain.gain.setTargetAtTime(0.035, t, 0.5); } else this.ambGain.gain.setTargetAtTime(0, t, 0.3);
  }

  // Continuous state from the game each frame, tuned per vehicle category.
  update({ speedRatio = 0, throttle = 0, active = false, drift = 0, siren = 0, sirenPan = 0, rotor = 0, nitro = false, foot = false, category = 'compact' }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const rpm = 0.25 + speedRatio * 0.75;
    // Per-category engine profiles: base Hz, rev span, harmonic ratio, filter brightness
    const prof = {
      compact: { base: 44, span: 118, sub: 0.5,  flt: 400, gain: 0.095 },
      muscle:  { base: 32, span: 96,  sub: 0.5,  flt: 320, gain: 0.115 },
      exotic:  { base: 62, span: 175, sub: 1.5,  flt: 620, gain: 0.105 },
      heavy:   { base: 26, span: 64,  sub: 0.5,  flt: 240, gain: 0.125 },
      boat:    { base: 36, span: 108, sub: 0.5,  flt: 380, gain: 0.105 },
      tank:    { base: 22, span: 52,  sub: 0.5,  flt: 210, gain: 0.135 },
    }[category] || { base: 42, span: 115, sub: 0.5, flt: 380, gain: 0.1 };
    const gear = Math.min(4, Math.floor(speedRatio * 5));
    const inGear = speedRatio * 5 - gear;
    const r = active ? 0.28 + inGear * 0.56 + gear * 0.06 + throttle * 0.12 : 0.2;
    const f = prof.base + r * prof.span * (nitro ? 1.18 : 1);
    this.eng1.frequency.setTargetAtTime(f, t, 0.05);
    this.eng2.frequency.setTargetAtTime(f * prof.sub, t, 0.05);
    this.engFilter.frequency.setTargetAtTime(prof.flt + throttle * 900 + rpm * 750, t, 0.08);
    this.engGain.gain.setTargetAtTime(active && !foot ? prof.gain + throttle * 0.07 : 0, t, 0.1);
    this.skidGain.gain.setTargetAtTime(active && category !== 'boat' ? Math.min(0.16, drift * 0.02) : 0, t, 0.05);
    this.sirenGain.gain.setTargetAtTime(active ? Math.min(0.09, siren) : 0, t, 0.2);
    if (this.sirenPan) this.sirenPan.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, sirenPan)), t, 0.2);
    this.rotorGain.gain.setTargetAtTime(active ? Math.min(0.35, rotor) : 0, t, 0.3);
  }

  // ------------------------------------------------------------ one-shots
  env(node, t, a, peak, decay) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.linearRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
  }
  tone(type, f0, f1, dur, vol, delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.005, vol, dur);
    o.connect(g).connect(this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }
  noiseHit(freq, dur, vol, type = 'lowpass', delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const s = this.noiseSource(false);
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain();
    this.env(g, t, 0.003, vol, dur);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  crash(intensity) {
    const k = Math.min(1, intensity / 25);
    this.noiseHit(500 + k * 1800, 0.25 + k * 0.35, 0.25 + k * 0.5);
    this.tone('sine', 110, 40, 0.3, 0.3 * k);
    if (k > 0.4) this.noiseHit(4000, 0.4, 0.12 * k, 'highpass', 0.02);
  }
  smash() {
    this.noiseHit(2500, 0.15, 0.25, 'highpass');
    this.tone('triangle', 700 + Math.random() * 300, 500, 0.3, 0.12);
  }
  coin() {
    this.tone('square', 988, 988, 0.07, 0.08);
    this.tone('square', 1319, 1319, 0.16, 0.08, 0.07);
  }
  powerup() {
    this.tone('sawtooth', 300, 1400, 0.35, 0.12);
    this.tone('sine', 600, 2400, 0.35, 0.1, 0.05);
  }
  nitroStart() { this.noiseHit(1200, 0.6, 0.25, 'bandpass'); }
  explosion() {
    this.noiseHit(380, 1.4, 0.9);
    this.tone('sine', 70, 28, 1.0, 0.6);
  }
  nearMiss() { this.tone('sine', 1200, 1800, 0.12, 0.06); }
  gunshot(kind = 'pistol', dist = 0) {
    if (!this.ctx) return;
    const k = Math.max(0.1, 1 - dist / 120);
    if (kind === 'carbine') { this.tone('sawtooth', 1400, 260, 0.09, 0.1 * k); this.tone('sine', 520, 180, 0.07, 0.12 * k); this.noiseHit(3600, 0.04, 0.1 * k, 'highpass'); return; }
    if (kind === 'mg' || kind === 'smg') { this.noiseHit(2400, 0.07, 0.22 * k, 'highpass'); this.tone('square', 180, 90, 0.05, 0.08 * k); return; }
    this.noiseHit(1800, 0.12, 0.4 * k, 'bandpass');
    this.noiseHit(500, 0.18, 0.25 * k);
    this.tone('sine', 160, 60, 0.12, 0.2 * k);
  }
  doorSlam() { this.noiseHit(400, 0.1, 0.35); this.tone('sine', 110, 70, 0.1, 0.25); }
  jump() { this.noiseHit(700, 0.06, 0.08); }
  splash() { this.noiseHit(1200, 0.5, 0.25, 'bandpass'); this.noiseHit(400, 0.4, 0.2); }
  thud() { this.noiseHit(300, 0.15, 0.35); this.tone('sine', 140, 60, 0.15, 0.25); }
  alarm(on) {
    if (!this.ctx) return;
    if (on && !this.alarmNode) {
      const ctx = this.ctx;
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 960;
      const trem = ctx.createOscillator(); trem.frequency.value = 14;
      const tg = ctx.createGain(); tg.gain.value = 0.5;
      const g = ctx.createGain(); g.gain.value = 0.5;
      trem.connect(tg).connect(g.gain);
      const out = ctx.createGain(); out.gain.value = 0.05;
      o.connect(g).connect(out).connect(this.sfx);
      o.start(); trem.start();
      this.alarmNode = { o, trem, out };
    } else if (!on && this.alarmNode) {
      const n = this.alarmNode; this.alarmNode = null;
      n.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
      setTimeout(() => { n.o.stop(); n.trem.stop(); }, 1500);
    }
  }
  warnBeep() { this.tone('square', 1400, 1400, 0.06, 0.06); this.tone('square', 1400, 1400, 0.06, 0.06, 0.12); }
  missile() { this.noiseHit(900, 0.9, 0.3, 'bandpass'); this.tone('sawtooth', 200, 900, 0.6, 0.08); }
  cannon(dist = 0) { const k = Math.max(0.15, 1 - dist / 200); this.noiseHit(250, 0.9, 0.9 * k); this.tone('sine', 90, 30, 0.6, 0.6 * k); }
  bombWhistle() { this.tone('sine', 1800, 350, 1.7, 0.07); }
  // ------------------------------------------------------------ human sounds
  footstep(vol = 0.08, surface = 'hard') {
    if (!this.ctx) return;
    this.noiseHit(surface === 'water' ? 900 : 1600 + Math.random() * 600, 0.05, vol, surface === 'water' ? 'bandpass' : 'lowpass');
    this.tone('sine', 90 + Math.random() * 20, 60, 0.05, vol * 0.8);
  }
  breath(vol = 0.05) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this.noiseSource(false);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 300; f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    n.connect(f).connect(g).connect(this.sfx); n.start(t, Math.random()); n.stop(t + 0.5);
  }
  // Synthesised "aah!" scream: a glottal sawtooth through two vowel formants.
  scream(dist = 0) {
    if (!this.ctx || (this.screamT || 0) > this.ctx.currentTime) return;
    const ctx = this.ctx, t = ctx.currentTime;
    this.screamT = t + 0.6;
    const k = Math.max(0.05, 1 - dist / 60) * 0.12;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f0 = 380 + Math.random() * 260;
    o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.25, t + 0.12); o.frequency.exponentialRampToValueAtTime(f0 * 0.7, t + 0.7);
    const vib = ctx.createOscillator(); vib.frequency.value = 7; const vg = ctx.createGain(); vg.gain.value = 18; vib.connect(vg).connect(o.frequency);
    const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(k, t + 0.05); out.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    for (const [fr, q, amp] of [[850, 6, 1], [1250, 8, 0.7], [2800, 10, 0.3]]) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = q;
      const ga = ctx.createGain(); ga.gain.value = amp;
      o.connect(bp).connect(ga).connect(out);
    }
    out.connect(this.sfx);
    o.start(t); vib.start(t); o.stop(t + 0.8); vib.stop(t + 0.8);
  }
  // Rank browser speech voices so neural/natural human voices are always preferred
  // over legacy robotic voices, and assign distinct voices per cast slot.
  pickHumanVoice(voice = {}) {
    const synth = window.speechSynthesis;
    const voices = synth?.getVoices?.() || [];
    if (!voices.length) return null;
    const en = voices.filter((v) => /^en/i.test(v.lang));
    const pool = en.length ? en : voices;
    const femaleRe = /female|aria|jenny|ava|emma|samantha|victoria|karen|susan|hazel|libby|serena|moira|tessa|sonia|michelle|clara|zira|google uk english female/i;
    const maleRe = /\bmale|andrew|brian|guy|christopher|eric|ryan|daniel|alex|george|arthur|oliver|thomas|davis|tony|google uk english male/i;
    const qualityScore = (v) => {
      const n = v.name || '';
      let s = 0;
      if (/natural|neural|online|premium|enhanced/i.test(n)) s += 50;
      if (/google/i.test(n)) s += 30;
      if (/microsoft.*(aria|guy|jenny|andrew|emma|brian|sonia|ryan)/i.test(n)) s += 40;
      if (/samantha|daniel|karen|moira|serena|tessa|alex/i.test(n)) s += 25;
      if (/espeak|mbrola|festival|flite/i.test(n)) s -= 40;
      if (/en[-_]US/i.test(v.lang)) s += 5;
      return s;
    };
    const genderFiltered = pool.filter((v) => (voice.female ? femaleRe.test(v.name) : (maleRe.test(v.name) || !femaleRe.test(v.name))));
    const ranked = (genderFiltered.length ? genderFiltered : pool).slice().sort((a, b) => qualityScore(b) - qualityScore(a));
    // Distribute different characters across the top human-sounding voices
    const topCount = Math.min(ranked.length, 5);
    const idx = (voice.slot || 0) % Math.max(1, topCount);
    return ranked[idx] || ranked[0];
  }

  // Story dialogue playback: supports pre-recorded audio clips (if voice.clipUrl is provided)
  // with crisp radio squelch cues and natural human voice synthesis fallback.
  say(text, voice = {}) {
    const synth = window.speechSynthesis;
    if (this.voiceAudio) { try { this.voiceAudio.pause(); } catch {} this.voiceAudio = null; }
    synth?.cancel?.();
    if (!text || !this.ctx || this.isMuted) { this.sayUntil = 0; return; }
    if (voice.radio) this.radio(0.35);
    if (voice.clipUrl) {
      const a = new Audio(voice.clipUrl);
      a.volume = 0.92;
      this.voiceAudio = a;
      a.play().catch(() => {});
      this.sayUntil = this.ctx.currentTime + 1 + text.length * 0.06;
      return;
    }
    if (!synth) return;
    const v = this.pickHumanVoice(voice);
    if (!v) return;
    const u = new SpeechSynthesisUtterance(text);
    u.voice = v;
    // Clamp pitch/rate to natural human cadence (eliminates robotic chipmunk/monster voices)
    const urgent = voice.tone === 'urgent' || /!/.test(text);
    u.pitch = Math.max(0.82, Math.min(1.18, voice.pitch ?? 1.0));
    u.rate = Math.max(0.88, Math.min(1.16, (voice.rate ?? 1.0) * (urgent ? 1.04 : 1.0)));
    u.volume = 0.92;
    if (voice.radio) u.onend = () => { if (!this.isMuted) this.radio(0.22); };
    synth.speak(u);
    this.sayUntil = this.ctx.currentTime + 1 + text.length * 0.062;
  }

  // Ambient pedestrian vocal reactions when dodging cars or witnessing chaos
  pedReact(kind = 'dodge', dist = 0) {
    if (!this.ctx || this.isMuted || (this.pedReactT || 0) > this.ctx.currentTime) return;
    if ((this.sayUntil || 0) > this.ctx.currentTime) return; // never interrupt story dialogue
    this.pedReactT = this.ctx.currentTime + 3.2 + Math.random() * 2.5;
    const lines = kind === 'dodge'
      ? ['Watch it!', 'Whoa!', 'Hey, look out!', 'Careful!', 'Are you crazy?!']
      : ['Run!', 'Get back!', 'Call the cops!', 'Oh no!'];
    const line = lines[Math.floor(Math.random() * lines.length)];
    const synth = window.speechSynthesis;
    const v = this.pickHumanVoice({ female: Math.random() < 0.5, slot: Math.floor(Math.random() * 5) });
    if (synth && v) {
      const u = new SpeechSynthesisUtterance(line);
      u.voice = v;
      u.pitch = 0.94 + Math.random() * 0.16;
      u.rate = 1.08 + Math.random() * 0.08;
      u.volume = Math.max(0.18, 1 - dist / 35) * 0.72;
      synth.speak(u);
    }
  }

  shout(line, dist = 0) {
    if (!this.ctx || this.isMuted || (this.shoutT || 0) > this.ctx.currentTime) return;
    if ((this.sayUntil || 0) > this.ctx.currentTime) return; // don't talk over the story
    this.shoutT = this.ctx.currentTime + 4.5;
    const synth = window.speechSynthesis;
    const v = this.pickHumanVoice({ female: false, slot: 3 });
    if (synth && v) {
      const u = new SpeechSynthesisUtterance(line);
      u.voice = v;
      u.rate = 1.08; u.pitch = 0.88; u.volume = Math.max(0.18, 1 - dist / 50) * 0.85;
      synth.cancel(); synth.speak(u);
    } else this.radio(0.6);
  }
  radio(vol = 0.4) {
    if (!this.ctx) return;
    this.tone('square', 1800, 1800, 0.04, 0.03 * vol);
    for (let i = 0; i < 4 + Math.floor(Math.random() * 4); i++) this.noiseHit(1400 + Math.random() * 900, 0.08 + Math.random() * 0.1, 0.05 * vol, 'bandpass', 0.06 + i * 0.13);
    this.tone('square', 1500, 1500, 0.05, 0.03 * vol, 0.7);
  }
  horn(dist = 0) {
    if (!this.ctx) return;
    const k = Math.max(0.05, 1 - dist / 80) * 0.05;
    this.tone('square', 415, 415, 0.35, k); this.tone('square', 330, 330, 0.35, k);
  }
  setCrowd(level) {
    if (!this.ctx) return;
    if (!this.crowdGain) {
      const ctx = this.ctx;
      const n = this.noiseSource();
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.9;
      const mod = ctx.createGain(); mod.gain.value = 0.6;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 3.1; const lg = ctx.createGain(); lg.gain.value = 0.35; lfo.connect(lg).connect(mod.gain); lfo.start();
      this.crowdGain = ctx.createGain(); this.crowdGain.gain.value = 0;
      n.connect(f).connect(mod).connect(this.crowdGain).connect(this.sfx); n.start();
    }
    this.crowdGain.gain.setTargetAtTime(Math.min(0.05, level * 0.004), this.ctx.currentTime, 0.8);
  }

  click() { this.tone('square', 1500, 1500, 0.03, 0.05); }
  emp() { this.tone('sawtooth', 1600, 60, 0.8, 0.2); this.noiseHit(800, 0.8, 0.2, 'bandpass'); }
  spikes() { this.noiseHit(3000, 0.5, 0.3, 'highpass'); this.tone('sawtooth', 200, 60, 0.5, 0.15); }
  levelUp() {
    [523, 659, 784].forEach((f, i) => this.tone('square', f, f, 0.12, 0.06, i * 0.09));
  }
  gameOver() {
    [440, 349, 262, 196].forEach((f, i) => this.tone('square', f, f * 0.98, 0.28, 0.09, i * 0.22));
  }

  // ------------------------------------------------------------ music
  startMusic() {
    const ctx = this.ctx;
    this.tempo = 118;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    // Am - F - C - G
    this.prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    const tick = () => {
      if (!this.ctx) return;
      const spb = 60 / this.tempo / 4; // 16th notes
      while (this.nextTime < this.ctx.currentTime + 0.12) {
        this.playStep(this.step, this.nextTime, spb);
        this.nextTime += spb;
        this.step = (this.step + 1) % 64;
      }
    };
    this.musicTimer = setInterval(tick, 30);
  }
  mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  playStep(step, t, spb) {
    if (!this.musicOn) return;
    const ctx = this.ctx;
    const bar = Math.floor(step / 16);
    const chord = this.prog[bar];
    const s = step % 16;
    const I = this.intensity;
    const out = this.musicBus;
    // kick on quarters
    if (s % 4 === 0) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.3);
    }
    // snare on 2 & 4 (from intensity 1)
    if (I >= 1 && (s === 4 || s === 12)) {
      const n = this.noiseSource(false);
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      n.connect(f).connect(g).connect(out); n.start(t, Math.random()); n.stop(t + 0.2);
    }
    // hats
    if (s % 2 === 1 || (I >= 3 && s % 1 === 0)) {
      const n = this.noiseSource(false);
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = ctx.createGain(); g.gain.setValueAtTime(s % 2 ? 0.1 : 0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      n.connect(f).connect(g).connect(out); n.start(t, Math.random()); n.stop(t + 0.06);
    }
    // bass: driving 8ths
    if (s % 2 === 0) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = this.mtof(chord[0] - 24 + (s % 8 === 6 ? 12 : 0));
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(200, t + spb * 1.8);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + spb * 1.9);
      o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + spb * 2);
    }
    // arpeggio (intensity 2+)
    if (I >= 2) {
      const note = chord[[0, 1, 2, 1][s % 4]] + 12 + (s >= 8 && I >= 4 ? 12 : 0);
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.value = this.mtof(note);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + spb * 0.9);
      o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + spb);
    }
    // pad on bar start
    if (s === 0) {
      for (const n of chord) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this.mtof(n);
        o.detune.value = (Math.random() - 0.5) * 14;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + spb * 16);
        o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + spb * 16 + 0.05);
      }
    }
  }
}
