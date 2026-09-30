import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
await p.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu' && window.game.humans.ready, null, { timeout: 120000 });
await p.evaluate(() => { const g = window.game; g.save.settings.intro = false; g.ui.openModes(); });
await p.waitForTimeout(400);
await p.screenshot({ path: out + '/s3-modes.png' });
await p.evaluate(() => window.game.ui.openStory());
await p.waitForTimeout(400);
await p.screenshot({ path: out + '/s3-story.png' });
// mission 1: drive, then warp near the safehouse and finish
const r = await p.evaluate(async () => {
  const g = window.game; await g.startMission('m1'); g.frozen = true; g.bustLimit = 1e9;
  g.simulate(4, true);
  const st = g.mission.status();
  const t = g.mission.target();
  const log = [`m1 obj=${st.label} ${st.prog} clock=${st.clock} heatCap=${g.heat.toFixed(0)} lvl=${g.wantedLevel + 1}`];
  g.player.place(t.x, t.z + 3, 0);
  g.simulate(1, false);
  log.push(`after warp: state=${g.state} done=${g.mission.done} stars=${g.mission.stars()} unlocked=${g.save.campaign.unlocked}`);
  return log.join('\n');
});
console.log(r);
await p.evaluate(() => { window.game.frozen = false; });
await p.waitForTimeout(2600);
await p.screenshot({ path: out + '/s3-win.png' });
// mission 2: survive then evade (suppressed spawns)
const r2 = await p.evaluate(async () => {
  const g = window.game; await g.startMission('m2'); g.frozen = true; g.bustLimit = 1e9;
  const log = [];
  for (let k = 0; k < 8 && g.state === 'playing'; k++) { g.player.hp = 999; if (g.mission.obj?.type === 'evade' && !g.warped) { g.warped = true; const q = g.city.randomRoadSpot(Math.random, g.player.x, g.player.z, 380, 520); g.player.place(q.x, q.z, q.heading); } g.simulate(12, !g.warped); const s = g.mission.status(); log.push(`t=${g.mission.t.toFixed(0)} ${s.label} ${s.prog} lvl=${g.wantedLevel + 1}`); }
  return log.join('\n') + `\nstate=${g.state} done=${g.mission.done}`;
});
console.log(r2);
await p.evaluate(() => { const g = window.game; g.frozen = false; });
await p.waitForTimeout(500);
await p.screenshot({ path: out + '/s3-m2.png' });
console.log(errs.slice(0, 6).join('\n') || 'no errors');
await b.close();
