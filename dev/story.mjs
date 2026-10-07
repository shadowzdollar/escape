// Story smoke test: every mission (or a range), every step begins + simulates, then is forced complete.
//   node dev/story.mjs <outdir> [fromSeq] [toSeq] [contracts]
import { chromium } from 'playwright-core';
const [out, from = '1', to = '12', withContracts = ''] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
await p.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu' && window.game.humans.ready, null, { timeout: 120000 });
const ids = await p.evaluate(async ({ from, to, withContracts }) => {
  const S = await import('/src/story/index.js');
  const E = await import('/src/story/engine.js');
  const bad = [];
  for (const m of [...S.STORY]) for (const s of m.steps) if (!E.STEP_TYPES.includes(s.t)) bad.push(`${m.id}:${s.t}`);
  const list = withContracts === 'conly' ? [] : S.STORY.filter((m) => m.seq >= +from && m.seq <= +to).map((m) => m.id);
  if (withContracts) for (let q = +from; q <= +to; q++) list.push(...S.contractsFor(q, 1).slice(0, 20).map((c) => c.id));
  return { list, bad, total: S.TOTAL_MISSIONS, story: S.STORY.length };
}, { from, to, withContracts });
console.log(`missions: story=${ids.story} total=${ids.total} bad step types: ${ids.bad.join(',') || 'none'} testing ${ids.list.length}`);
let n = 0;
for (const id of ids.list) {
  const before = errs.length;
  const r = await p.evaluate(async (id) => {
    const g = window.game;
    g.save.settings.intro = false;
    g.save.settings.voice = false;
    await g.startMission(id, 0);
    g.frozen = true; g.bustLimit = 1e9;
    const m = g.mission;
    const log = [];
    let guard = 0;
    while (g.mission === m && !m.done && !m.failed && guard++ < 40) {
      const k = m.idx, type = m.step.t;
      for (let i = 0; i < 45 && m.idx === k && !m.failed; i++) { g.player.hp = Math.max(g.player.hp, 400); g.time += 1 / 30; g.updatePlay(1 / 30); }
      const st = m.status();
      log.push(`${type}${m.failed ? '!FAIL' : ''}`);
      if (m.failed) break;
      if (m.idx === k) m.complete();
      if (g.state !== 'playing') break;
    }
    const res = `${m.done ? 'DONE' : m.failed ? 'FAILED' : 'STUCK'} [${log.join(' ')}] state=${g.state} people=${g.people.list.length} veh=${g.vehicles.size}`;
    g.frozen = false;
    g.toMenu();
    return res;
  }, id);
  n++;
  console.log(id.padEnd(8), r, errs.length > before ? 'ERRORS: ' + errs.slice(before).map((e) => e.split('\n')[0]).join(' | ') : '');
}
// screenshots of the new screens
await p.evaluate(() => { const g = window.game; g.ui.openStory(3); });
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/story-menu.png` });
await p.evaluate(async () => { const S = await import('/src/story/index.js'); window.game.ui.openBrief(S.STORY[12]); });
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/story-brief.png` });
console.log(errs.slice(0, 8).join('\n') || 'no errors');
await b.close();
