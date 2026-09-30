import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + e.stack));
p.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu' && window.game.humans.ready, null, { timeout: 120000 });
const st = await p.evaluate(() => {
  const g = window.game; g.frozen = true;
  for (let i = 0; i < 300; i++) { g.time += 1 / 30; g.people.update(1 / 30); g.humans.update(1 / 30); }
  const rigged = g.people.list.filter((q) => q.rig);
  const modes = {}; for (const q of rigged) modes[q.mode + ':' + q.rig.current] = (modes[q.mode + ':' + q.rig.current] || 0) + 1;
  return { people: g.people.list.length, rigged: rigged.length, kinds: [...new Set(rigged.map((q) => q.rigKind))].join(','), modes };
});
console.log(JSON.stringify(st));
const shot = async (name, pick, off) => {
  const ok = await p.evaluate(([pick, off]) => {
    const g = window.game;
    const q = g.people.list.find(new Function('q', 'return ' + pick));
    if (!q) return false;
    for (let i = 0; i < 10; i++) { g.people.update(1 / 30); g.humans.update(1 / 30); }
    g.camera.position.set(q.x + off[0], q.y + off[1], q.z + off[2]); g.camera.lookAt(q.x, q.y + 1.0, q.z);
    g.focus.x = q.x; g.focus.z = q.z;
    g.showcase.root.visible = false;
    document.getElementById('menu').classList.remove('show');
    return true;
  }, [pick, off]);
  if (!ok) { console.log('none for', name); return; }
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/r-${name}.png` });
};
await shot('walk', "q.rig && q.rig.current==='Walk'", [2.8, 1.6, 3.2]);
await shot('group', "q.rig && q.mode==='talk'", [3.6, 1.8, 3.6]);
await shot('pair', "q.rig && q.leader && q.speed>0.4 && q.rig", [3.2, 1.7, 3.4]);
const seq = await p.evaluate(() => {
  const g = window.game; const q = g.people.list.filter((q) => q.rig && q.mode === 'walk').sort((a, c) => Math.hypot(a.x - g.focus.x, a.z - g.focus.z) - Math.hypot(c.x - g.focus.x, c.z - g.focus.z))[0];
  if (!q) return 'no rigged walker';
  g.people.knock(q, 11, 2);
  const o = [];
  for (let i = 0; i < 270; i++) { g.people.update(1 / 30); g.humans.update(1 / 30); if (i % 20 === 0) o.push(q.mode + '/' + (q.rig ? q.rig.current : '-')); }
  return o.join(' ');
});
console.log('knock:', seq);
console.log(errs.slice(0, 8).join('\n') || 'no errors');
await b.close();
