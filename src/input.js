// Keyboard, gamepad and touch input → normalized driving controls.

export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = { left: false, right: false, gas: false, brake: false, drift: false, nitro: false, fire: false };
    this.pressed = new Set(); // one-shot keys this frame
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });
    this.gpPrev = {};
    // mouse: aim point on screen + left button to shoot (on foot)
    this.mouse = { x: 0, y: 0, t: -99 };
    this.mouseDown = false;
    window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.t = performance.now(); } });
    window.addEventListener('mousedown', (e) => { if (e.button === 0 && e.target.tagName === 'CANVAS') { this.mouseDown = true; this.mouse.t = performance.now(); } });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
  }

  bindTouch(root) {
    for (const el of root.querySelectorAll('[data-touch]')) {
      const k = el.dataset.touch;
      const on = (e) => { e.preventDefault(); this.touch[k] = true; el.classList.add('down'); };
      const off = (e) => { e.preventDefault(); this.touch[k] = false; el.classList.remove('down'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    }
  }

  wasPressed(code) { return this.pressed.has(code); }

  // On-foot controls. fwd = unit (x,z) of "screen up" in world space.
  // Returns world-space move vector, sprint/jump/fire, and an optional manual aim yaw.
  readFoot(fwd) {
    const k = this.keys;
    let f = 0, r = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) r += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) r -= 1;
    const t = this.touch;
    if (t.gas) f += 1; if (t.brake) f -= 1; if (t.right) r += 1; if (t.left) r -= 1;
    let sprint = k.has('ShiftLeft') || k.has('ShiftRight') || t.nitro;
    let jump = this.pressed.has('Space') || (t.drift && !this.prevDrift);
    this.prevDrift = t.drift;
    let fire = this.mouseDown || k.has('KeyJ') || k.has('ControlLeft');
    let aimYaw = null, manual = false;
    const j = this.joy;
    if (j && j.active) {
      const lx = j.axis('lx') * (j.invert.steer ? -1 : 1), ly = -j.axis('ly') * (j.invert.throttle ? -1 : 1);
      if (Math.abs(lx) > Math.abs(r)) r = lx;
      if (Math.abs(ly) > Math.abs(f)) f = ly;
      if (Math.hypot(lx, ly) > 0.92) sprint = true; // full stick = sprint
      if (j.events.has('L')) jump = true;
      // right stick = twin-stick aim + fire
      const rx = j.axis('rx') * (j.invert.steer ? -1 : 1), ry = -j.axis('ry') * (j.invert.throttle ? -1 : 1);
      if (Math.hypot(rx, ry) > 0.5) {
        const ax = fwd.x * ry + -fwd.z * rx, az = fwd.z * ry + fwd.x * rx;
        aimYaw = Math.atan2(ax, az); manual = true; fire = true;
      }
    }
    const mx = fwd.x * f + -fwd.z * r, mz = fwd.z * f + fwd.x * r;
    return { mx, mz, sprint, jump, fire, aimYaw, manual };
  }

  // Armed-vehicle trigger + aim. fwd = "screen up" on the ground (for stick aiming).
  readWeapon(fwd) {
    const k = this.keys;
    let fire = this.mouseDown || k.has('KeyJ') || k.has('ControlLeft') || k.has('ControlRight') || this.touch.fire;
    let aimYaw = null, manual = false;
    const aimStick = (rx, ry) => {
      if (Math.hypot(rx, ry) < 0.5) return;
      const ax = fwd.x * ry + -fwd.z * rx, az = fwd.z * ry + fwd.x * rx;
      aimYaw = Math.atan2(ax, az); manual = true; fire = true;
    };
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      if (gp.buttons[2]?.pressed) fire = true;
      aimStick(gp.axes[2] || 0, -(gp.axes[3] || 0));
      break;
    }
    // Arduino joystick: its right stick is the throttle while driving, so the
    // right click is the trigger (auto-aim) instead of nitro
    const j = this.joy;
    if (j && j.active && j.raw.rb === 1) fire = true;
    return { fire, aimYaw, manual };
  }

  mouseActive() { return performance.now() - this.mouse.t < 2500; }
  endFrame() { this.pressed.clear(); }

  read() {
    const k = this.keys, t = this.touch;
    let steer = 0, throttle = 0, brake = 0, handbrake = false, nitro = false;
    if (k.has('KeyA') || k.has('ArrowLeft') || t.left) steer -= 1;
    if (k.has('KeyD') || k.has('ArrowRight') || t.right) steer += 1;
    if (k.has('KeyW') || k.has('ArrowUp') || t.gas) throttle = 1;
    if (k.has('KeyS') || k.has('ArrowDown') || t.brake) brake = 1;
    if (k.has('Space') || t.drift) handbrake = true;
    if (k.has('ShiftLeft') || k.has('ShiftRight') || t.nitro) nitro = true;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const ax = gp.axes[0] || 0;
      if (Math.abs(ax) > 0.15) steer = ax;
      const rt = gp.buttons[7]?.value || 0, lt = gp.buttons[6]?.value || 0;
      if (rt > 0.05) throttle = Math.max(throttle, rt);
      if (lt > 0.05) brake = Math.max(brake, lt);
      if (gp.buttons[0]?.pressed) handbrake = true;
      if (gp.buttons[1]?.pressed || gp.buttons[5]?.pressed) nitro = true;
      const start = gp.buttons[9]?.pressed;
      if (start && !this.gpPrev.start) this.pressed.add('Escape');
      const cam = gp.buttons[3]?.pressed;
      if (cam && !this.gpPrev.cam) this.pressed.add('KeyC');
      this.gpPrev = { start, cam };
      break;
    }
    const j = this.joy;
    if (j && j.active) {
      const r = j.read();
      if (Math.abs(r.steer) > Math.abs(steer)) steer = r.steer;
      throttle = Math.max(throttle, r.throttle);
      brake = Math.max(brake, r.brake);
      handbrake = handbrake || r.handbrake;
      nitro = nitro || r.nitro;
    }
    return { steer: Math.max(-1, Math.min(1, steer)), throttle, brake, handbrake, nitro };
  }
}
