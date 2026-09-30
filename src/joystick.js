// Arduino dual-thumbstick controller (see hardware/escape_joystick). Three links:
//  - USB cable, via Web Serial
//  - Bluetooth HC-05, via Web Serial (Chrome lists paired Serial Port Profile devices)
//  - Bluetooth HC-05 bound to /dev/rfcomm0, via the dev-server bridge (hardware/joy-bridge.mjs)
// Protocol: "J,lx,ly,lb,rx,ry,rb\n" with axes 0..1023 and buttons 0/1.

const SPP_UUID = '00001101-0000-1000-8000-00805f9b34fb'; // Bluetooth Serial Port Profile (HC-05/HC-06)

const DEAD = 0.12;

function shape(v) {
  // dead-zone + rescale so small wobbles are ignored but full throw still reaches 1
  const a = Math.abs(v);
  if (a < DEAD) return 0;
  return Math.sign(v) * Math.min(1, (a - DEAD) / (1 - DEAD - 0.04));
}

export class SerialJoystick {
  constructor() {
    this.supported = 'serial' in navigator;
    this.connected = false;
    this.port = null;
    this.raw = { lx: 512, ly: 512, lb: 0, rx: 512, ry: 512, rb: 0 };
    this.center = null;
    this.span = { lx: 511, ly: 511, rx: 511, ry: 511 };
    this.invert = { steer: false, throttle: false };
    this.events = new Set();       // edge events for menus: up/down/left/right/L/R
    this.dir = { x: 0, y: 0 };
    this.prevBtn = { lb: 0, rb: 0 };
    this.bothHeld = 0;
    this.lastData = 0;
    this.onStatus = null;
    if (this.supported) {
      navigator.serial.addEventListener('disconnect', (e) => { if (e.target === this.port) this.lost(); });
      navigator.serial.addEventListener('connect', () => this.autoConnect());
    }
  }

  status(text) { this.statusText = text; this.onStatus?.(text, this.connected); }

  // Reopen a port the user already granted (no click needed), else try the Bluetooth bridge.
  async autoConnect(quiet = false) {
    if (this.connected || this.connecting) return;
    const ports = this.supported ? await navigator.serial.getPorts() : [];
    for (const p of ports) { if (await this.open(p, quiet)) return; }
    if (!this.connected && import.meta.env?.DEV) await this.connectBridge();
  }

  // Must be called from a user gesture the first time (browser security rule).
  async requestConnect() {
    if (!this.supported) { this.status('Web Serial not supported: use Chrome or Edge'); return; }
    this.stopBridge();
    let port;
    try {
      // also offer paired Bluetooth serial devices (HC-05 / HC-06) in the chooser
      try { port = await navigator.serial.requestPort({ allowedBluetoothServiceClassIds: [SPP_UUID] }); } catch (e) {
        if (e.name !== 'TypeError') throw e;
        port = await navigator.serial.requestPort();
      }
    } catch (e) {
      this.status(e.name === 'NotFoundError' ? 'No port selected' : `Error: ${e.message}`);
      return;
    }
    await this.open(port);
  }

  async open(port, quiet = false) {
    const bt = !!port.getInfo?.().bluetoothServiceClassId;
    this.connecting = true;
    if (bt && !quiet) this.status('Connecting over Bluetooth… (a few seconds)');
    try {
      await port.open({ baudRate: 115200 }); // ignored by Bluetooth links
    } catch (e) {
      if (!String(e.message).includes('already open')) {
        this.connecting = false;
        if (!quiet) this.status(`Could not open ${bt ? 'Bluetooth link' : 'port'}: ${e.message}`);
        return false;
      }
    }
    this.connecting = false;
    this.stopBridge();
    this.port = port;
    this.link = bt ? 'Bluetooth' : 'USB';
    this.begin();
    this.readLoop();
    return true;
  }

  begin() {
    this.connected = true;
    this.center = null; // recalibrate on first packets
    this.calib = [];
    this.lastData = performance.now();
    this.status(`Connected (${this.link}): calibrating, leave the sticks centred`);
  }

  lost() {
    const was = this.connected;
    this.connected = false;
    this.port = null;
    if (was) this.status(this.link === 'USB' ? 'Controller unplugged' : 'Bluetooth link lost: reconnecting…');
    // Bluetooth drops when the controller is switched off or out of range: keep retrying quietly
    clearTimeout(this.retry);
    this.retry = setTimeout(() => this.autoConnect(true), 3000);
  }

