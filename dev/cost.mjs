// Deterministic render cost: triangles + draw calls for one full frame (all passes incl. shadows).
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
for (const noKit of [true, false]) {
  for (const q of ['medium', 'high']) {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    if (noKit) await p.addInitScript(() => { window.__noKit = true; });
    await p.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction(() => window.game && window.game.state === 'menu' && window.game.humans.ready, null, { timeout: 120000 });
    const r = await p.evaluate((q) => {
      const g = window.game;
      g.setSetting('quality', q);
      g.startRun(); g.frozen = true; g.bustLimit = 1e9; g.player.hp = 9999; g.simulate(8, true); g.player.hp = 9999;
      const out = [];
      for (const k of [0, 1, 2]) {
        g.simulate(2, true);
        g.updateCamera(1);
        const info = g.renderer.info; info.autoReset = false; info.reset();
        g.render();
        out.push(`${(info.render.triangles / 1000) | 0}k/${info.render.calls}`);
        info.autoReset = true;
      }
      return out.join(' ');
    }, q);
    console.log(noKit ? 'procedural' : 'quaternius', q.padEnd(7), 'tris/calls per frame:', r);
    await p.close();
  }
}
await b.close();
