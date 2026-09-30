// Scenario screenshots: node dev/shots.mjs <outdir>
import { chromium } from 'playwright-core';
const [out = '/tmp'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto('http://localhost:5174/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 90000 });
const scen = (process.env.SCEN || 'cutout,garage,maps,over,desert,snow').split(',');
for (const s of scen) {
  if (s === 'cutout') {
    await page.evaluate(() => {
      const g = window.game; g.startRun();
      // find the tallest building and park just north of it (camera is south)
      const b = g.city.boxes.filter((b) => b.kind === 'building').sort((a, c) => c.h - a.h)[0];
      g.player.place((b.x0 + b.x1) / 2, b.z0 - 10, Math.PI / 2);
      g.simulate(1.5, false);
    });
    await page.waitForTimeout(1500);
  } else if (s === 'garage') {
    await page.evaluate(() => { const g = window.game; g.toMenu(); g.save.coins = 4000; g.ui.openGarage(); g.ui.garageIndex = 4; g.ui.renderGarage(); });
    await page.waitForTimeout(1500);
  } else if (s === 'maps') {
    await page.evaluate(() => window.game.ui.openMaps());
    await page.waitForTimeout(500);
  } else if (s === 'over') {
    await page.evaluate(() => { const g = window.game; g.startRun(); g.simulate(12, true); g.gameOver('busted'); g.simulate(2.0, false); });
    await page.waitForTimeout(2500);
  } else if (s === 'desert' || s === 'snow') {
    await page.evaluate((m) => window.game.selectMap(m), s);
    await page.waitForFunction(() => window.game.state === 'menu', null, { timeout: 90000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/x-${s}-menu.png` });
    await page.evaluate(() => { const g = window.game; g.startRun(); g.simulate(8, true); });
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: `${out}/x-${s}.png` });
}
console.log(logs.slice(0, 20).join('\n') || 'no errors');
await browser.close();
