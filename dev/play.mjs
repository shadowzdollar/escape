// Drives the real game headlessly: node dev/play.mjs <outprefix> [script]
import { chromium } from 'playwright-core';
const [out = '/tmp/play', mode = 'basic', w = 1400, h = 800] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto('http://localhost:5180/' + (process.env.Q || ''), { waitUntil: 'load' });
await page.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 60000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}-menu.png` });
if (mode !== 'menu') {
  await page.evaluate(() => window.game.startRun());
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}-drive1.png` });
  await page.keyboard.down('KeyD');
  await page.keyboard.down('Space');
  await page.waitForTimeout(900);
  await page.keyboard.up('Space');
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}-drive2.png` });
  const st = await page.evaluate(() => { const g = window.game, p = g.player; return { state: g.state, x: p.x.toFixed(1), z: p.z.toFixed(1), speed: (p.speed*3.6).toFixed(0), hp: p.hp.toFixed(0), cops: g.police.cops.length, traffic: g.traffic.cars.length, level: g.wantedLevel, calls: g.renderer.info.render.calls }; });
  console.log(JSON.stringify(st));
}
console.log(logs.slice(0, 30).join('\n') || 'no errors');
await browser.close();
