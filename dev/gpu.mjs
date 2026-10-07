import { chromium } from 'playwright-core';
const flags = (process.env.FLAGS || '--use-angle=vulkan --enable-features=Vulkan --ignore-gpu-blocklist --enable-gpu-rasterization').split(' ');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: process.env.HEADED ? false : true, args: flags });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
if (process.env.NOKIT) await page.addInitScript(() => { window.__noKit = true; });
page.on('pageerror', (e) => logs.push(e.message));
await page.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded', timeout: 90000 }); if (process.env.NOPEOPLE) await page.evaluate(() => { window.__noPeople = true; }); if (process.env.NORIGS) await page.evaluate(() => { window.__noRigs = true; }); if (process.env.HEAT) await page.evaluate((h) => { window.__heat = h; }, process.env.HEAT);
const r = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
console.log('renderer:', r);
await page.waitForFunction(() => window.game && window.game.state === 'menu' && window.game.humans.ready, null, { timeout: 120000 });
const q = process.env.QUALITY || 'high';
const res = await page.evaluate(async (q) => {
  const g = window.game;
  g.setSetting('quality', q); if (window.__noPeople) g.people.target = 0; if (window.__noRigs) g.humans.max = 0;
  g.startRun();
  g.heat = +(window.__heat || 90); g.bustLimit = 1e9;
  g.player.hp = 9999; g.simulate(14, true); g.player.hp = 9999;
  // measure real frames with autopilot
  const orig = g.input.read.bind(g.input);
  g.input.read = () => ({ steer: Math.sin(performance.now() / 900) * 0.6, throttle: 1, brake: 0, handbrake: false, nitro: false });
  const t0 = performance.now(); let frames = 0; const times = [];
  await new Promise((done) => {
    let last = performance.now();
    const f = () => { const n = performance.now(); times.push(n - last); last = n; frames++; if (n - t0 < 6000) requestAnimationFrame(f); else done(); };
    requestAnimationFrame(f);
  });
  g.input.read = orig;
  times.sort((a, b) => a - b);
  const info = g.renderer.info.render;
  return { perf: { u: g.perf.update.toFixed(2), r: g.perf.render.toFixed(2) }, fps: (frames / 6).toFixed(1), p50: times[times.length >> 1].toFixed(1), p95: times[Math.floor(times.length * 0.95)].toFixed(1), calls: info.calls, tris: info.triangles, vehicles: g.vehicles.size, state: g.state };
}, q);
console.log(q, JSON.stringify(res));
console.log(logs.join('\n') || 'no errors');
await browser.close();
