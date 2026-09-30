import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
await p.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 120000 });
await p.evaluate(() => window.game.selectMap('giza'));
await p.waitForFunction(() => window.game.state === 'menu' && window.game.map.id === 'giza', null, { timeout: 120000 });
const info = await p.evaluate(() => { const g = window.game; return JSON.stringify({ landmarks: g.city.landmarks, airstrip: g.city.airstrip }); });
console.log(info);
const views = [['giza-plateau', (L) => { const py = L.find((l) => l.kind === 'pyramid'); return [py.x - 120, 70, py.z - 70, py.x + 20, 5, py.z + 20]; }],
  ['giza-sphinx', (L) => { const s = L.find((l) => l.kind === 'sphinx'); return [s.x + 30, 12, s.z + 18, s.x, 6, s.z]; }],
  ['giza-city', () => [60, 45, 90, 0, 0, 20]]];
for (const [name] of views) {
  await p.evaluate((name) => {
    const g = window.game, L = g.city.landmarks;
    const f = { 'giza-plateau': () => { const py = L.find((l) => l.kind === 'pyramid'); return [py.x - 130, 75, py.z - 85, py.x + 15, 5, py.z + 15]; },
      'giza-sphinx': () => { const s = L.find((l) => l.kind === 'sphinx'); return [s.x + 32, 13, s.z + 20, s.x, 6, s.z]; },
      'giza-city': () => [70, 50, 110, 0, 0, 10] }[name]();
    g.frozen = true;
    document.getElementById('menu').classList.remove('show');
    g.showcase.root.visible = false;
    g.camera.position.set(f[0], f[1], f[2]); g.camera.lookAt(f[3], f[4], f[5]);
    g.focus.x = f[3]; g.focus.z = f[5];
  }, name);
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/${name}.png` });
}
console.log(errs.slice(0, 5).join('\n') || 'no errors');
await b.close();
