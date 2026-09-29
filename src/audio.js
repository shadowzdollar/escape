// Fully synthesized audio: engine, siren, tyres, rotor, one-shots and adaptive music.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = true;
    this.intensity = 0; // 0..4 music layers
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
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

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
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

  // Continuous state from the game each frame.
  update({ speedRatio = 0, throttle = 0, active = false, drift = 0, siren = 0, sirenPan = 0, rotor = 0, nitro = false }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const rpm = 0.25 + speedRatio * 0.75;
    // fake gear shifts: sawtooth of rpm within a gear
    const gear = Math.min(4, Math.floor(speedRatio * 5));
    const inGear = speedRatio * 5 - gear;
    const r = active ? 0.3 + inGear * 0.55 + gear * 0.06 + throttle * 0.1 : 0.2;
    const f = 38 + r * 120 * (nitro ? 1.15 : 1);
    this.eng1.frequency.setTargetAtTime(f, t, 0.05);
    this.eng2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engFilter.frequency.setTargetAtTime(350 + throttle * 900 + rpm * 700, t, 0.08);
    this.engGain.gain.setTargetAtTime(active ? 0.1 + throttle * 0.07 : 0, t, 0.1);
    this.skidGain.gain.setTargetAtTime(active ? Math.min(0.16, drift * 0.02) : 0, t, 0.05);
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
