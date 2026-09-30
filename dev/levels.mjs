import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + e.stack));
await p.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 90000 });
for (const [heat, label] of [[230, '5star'], [300, '6star'], [380, '7star']]) {
  const r = await p.evaluate((heat) => {
    const g = window.game; g.startRun(); g.frozen = true; g.heat = heat; g.bustLimit = 1e9;
    const log = [];
    for (let k = 0; k < 5; k++) {
      g.player.hp = 9999; g.simulate(6, true);
      const types = {};
      for (const c of g.police.cops) if (c.alive) { const key = c.copType + (c.ai.mode === 'fort' ? '(fort)' : ''); types[key] = (types[key] || 0) + 1; }
      log.push(`t=${g.runTime.toFixed(0)} lvl=${g.wantedLevel + 1}★ ${JSON.stringify(types)} gunships=${g.military.gunships.length} block=${!!g.military.block} proj=${g.military.projectiles.length}`);
    }
    g.updateCamera(0.5);
    return log;
  }, heat);
  console.log(label + '\n  ' + r.join('\n  '));
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/lv-${label}.png` });
}
console.log(errs.join('\n') || 'no errors');
await b.close();
