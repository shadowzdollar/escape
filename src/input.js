// Keyboard, gamepad and touch input → normalized driving controls.

export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = { left: false, right: false, gas: false, brake: false, drift: false, nitro: false };
    this.pressed = new Set(); // one-shot keys this frame
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.gpPrev = {};
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
