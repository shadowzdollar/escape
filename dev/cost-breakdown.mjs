import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu' && window.game.humans.ready, null, { timeout: 120000 });
console.log(await p.evaluate(() => {
  const g = window.game;
  g.setSetting('quality', 'medium');
  g.startRun(); g.frozen = true; g.bustLimit = 1e9; g.player.hp = 9999; g.simulate(8, true);
  const outAll = [];
  const spots = ["oldtown", "park", "suburb", "downtown"]; for (let step = 0; step < 4; step++) { const bl = g.city.blocks.find((x) => x.type === spots[step]); g.car.place(bl.x0 - 8, (bl.z0 + bl.z1) / 2, 0); g.focus.x = g.car.x; g.focus.z = g.car.z; g.camTarget.set(g.car.x, 0, g.car.z); for (let k = 0; k < 40; k++) g.updateCamera(0.1); outAll.push(spots[step]);
  const info = g.renderer.info; info.autoReset = false;
  const frame = () => { info.reset(); g.render(); return info.render.triangles; };
  const base = frame();
  const fam = {};
  for (const o of g.city.group.children) if (o.isInstancedMesh && o.name.startsWith('k_')) { const f = o.name.replace(/^k_/, '').replace(/_\d+(__lo)?$/, '') + (o.name.endsWith('__lo') ? ' (far)' : ''); (fam[f] ||= []).push(o); }
  const rows = [];
  for (const [f, list] of Object.entries(fam)) {
    const vis = list.map((o) => o.visible); list.forEach((o) => { o.visible = false; });
    const t = frame(); list.forEach((o, i) => { o.visible = vis[i]; });
    if (base - t > 3000) rows.push([f, ((base - t) / 1000) | 0]);
  }
  rows.sort((a, b) => b[1] - a[1]);
  outAll.push(`total ${(base / 1000) | 0}k  ` + rows.slice(0, 7).map((r) => `${r[0]}:${r[1]}k`).join(' '));
  }
  return outAll.join('\n');
}));
await b.close();
