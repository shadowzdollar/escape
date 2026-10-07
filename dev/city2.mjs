// City upgrade check: Quaternius trees, props and old-town townhouses; LOD; frame cost.
import { chromium } from 'playwright-core';
const [out, map = 'city'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
p.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') errs.push('console: ' + m.text()); });
await p.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu' && window.game.humans.ready, null, { timeout: 120000 });
if (map !== 'city') { await p.evaluate((m) => window.game.selectMap(m), map); await p.waitForFunction(() => window.game.state === 'menu', null, { timeout: 120000 }); }
console.log(await p.evaluate(() => {
  const c = window.game.city;
  const types = {}; for (const bl of c.blocks) types[bl.type] = (types[bl.type] || 0) + 1;
  const kitCounts = Object.entries(c.props).filter(([n]) => n.startsWith('k_') && n.endsWith('_0')).map(([n, v]) => `${n.slice(2, -2)}:${v.list.length}`).join(' ');
  return `kit models=${Object.keys(c.kit).length} lods=${c.lods.length} blocks=${JSON.stringify(types)}\n${kitCounts}`;
}));
await p.evaluate(() => { const g = window.game; g.startRun(); g.frozen = true; g.bustLimit = 1e9; g.simulate(0.5, false); g.car.vx = g.car.vz = 0; });
const shot = async (name, fn, arg) => {
  if (fn) await p.evaluate(fn, arg);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}/${name}.png` });
};
await shot('city-play', () => { const g = window.game; g.updateCamera(1); });
const info = await p.evaluate(() => { const r = window.game.renderer.info.render; return `calls=${r.calls} tris=${r.triangles}`; });
console.log('gameplay view:', info);
const look = (args) => {
  const g = window.game, c = g.city;
  const bl = c.blocks.find((x) => x.type === args.type) || c.blocks[0];
  const cx = (bl.x0 + bl.x1) / 2, cz = (bl.z0 + bl.z1) / 2;
  g.focus.x = cx; g.focus.z = cz;
  g.camera.position.set(cx + args.dx, args.h, cz + args.dz); g.camera.lookAt(cx, args.ly || 0, cz);
  window.__lookAt = { cx, cz };
};
await shot('city-oldtown', look, { type: 'oldtown', dx: 45, h: 38, dz: 55 });
await shot('city-oldtown-street', look, { type: 'oldtown', dx: 34, h: 3, dz: -10, ly: 6 });
await shot('city-park', look, { type: 'park', dx: 30, h: 25, dz: 35 });
await shot('city-midtown', look, { type: 'midtown', dx: 40, h: 30, dz: 50 });
await shot('city-street', look, { type: 'suburb', dx: 36, h: 2.5, dz: 20, ly: 4 });
await shot('city-aerial', look, { type: 'downtown', dx: 160, h: 140, dz: 180 });
console.log(errs.slice(0, 6).join('\n') || 'no errors');
await b.close();
