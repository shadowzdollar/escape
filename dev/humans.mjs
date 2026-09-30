// Close-up screenshots of pedestrian behaviours + a knock-down recovery trace.
import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + e.stack));
await p.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 90000 });
const stats = await p.evaluate(() => {
  const g = window.game; g.frozen = true;
  g.people.target = 110;
  for (let i = 0; i < 400; i++) { g.time += 1 / 30; g.people.update(1 / 30); }
  const modes = {}; for (const q of g.people.list) modes[q.mode] = (modes[q.mode] || 0) + 1;
  return { n: g.people.list.length, modes, follow: g.people.list.filter((q) => q.leader).length, kids: g.people.list.filter((q) => q.child).length };
});
console.log(JSON.stringify(stats));
const shot = async (name, pick, off = [3.2, 1.9, 3.2]) => {
  const ok = await p.evaluate(([pick, off]) => {
    const g = window.game;
    const q = g.people.list.find(new Function('q', 'return ' + pick));
    if (!q) return false;
    for (let i = 0; i < 20; i++) g.people.update(1 / 30);
    g.camera.position.set(q.x + off[0], q.y + off[1], q.z + off[2]); g.camera.lookAt(q.x, q.y + 1.0, q.z);
    g.focus.x = q.x; g.focus.z = q.z;
    if (g.showcase) g.showcase.root.visible = false;
    document.getElementById('menu').classList.remove('show');
    return true;
  }, [pick, off]);
  if (!ok) { console.log('none for', name); return; }
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/h-${name}.png` });
};
await shot('walk', "q.mode==='walk' && q.speed>0.8 && !q.followers.length");
await shot('kid', 'q.child && q.leader && q.speed>0.5', [2.6, 1.5, 2.6]);
await shot('talk', "q.mode==='talk' && q.cluster && q.cluster.members.length>=2", [3.5, 2, 3.5]);
await shot('sit', "q.mode==='sit'", [2.5, 1.4, 2.5]);
await shot('cross', "q.mode==='waitCross'", [4, 2.4, 4]);
const trace = await p.evaluate(() => {
  const g = window.game; const q = g.people.list.find((q) => q.mode === 'walk');
  g.people.knock(q, 12, 3);
  const out = [];
  for (let i = 0; i < 300; i++) { g.people.update(1 / 30); if (i % 15 === 0) out.push(q.mode + ':' + q.fallP.toFixed(2)); }
  return out.join(' ');
});
console.log('knock sequence:', trace);
console.log(errs.join('\n') || 'no errors');
await b.close();
