import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + e.stack));
await p.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 90000 });
await p.evaluate(() => { const g = window.game; g.startRun({ intro: true }); g.frozen = true; });
// step the intro deterministically and capture key moments
const stops = [2.5, 4.6, 6.2, 8.0, 9.9, 11.4];
let t = 0;
for (const s of stops) {
  await p.evaluate((dt) => { const g = window.game; const n = Math.round(dt / (1 / 30)); for (let i = 0; i < n && g.state === 'intro'; i++) { g.time += 1/30; g.updatePlay(1 / 30); g.city.update(1/30, g.time); g.effects.update(1 / 30, g.camera.position.x, g.camera.position.z); } }, s - t);
  t = s;
  await p.evaluate(() => { window.game.frozen = true; });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/intro-${s}.png` });
  console.log(s, await p.evaluate(() => { const g = window.game; return JSON.stringify({ state: g.state, cine: g.cine.t?.toFixed(2), cops: g.police.cops.length, robber: !!g.cine.robber, car: [g.player.x.toFixed(1), g.player.z.toFixed(1)] }); }));
}
console.log(errs.join('\n') || 'no errors');
await b.close();
