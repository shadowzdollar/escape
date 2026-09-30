// Door animation (exit + carjack entry) and swimming pose checks.
import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
await p.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu' && window.game.humans.ready, null, { timeout: 120000 });
const step = (secs) => p.evaluate((secs) => { const g = window.game; for (let i = 0; i < Math.round(secs * 30); i++) { g.time += 1 / 30; g.updatePlay(1 / 30); } }, secs);
await p.evaluate(() => { const g = window.game; g.startRun(); g.frozen = true; g.bustLimit = 1e9; g.simulate(0.5, false); g.car.vx = g.car.vz = 0; g.exitCar(); });
await step(0.25);
await p.evaluate(() => { const g = window.game, c = g.abandoned[0]; g.camera.position.set(c.x + 7, 3, c.z + 3); g.camera.lookAt(c.x, 1, c.z); });
await p.waitForTimeout(500);
await p.screenshot({ path: out + '/door-exit.png' });
console.log('exit anim:', await p.evaluate(() => { const g = window.game; return `${g.doorAnim?.mode} rot=${g.doorAnim?.door?.rotation.y.toFixed(2)}`; }));
// carjack a traffic car
const r = await p.evaluate(() => {
  const g = window.game, a = g.avatar;
  g.doorAnim = null;
  const v = g.traffic.cars.sort((x, y) => Math.hypot(x.x - a.x, x.z - a.z) - Math.hypot(y.x - a.x, y.z - a.z))[0];
  v.vx = v.vz = 0;
  a.x = v.x + Math.cos(v.heading) * 3; a.z = v.z - Math.sin(v.heading) * 3; a.state = 'foot';
  const ok = g.tryEnterCar();
  const log = [`start ${ok} phase=${g.doorAnim?.phase}`];
  for (let i = 0; i < 60; i++) { g.time += 1 / 30; g.updatePlay(1 / 30); if (i % 8 === 0) log.push(`${g.doorAnim?.phase || 'done'} rot=${(g.doorAnim?.door?.rotation.y || 0).toFixed(2)} car=${!!g.car}`); if (g.doorAnim?.phase === 'open' && !window.shot) { window.shot = true; window.carPos = { x: v.x, z: v.z, h: v.heading }; break; } }
  return log.join(' | ');
});
console.log('enter:', r);
await p.evaluate(() => { const g = window.game, c = window.carPos; g.camera.position.set(c.x + Math.cos(c.h) * 7, 3, c.z - Math.sin(c.h) * 7 + 2); g.camera.lookAt(c.x, 1, c.z); });
await step(0.3);
await p.evaluate(() => { const g = window.game, c = window.carPos; g.camera.position.set(c.x + Math.cos(c.h) * 7, 3, c.z - Math.sin(c.h) * 7 + 2); g.camera.lookAt(c.x, 1, c.z); });
await p.waitForTimeout(500);
await p.screenshot({ path: out + '/door-enter.png' });
await step(1);
console.log('after:', await p.evaluate(() => `car=${!!window.game.car} kind=${window.game.car?.kind} anim=${!!window.game.doorAnim}`));
// swimming pose
await p.evaluate(() => {
  const g = window.game; g.car.vx = g.car.vz = 0; g.exitCar(); g.doorAnim = null;
  const a = g.avatar; a.state = 'foot';
  const z0 = (5 - 8) * 74 + 8;
  a.x = 37; a.z = z0 - 3; a.y = 0.15;
  g.input.readFoot = () => ({ mx: 0, mz: 1, sprint: false, jump: false, fire: false, aimYaw: null, manual: false });
  for (let i = 0; i < 120; i++) { a.hp = 999; g.time += 1 / 30; g.updatePlay(1 / 30); }
  g.camera.position.set(a.x + 5, 1.5, a.z + 5); g.camera.lookAt(a.x, -1.6, a.z);
});
await p.waitForTimeout(600);
await p.screenshot({ path: out + '/swim-crawl.png' });
console.log('swim:', await p.evaluate(() => { const a = window.game.avatar; return `swimming=${a.swimming} speed=${a.speed.toFixed(1)} blend=${(a.swimBlend || 0).toFixed(2)} clip=${a.person?.rig?.current}`; }));
console.log(errs.slice(0, 5).join('\n') || 'no errors');
await b.close();
