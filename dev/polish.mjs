import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
await p.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu' && window.game.humans.ready, null, { timeout: 120000 });
for (const [q, name] of [['medium', 'city-med'], ['high', 'city-high']]) {
  await p.evaluate((q) => { const g = window.game; g.setSetting('quality', q); g.startRun(); g.frozen = true; g.simulate(3, true); g.updateCamera(0.5); }, q);
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/p-${name}.png` });
}
await p.evaluate(() => { const g = window.game; g.camera.position.set(g.player.x + 16, 7, g.player.z + 18); g.camera.lookAt(g.player.x, 2, g.player.z - 10); });
await p.waitForTimeout(700);
await p.screenshot({ path: `${out}/p-street.png` });
const counts = await p.evaluate(() => { const g = window.game; return JSON.stringify({ parked: g.city.props['pc_sedan']?.list.length, lights: g.city.props.tlPole.list.length }); });
console.log(counts);
await p.evaluate(() => { window.game.setSetting('quality', 'medium'); });
console.log(errs.slice(0, 5).join('\n') || 'no errors');
await b.close();
