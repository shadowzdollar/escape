import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5180/', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 90000 });
const res = await page.evaluate(async (q) => {
  const g = window.game;
  g.setSetting('quality', q);
  g.startRun(); g.heat = 90;
  g.input.read = () => ({ steer: Math.sin(performance.now() / 900) * 0.6, throttle: 1, brake: 0, handbrake: false, nitro: false });
  const t0 = performance.now(); const out = [];
  let last = performance.now(), progs = g.renderer.info.programs.length, veh = g.vehicles.size;
  await new Promise((done) => {
    const f = () => {
      const n = performance.now(); const dt = n - last; last = n;
      const p2 = g.renderer.info.programs.length, v2 = g.vehicles.size;
      if (dt > 30) out.push(`t=${((n - t0) / 1000).toFixed(2)} dt=${dt.toFixed(0)} newPrograms=${p2 - progs} vehDelta=${v2 - veh} u=${g.perf.update.toFixed(1)} r=${g.perf.render.toFixed(1)}`);
      progs = p2; veh = v2;
      if (n - t0 < 10000) requestAnimationFrame(f); else done();
    };
    requestAnimationFrame(f);
  });
  return out;
}, process.env.QUALITY || 'high');
console.log(res.join('\n'));
await browser.close();
