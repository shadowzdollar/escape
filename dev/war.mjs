// War vehicles + armed boats + controls screen.
import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
await p.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu' && window.game.humans.ready, null, { timeout: 120000 });

// garage tabs
await p.evaluate(() => { const g = window.game; g.save.coins = 100000; g.ui.openGarage(); });
await p.click('[data-tab="war"]');
for (let i = 0; i < 4; i++) {
  const name = await p.evaluate(() => document.getElementById('car-name').textContent + ' | ' + document.getElementById('car-weapons').textContent);
  console.log('war tab:', name);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/garage-war${i}.png` });
  await p.click('#car-action'); // buy + select
  await p.click('[data-action="next-car"]');
}
await p.click('[data-tab="boats"]');
for (let i = 0; i < 3; i++) {
  const name = await p.evaluate(() => document.getElementById('car-name').textContent + ' | ' + document.getElementById('car-weapons').textContent);
  console.log('boats tab:', name);
  await p.waitForTimeout(300);
  if (i === 2) await p.screenshot({ path: `${out}/garage-boat.png` });
  await p.click('#car-action');
  if (i < 2) await p.click('[data-action="next-car"]');
}
console.log('save:', await p.evaluate(() => `selected=${window.game.save.selected} boat=${window.game.save.selectedBoat}`));

// fire each war vehicle at a police car parked ahead
const fire = async (id, weaponIdx) => p.evaluate(({ id, weaponIdx }) => {
  const g = window.game;
  g.save.selected = id;
  g.startRun(); g.frozen = true; g.bustLimit = 1e9; g.heat = 10;
  const c = g.car;
  c.wIdx = weaponIdx;
  g.input.readWeapon = () => ({ fire: true, aimYaw: null, manual: false });
  g.input.mouseActive = () => false;
  const cop = g.police.makeCop('patrol', c.x + Math.sin(c.heading) * 30, c.z + Math.cos(c.heading) * 30, c.heading);
  cop.ai = { ...(cop.ai || {}), mode: 'script' };
  const hp0 = cop.hp;
  let shots = 0;
  for (let i = 0; i < 90; i++) { c.vx = c.vz = 0; c.hp = 9999; const n = g.combat.bullets.length + g.combat.rockets.length; g.time += 1 / 30; g.updatePlay(1 / 30); if (g.combat.bullets.length + g.combat.rockets.length > n) shots++; if (i === 20) window.snap = true; }
  return `${id} weapon=${c.weapons[c.wIdx]} turret=${c.wv.turret ? c.wv.turret.rotation.y.toFixed(2) : '-'} shotsFrames=${shots} copHp ${hp0}->${cop.hp.toFixed(0)} alive=${cop.alive} heat=${g.heat.toFixed(0)}`;
}, { id, weaponIdx });
console.log(await fire('goliath', 0));
await p.evaluate(() => window.game.updateCamera(1));
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/tank-fire.png` });
console.log(await fire('goliath', 1));
console.log(await fire('rhino', 0));
console.log(await fire('warhog', 0));
console.log(await fire('ghost', 0));
await p.evaluate(() => { const g = window.game, c = g.car; g.camera.position.set(c.x + 6, 4, c.z - 5); g.camera.lookAt(c.x, 1, c.z); });
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/ghost.png` });

// your garage boat at the river
const r = await p.evaluate(() => {
  const g = window.game;
  g.save.selected = 'bolt';
  g.startRun(); g.frozen = true; g.bustLimit = 1e9;
  const m = g.boats.mine;
  const log = [`mine=${m?.boatKind} weapons=${m?.weapons}`];
  g.car.vx = g.car.vz = 0; g.exitCar(); g.doorAnim = null;
  const a = g.avatar; a.state = 'foot';
  const mid = (g.boats.z0 + g.boats.z1) / 2;
  a.x = m.x; a.z = m.z + (m.z < mid ? -3.4 : 3.4); a.y = 0.15;
  log.push(`entered=${g.tryEnterCar()} car=${g.car === m}`);
  g.input.readWeapon = () => ({ fire: true, aimYaw: null, manual: false });
  const cop = g.boats.make('police', m.x + 30, (g.boats.z0 + g.boats.z1) / 2, -Math.PI / 2, 'police');
  cop.copType = 'boat'; g.boats.cops.push(cop);
  m.heading = Math.PI / 2;
  for (let i = 0; i < 90; i++) { m.vx = m.vz = 0; g.time += 1 / 30; g.updatePlay(1 / 30); }
  log.push(`police boat hp=${cop.hp.toFixed(0)} alive=${cop.alive}`);
  g.camera.position.set(m.x - 4, 5, m.z + 8); g.camera.lookAt(m.x + 4, -1, m.z);
  return log.join(' | ');
});
console.log('boat:', r);
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/gunboat.png` });

// H: controls screen
await p.evaluate(() => { const g = window.game; g.frozen = false; });
await p.keyboard.press('KeyH');
await p.waitForTimeout(400);
console.log('controls:', await p.evaluate(() => `${window.game.state} ${window.game.ui.current}`));
await p.screenshot({ path: `${out}/controls.png` });
await p.keyboard.press('KeyH');
await p.waitForTimeout(200);
console.log('after H:', await p.evaluate(() => `${window.game.state} ${window.game.ui.current}`));
console.log(errs.slice(0, 5).join('\n') || 'no errors');
await b.close();
