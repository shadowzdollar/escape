// Fast-forward simulation test: node dev/sim.mjs <outprefix> <seconds> [map]
import { chromium } from 'playwright-core';
const [out = '/tmp/sim', secs = 60, map = 'city', w = 1280, h = 720] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 90000 });
if (map !== 'city') {
  await page.evaluate((m) => window.game.selectMap(m), map);
  await page.waitForFunction(() => window.game.state === 'menu', null, { timeout: 90000 });
}
await page.evaluate(() => window.game.startRun());
const chunk = 10;
for (let t = 0; t < +secs; t += chunk) {
  const r = await page.evaluate((c) => {
    const g = window.game; const ms = g.simulate(c);
    const p = g.player;
    return { t: g.runTime.toFixed(1), state: g.state, msPerStep: ms.toFixed(2), pos: [p.x.toFixed(0), p.z.toFixed(0)], kmh: (p.speed * 3.6).toFixed(0), hp: p.hp.toFixed(0), lvl: g.wantedLevel, heat: g.heat.toFixed(0),
      cops: g.police.cops.filter(c => c.alive).length, copDist: g.police.nearestCopDistance().d.toFixed(0), traffic: g.traffic.cars.length, coins: g.runCoins, score: g.score.toFixed(0), wrecks: g.wrecks, nm: g.nearMisses, bust: g.bustTimer.toFixed(2), heli: !!g.police.heli, spikes: g.police.spikes.length };
  }, chunk);
  console.log(JSON.stringify(r));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}-${String(t + chunk).padStart(3, '0')}.png` });
  if (r.state !== 'playing') break;
}
console.log(logs.slice(0, 30).join('\n') || 'no errors');
await browser.close();
