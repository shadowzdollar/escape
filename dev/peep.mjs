import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + e.stack));
await p.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 90000 });
await p.waitForTimeout(4000);
await p.screenshot({ path: out + '/pp-menu.png' });
const r = await p.evaluate(() => {
  const g = window.game; g.startRun();
  for (let i = 0; i < 60; i++) g.people.update(0.1); // populate
  g.simulate(20, true);
  const modes = {}; for (const q of g.people.list) modes[q.mode] = (modes[q.mode] || 0) + 1;
  return { n: g.people.list.length, modes, score: g.score | 0 };
});
console.log(JSON.stringify(r));
// close-up street-level view of people
await p.evaluate(() => { const g = window.game; g.state = 'paused'; const q = g.people.list.find(q => q.mode === 'walk' || q.mode === 'cross') || g.people.list[0];
  g.camera.position.set(q.x + 6, 3.5, q.z + 6); g.camera.lookAt(q.x, 1, q.z); g.focus.x = q.x; g.focus.z = q.z; });
await p.waitForTimeout(800);
await p.screenshot({ path: out + '/pp-close.png' });
console.log(errs.join('\n') || 'no errors');
await b.close();
