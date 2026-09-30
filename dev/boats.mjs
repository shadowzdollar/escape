// Steal a docked boat, drive down the river, check police boats spawn.
import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
await p.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu' && window.game.humans.ready, null, { timeout: 120000 });
const r = await p.evaluate(() => {
  const g = window.game; g.startRun(); g.frozen = true; g.heat = 60; g.bustLimit = 1e9;
  g.simulate(1, false);
  const boat = g.boats.list.find((b) => b.docked);
  g.car.vx = g.car.vz = 0; g.exitCar();
  const a = g.avatar; a.state = 'foot'; if (a.person) a.person.mode = 'player';
  const mid = (g.boats.z0 + g.boats.z1) / 2;
  a.x = boat.x; a.z = boat.z + (boat.z < mid ? -3.2 : 3.2); a.y = 0.15;
  const ok = g.tryEnterCar();
  const log = [`boats=${g.boats.list.length} docked=${g.boats.list.filter((b) => b.docked).length} entered=${ok} boat=${!!g.car?.boat}`];
  g.input.read = () => ({ steer: 0.05, throttle: 1, brake: 0, handbrake: false, nitro: false });
  for (let k = 0; k < 4 && g.car; k++) {
    g.car.hp = 999;
    for (let i = 0; i < 150; i++) { g.time += 1 / 30; g.updatePlay(1 / 30); }
    log.push(`k=${k} x=${g.car.x.toFixed(0)} z=${g.car.z.toFixed(1)} kmh=${(g.car.speed * 3.6).toFixed(0)} policeBoats=${g.boats.cops.length} y=${g.car.y.toFixed(2)}`);
  }
  g.updateCamera(0.5);
  return log.join('\n');
});
console.log(r);
await p.waitForTimeout(500);
await p.screenshot({ path: out + '/boat.png' });
await p.evaluate(() => { const g = window.game, c = g.car; g.camera.position.set(c.x + 9, 5, c.z + 9); g.camera.lookAt(c.x, -1, c.z); });
await p.waitForTimeout(500);
await p.screenshot({ path: out + '/boat-close.png' });
console.log(errs.slice(0, 5).join('\n') || 'no errors');
await b.close();