  // ---- Bluetooth bridge: the Vite dev server reads /dev/rfcomm0 and streams it here
  async connectBridge() {
    if (this.bridge || this.connected) return;
    const ctrl = new AbortController();
    this.bridge = ctrl;
    let res;
    try { res = await fetch('/joy-bridge', { signal: ctrl.signal, cache: 'no-store' }); } catch { res = null; }
    if (!res || !res.ok || !res.body) {
      if (this.bridge === ctrl) this.bridge = null;
      if (!this.connected) { clearTimeout(this.retry); this.retry = setTimeout(() => this.autoConnect(true), 5000); }
      return;
    }
    this.link = `Bluetooth ${res.headers.get('X-Joy-Port') || 'bridge'}`;
    this.begin();
    const reader = res.body.getReader(), decoder = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) { this.parse(buf.slice(0, nl).trim()); buf = buf.slice(nl + 1); }
        if (buf.length > 256) buf = '';
      }
    } catch { /* aborted or link dropped */ }
    if (this.bridge === ctrl) { this.bridge = null; if (!this.port) this.lost(); }
  }

  stopBridge() {
    if (!this.bridge) return;
    const b = this.bridge;
    this.bridge = null;
    b.abort();
  }

  async readLoop() {
    const port = this.port;
    const decoder = new TextDecoder();
    let buf = '';
    while (port.readable && this.port === port) {
      const reader = port.readable.getReader();
      this.reader = reader;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf('\n')) >= 0) {
            this.parse(buf.slice(0, nl).trim());
            buf = buf.slice(nl + 1);
          }
          if (buf.length > 256) buf = '';
        }
      } catch {
        break;
      } finally {
        reader.releaseLock();
      }
    }
    if (this.port === port) this.lost();
  }

  parse(line) {
    if (!line.startsWith('J,')) return;
    const p = line.split(',');
    if (p.length < 7) return;
    const n = p.slice(1).map(Number);
    if (n.some(Number.isNaN)) return;
    const [lx, ly, lb, rx, ry, rb] = n;
    this.raw = { lx, ly, lb, rx, ry, rb };
    this.lastData = performance.now();
    if (!this.center) {
      this.calib.push(this.raw);
      if (this.calib.length >= 20) {
        const avg = (k) => this.calib.reduce((s, r) => s + r[k], 0) / this.calib.length;
        this.center = { lx: avg('lx'), ly: avg('ly'), rx: avg('rx'), ry: avg('ry') };
        for (const k of ['lx', 'ly', 'rx', 'ry']) this.span[k] = Math.max(300, Math.min(this.center[k], 1023 - this.center[k]));
        this.status('Controller ready');
      }
    }
  }

  axis(k) {
    if (!this.center) return 0;
    const v = (this.raw[k] - this.center[k]) / this.span[k];
    // track the real extremes so a stick that does not reach 0/1023 still gives full throw
    return shape(Math.max(-1, Math.min(1, v)));
  }

  // Bluetooth packets arrive in small bursts, so allow a longer gap before calling the link dead
  get active() { return this.connected && !!this.center && performance.now() - this.lastData < 800; }

  // Driving controls. Left stick steers, right stick up/down = gas/brake,
  // left click = handbrake drift, right click = nitro.
  read() {
    const steer = this.axis('lx') * (this.invert.steer ? -1 : 1);
    const y = -this.axis('ry') * (this.invert.throttle ? -1 : 1); // up = positive
    return {
      steer,
      throttle: Math.max(0, y),
      brake: Math.max(0, -y),
      handbrake: this.raw.lb === 1,
      nitro: this.raw.rb === 1,
    };
  }

  // Called once per frame: turn stick flicks and clicks into menu edge events.
  poll(dt) {
    this.events.clear();
    if (!this.active) return;
    const x = this.axis('lx') || this.axis('rx');
    const y = this.axis('ly') || this.axis('ry');
    const dx = x > 0.6 ? 1 : x < -0.6 ? -1 : Math.abs(x) < 0.3 ? 0 : this.dir.x;
    const dy = y > 0.6 ? 1 : y < -0.6 ? -1 : Math.abs(y) < 0.3 ? 0 : this.dir.y;
    if (dx !== this.dir.x && dx) this.events.add((dx > 0) !== this.invert.steer ? 'right' : 'left');
    if (dy !== this.dir.y && dy) this.events.add((dy > 0) !== this.invert.throttle ? 'down' : 'up');
    this.dir = { x: dx, y: dy };
    if (this.raw.lb && !this.prevBtn.lb) this.events.add('L');
    if (this.raw.rb && !this.prevBtn.rb) this.events.add('R');
    // long-press right stick (~0.6 s) = get out of / into a vehicle
    if (this.raw.rb && !this.raw.lb) {
      this.rHeld = (this.rHeld || 0) + dt;
      if (this.rHeld > 0.6 && this.rHeld - dt <= 0.6) this.events.add('RHOLD');
    } else this.rHeld = 0;
    // long-press left stick = get out of an armed vehicle (its R click is the trigger)
    if (this.raw.lb && !this.raw.rb) {
      this.lHeld = (this.lHeld || 0) + dt;
      if (this.lHeld > 0.6 && this.lHeld - dt <= 0.6) this.events.add('LHOLD');
    } else this.lHeld = 0;
    this.prevBtn = { lb: this.raw.lb, rb: this.raw.rb };
    // hold both clicks ~0.8 s = pause / resume
    if (this.raw.lb && this.raw.rb) {
      this.bothHeld += dt;
      if (this.bothHeld > 0.8 && this.bothHeld - dt <= 0.8) this.events.add('pause');
    } else this.bothHeld = 0;
  }
}
