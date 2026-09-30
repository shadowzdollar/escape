import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
await p.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu' && window.game.humans.ready, null, { timeout: 120000 });
// car weapons vs a 4-star chase (police heli)
const r1 = await p.evaluate(() => {
  const g = window.game; g.startRun(); g.frozen = true; g.heat = 150; g.bustLimit = 1e9;
  g.combat.carGuns = 999; g.combat.carRockets = 40;
  const out = [];
  for (let k = 0; k < 6; k++) {
    g.car.hp = 999;
    g.simulate(5, true);
    out.push(`t=${g.runTime.toFixed(0)} heli=${g.police.heli ? (g.police.heli.falling ? 'falling' : 'hp' + g.police.heli.hp.toFixed(0)) : 'none'} wrecks=${g.wrecks} rocketsLeft=${g.combat.carRockets} score=${g.score | 0}`);
  }
  return out.join('\n');
});
console.log(r1);
await p.evaluate(() => window.game.updateCamera(0.5));
await p.waitForTimeout(500);
await p.screenshot({ path: out + '/s2-car.png' });
// on foot with the rocket launcher vs 7-star gunships
const r2 = await p.evaluate(() => {
  const g = window.game; g.startRun(); g.frozen = true; g.heat = 380; g.bustLimit = 1e9;
  for (let i = 0; i < 300 && g.car; i++) { g.car.hp = 999; g.time += 1 / 30; g.updatePlay(1 / 30); }
  if (g.car) { g.car.vx = g.car.vz = 0; g.exitCar(); }
  g.combat.ammo.rpg = 30; g.combat.weapon = 'rpg';
  g.input.readFoot = () => ({ mx: 0, mz: 0, sprint: false, jump: false, fire: true, aimYaw: null, manual: false });
  g.input.mouseActive = () => false;
  const out = [];
  for (let k = 0; k < 5; k++) {
    for (let i = 0; i < 120; i++) { g.avatar.hp = 999; g.time += 1 / 30; g.updatePlay(1 / 30); }
    out.push(`gunships=${g.military.gunships.length} falling=${g.military.gunships.filter((h) => h.falling).length} rpg=${g.combat.ammo.rpg} kills=${g.combat.kills} state=${g.state}`);
  }
  g.updateCamera(0.5);
  return out.join('\n');
});
console.log(r2);
await p.waitForTimeout(500);
await p.screenshot({ path: out + '/s2-foot.png' });
console.log(errs.slice(0, 6).join('\n') || 'no errors');
await b.close();
