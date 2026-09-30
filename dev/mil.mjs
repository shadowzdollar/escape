import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + e.stack));
await p.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 90000 });
await p.evaluate(() => { const g = window.game; g.startRun(); g.frozen = true; g.heat = 400; g.bustLimit = 1e9; });
for (let k = 0; k < 6; k++) {
  const r = await p.evaluate(() => {
    const g = window.game; g.player.hp = 9999;
    g.simulate(5, true);
    const m = g.military;
    return JSON.stringify({ t: g.runTime.toFixed(1), lvl: g.wantedLevel, tanks: g.police.cops.filter(c => c.copType === 'tank').length, gunship: !!m.gunship,
      proj: m.projectiles.map(q => q.kind).join(''), warn: m.warnings.length, scorch: m.scorch.length, wrecks: g.wrecks, people: g.people.list.length, down: g.people.list.filter(q => q.mode === 'down').length });
  });
  console.log(r);
}
// frame the action: camera between player and nearest tank
await p.evaluate(() => { const g = window.game; g.updateCamera(0.5); });
await p.waitForTimeout(600);
await p.screenshot({ path: out + '/mil-1.png' });
await p.evaluate(() => { const g = window.game; const t = g.police.cops.find(c => c.copType === 'tank'); if (t) { g.camera.position.set(t.x + 10, 7, t.z + 12); g.camera.lookAt(t.x, 1.5, t.z); } });
await p.waitForTimeout(600);
await p.screenshot({ path: out + '/mil-tank.png' });
await p.evaluate(() => { const g = window.game; const h = g.military.gunship; if (h) { g.camera.position.set(h.x + 12, h.y + 4, h.z + 14); g.camera.lookAt(h.x, h.y, h.z); } });
await p.waitForTimeout(600);
await p.screenshot({ path: out + '/mil-heli.png' });
console.log(errs.join('\n') || 'no errors');
await b.close();
