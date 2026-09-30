import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
await p.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu' && window.game.humans.ready, null, { timeout: 120000 });
const step = (secs) => p.evaluate((secs) => { const g = window.game; const n = Math.round(secs * 30); for (let i = 0; i < n && g.state === 'playing'; i++) { g.time += 1 / 30; g.updatePlay(1 / 30); g.city.update(1 / 30, g.time); g.effects.update(1 / 30, g.camera.position.x, g.camera.position.z); } }, secs);
const log = (label) => p.evaluate((label) => { const g = window.game, a = g.avatar; const offs = g.people.list.filter((o) => o.copFoot); return `${label}: state=${g.state} car=${!!g.car} avatar=${a.active ? a.state : '-'} pos=(${g.player.x.toFixed(0)},${g.player.z.toFixed(0)}) hp=${g.player.hp.toFixed(0)} swim=${a.swimming} officers=${offs.length} dead=${offs.filter((o) => o.dead).length} bullets=${g.combat.bullets.length} kills=${g.combat.kills} bust=${g.bustTimer.toFixed(2)} rig=${a.person?.rig?.current}`; }, label);
// 1) start, heat up, then get out of the car
await p.evaluate(() => { const g = window.game; g.startRun(); g.frozen = true; g.heat = 45; g.bustLimit = 1e9; });
await p.evaluate(() => { window.game.input.read = () => ({ steer: 0, throttle: 0.5, brake: 0, handbrake: false, nitro: false }); });
await step(4);
await p.evaluate(() => { const g = window.game; g.input.read = () => ({ steer: 0, throttle: 0, brake: 1, handbrake: false, nitro: false }); });
await step(2);
await p.evaluate(() => window.game.exitCar());
console.log(await log('exited'));
// 2) stand still and let the cops come; shoot back with auto-aim
await p.evaluate(() => { const g = window.game; g.input.readFoot = () => ({ mx: 0, mz: 0, sprint: false, jump: false, fire: true, aimYaw: null, manual: false }); g.input.mouseActive = () => false; });
for (let k = 0; k < 4; k++) { await p.evaluate(() => { window.game.avatar.hp = 100; }); await step(4); console.log(await log('fight' + k)); }
await p.evaluate(() => { const g = window.game; g.updateCamera(0.5); g.frozen = true; });
await p.waitForTimeout(600);
await p.screenshot({ path: out + '/s1-fight.png' });
// 3) run and steal the nearest stopped car
const stole = await p.evaluate(() => {
  const g = window.game, a = g.avatar;
  const v = [...g.vehicles].filter((v) => v.alive && !v.destroyed).sort((x, y) => Math.hypot(x.x - a.x, x.z - a.z) - Math.hypot(y.x - a.x, y.z - a.z))[0];
  v.vx = v.vz = 0; a.x = v.x + Math.cos(v.heading) * (v.W / 2 + 1); a.z = v.z - Math.sin(v.heading) * (v.W / 2 + 1);
  const ok = g.tryEnterCar(); return ok + ' ' + v.kind + ' ' + (v.copType || v.model);
});
console.log('steal:', stole, await log('in car'));
// 4) bail at speed
await p.evaluate(() => { const g = window.game; g.input.read = () => ({ steer: 0, throttle: 1, brake: 0, handbrake: false, nitro: false }); });
await step(3);
await p.evaluate(() => window.game.exitCar());
await step(0.5);
console.log(await log('bailed'));
await step(2);
// 5) swim: jump into the river from the bank
const swim = await p.evaluate(() => {
  const g = window.game, a = g.avatar;
  a.state = 'foot'; if (a.person) a.person.mode = 'player'; a.hp = 1e6; a.maxHp = 1e6; g.state = 'playing';
  a.x = 30; a.z = -370 + 74 * 0 + 0; // find the river strip
  const CELL = 74, z0 = (5 - 8) * CELL + 8, z1 = (6 - 8) * CELL - 8;
  a.x = 37; a.z = z0 - 3; a.y = 0.15;
  g.input.readFoot = () => ({ mx: 0, mz: 1, sprint: true, jump: false, fire: false, aimYaw: null, manual: false });
  const out = [];
  for (let i = 0; i < 150; i++) { a.hp = 1e6; g.time += 1 / 30; g.updatePlay(1 / 30); if (i % 30 === 0) out.push(`z=${a.z.toFixed(1)} y=${a.y.toFixed(2)} swim=${a.swimming}`); }
  g.updateCamera(0.5);
  return out.join(' | ');
});
console.log('swim:', swim);
await p.waitForTimeout(500);
await p.screenshot({ path: out + '/s1-swim.png' });
console.log(errs.slice(0, 6).join('\n') || 'no errors');
await b.close();
