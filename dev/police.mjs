import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('pageerror', (e) => logs.push(e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
await page.goto('http://localhost:5180/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 90000 });
// 1) idle player should get busted
let r = await page.evaluate(() => {
  const g = window.game; g.startRun();
  const log = [];
  for (let i = 0; i < 12 && g.state === 'playing'; i++) {
    g.simulate(2.5, false);
    const n = g.police.nearestCopDistance();
    log.push(`t=${g.runTime.toFixed(1)} cops=${g.police.cops.length} near=${n.d.toFixed(0)} bust=${g.bustTimer.toFixed(2)} hp=${g.player.hp.toFixed(0)} state=${g.state}`);
  }
  return log;
});
console.log('IDLE TEST\n' + r.join('\n'));
await page.screenshot({ path: `${out}/p-idle.png` });
// 2) high heat: heli, swat, roadblocks
r = await page.evaluate(() => {
  const g = window.game; g.startRun(); g.heat = 230;
  const log = [];
  for (let i = 0; i < 8 && g.state === 'playing'; i++) {
    g.player.hp = 999; // invulnerable for the test
    g.simulate(4, true);
    const types = {};
    for (const c of g.police.cops) types[c.copType + (c.ai.mode === 'block' ? '(block)' : '')] = (types[c.copType + (c.ai.mode === 'block' ? '(block)' : '')] || 0) + 1;
    log.push(`t=${g.runTime.toFixed(1)} lvl=${g.wantedLevel} ${JSON.stringify(types)} heli=${!!g.police.heli} spikes=${g.police.spikes.length} wrecks=${g.wrecks} nearest=${g.police.nearestCopDistance().d.toFixed(0)}`);
  }
  return log;
});
console.log('HIGH HEAT TEST\n' + r.join('\n'));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/p-heat.png` });
console.log(logs.join('\n') || 'no errors');
await browser.close();
