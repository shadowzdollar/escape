// Verify the VESPER CITY map + Pulse Carbine in headless Chromium; writes dev/vesper-shot.png
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const chromePath = ['/usr/bin/chromium', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome'].find(fs.existsSync);
const port = 5197;
const srv = spawn('./node_modules/.bin/vite', ['preview', '--port', String(port), '--host', '127.0.0.1', '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 1500));
let failed = false;
const ok = (t, c, x = '') => { console.log(`[${c ? 'PASS' : 'FAIL'}] ${t} ${x}`); if (!c) failed = true; };
const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/sdk\.crazygames|fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route('https://sdk.crazygames.com/**', (r) => r.fulfill({ contentType: 'text/javascript', body: 'window.CrazyGames={SDK:{init:async()=>{},game:{gameplayStart(){},gameplayStop(){},loadingStart(){},loadingStop(){},happytime(){}},ad:{requestAd(t,c){c&&c.adFinished&&c.adFinished();}},data:{getItem(){return null},setItem(){},removeItem(){}},banner:{}}};' }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.game && window.game.city, null, { timeout: 90000 });
  const info = await page.evaluate(async () => {
    const g = window.game;
    await g.loadMap('vesper');
    const c = g.city;
    return { map: g.map.id, theme: c.theme && g.map.theme, boxes: c.boxes.length, ads: (c.vesperAds || []).length, hasCyber: !!c.cyber, facades: Object.keys(c.facadeMats) };
  });
  console.log(info);
  ok('vesper map loaded', info.map === 'vesper' && info.theme === 'cyber');
  ok('cyber facades built', info.facades.includes('cyber') && info.facades.includes('cybertower'));
  ok('advert panels placed', info.ads > 5, `(${info.ads})`);
  ok('vesper dressing active', info.hasCyber);
  await page.waitForTimeout(3000); // let ads + drone GLB load
  await page.evaluate(() => { window.game.startRun({ intro: false }); });
  await page.waitForTimeout(2500);
  const carb = await page.evaluate(() => {
    const g = window.game, c = g.combat;
    g.onPowerup('carbine', g.player.x, g.player.z);
    const inCar = !!g.car, carGuns = c.carGuns;
    // on-foot path of the same powerup
    const saved = g.car; g.car = null; g.onPowerup('carbine', g.player.x, g.player.z); g.car = saved;
    const w = { inCar, carGuns, weapon: c.weapon, ammo: c.ammo.carbine, next: (c.weapon = 'pistol', c.nextWeapon()) };
    c.fireBullet(g.player.x, 1.4, g.player.z, 0, 0, 1, { speed: 175, dmg: 14, spread: 0.02, ion: true });
    g.step?.(1 / 60);
    c.update(1 / 60);
    return { ...w, bullets: c.bullets.length, ion: c.bullets[0]?.ion, drones: g.city.cyber ? true : false };
  });
  ok('carbine pickup: on foot equips, in car arms guns', carb.weapon === 'carbine' && carb.ammo >= 120 && carb.next === 'carbine' && (!carb.inCar || carb.carGuns > 0), JSON.stringify(carb));
  ok('ion bolt spawns', carb.bullets >= 1 && carb.ion === true);
  await page.evaluate(() => { window.game.save.settings.camera = 'chase'; });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'dev/vesper-shot.png' });
  ok('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
} catch (e) {
  ok('test ran', false, String(e));
} finally {
  await browser.close();
  srv.kill();
}
process.exit(failed ? 1 : 0);
