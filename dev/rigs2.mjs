import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + e.stack));
await p.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu' && window.game.humans.ready, null, { timeout: 120000 });
// 1) a chatting group, spawned right next to the camera focus
await p.evaluate(() => {
  const g = window.game; g.frozen = true;
  const P = g.people, x = -9.6, z = 20;
  const cluster = { x, z, speaker: 0, t: 0, life: 99, members: [] };
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; const q = P.make(x + Math.sin(a) * 0.6, z + Math.cos(a) * 0.6, { mode: 'talk', cluster }); q.heading = Math.atan2(x - q.x, z - q.z); cluster.members.push(q); }
  g.focus.x = x; g.focus.z = z;
  for (let i = 0; i < 40; i++) { g.time += 1 / 30; P.update(1 / 30); g.humans.update(1 / 30); }
  g.camera.position.set(x + 4.2, 1.8, z + 2.6); g.camera.lookAt(x, 1.0, z);
  g.showcase.root.visible = false; document.getElementById('menu').classList.remove('show');
});
await p.waitForTimeout(700);
await p.screenshot({ path: `${out}/r-group.png` });
// 2) intro robber close-up
await p.evaluate(() => {
  const g = window.game; g.startRun({ intro: true });
  for (let i = 0; i < Math.round(4.4 * 30); i++) { g.time += 1 / 30; g.updatePlay(1 / 30); }
});
await p.waitForTimeout(700);
await p.screenshot({ path: `${out}/r-robber.png` });
console.log(await p.evaluate(() => { const r = window.game.cine.robber; return r ? `robber rig=${r.rig?.kind} clip=${r.rig?.current}` : 'no robber'; }));
console.log(errs.join('\n') || 'no errors');
await b.close();
