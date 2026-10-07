// In-mission HUD (title card, dialogue, objective, stealth) + fail → retry-from-checkpoint flow.
import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
await p.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu' && window.game.humans.ready, null, { timeout: 120000 });
await p.evaluate(async () => { const g = window.game; g.save.settings.voice = false; g.save.settings.intro = false; await g.startMission('s2m7', 0); });
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/hud-title.png` });
// jump to the kill step and walk close to the guards
await p.evaluate(() => {
  const g = window.game, m = g.mission;
  while (m.step.t !== 'kill') m.complete();
  g.car.vx = g.car.vz = 0; g.exitCar(); g.doorAnim = null; g.avatar.state = 'foot';
  const t = m.st.tgt;
  g.avatar.x = t.x + 12; g.avatar.z = t.z + 4;
});
await p.waitForTimeout(6500);
await p.screenshot({ path: `${out}/hud-stealth.png` });
console.log('status:', JSON.stringify(await p.evaluate(() => window.game.mission.status())));
// takedown from behind
console.log('takedown:', await p.evaluate(() => { const g = window.game, m = g.mission, t = m.st.tgt; g.avatar.x = t.x - Math.sin(t.heading) * 1.2; g.avatar.z = t.z - Math.cos(t.heading) * 1.2; return m.consumeInteract() + ' dead=' + t.dead; }));
await p.waitForTimeout(800);
console.log('after:', JSON.stringify(await p.evaluate(() => window.game.mission.status())));
// fail the mission and retry from the checkpoint
await p.evaluate(() => window.game.mission.fail('Test failure.'));
await p.waitForTimeout(2200);
await p.screenshot({ path: `${out}/hud-fail.png` });
const cp = await p.evaluate(() => JSON.stringify(window.game.save.story.checkpoint));
await p.click('[data-action="sr-retry"]');
await p.waitForFunction(() => window.game.state === 'playing' && window.game.mission, null, { timeout: 60000 });
console.log('checkpoint', cp, '→ restarted at step', await p.evaluate(() => window.game.mission.idx + ' ' + window.game.mission.step.t));
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/hud-retry.png` });
console.log(errs.slice(0, 5).join('\n') || 'no errors');
await b.close();
