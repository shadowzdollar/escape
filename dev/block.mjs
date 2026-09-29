import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + e.stack));
await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 90000 });
const info = await p.evaluate(() => {
  const g = window.game; g.startRun(); g.frozen = true; g.heat = 300; g.bustLimit = 1e9;
  // drive straight down the long avenue so a block can form ahead
  g.player.place(-4, -300, 0);
  g.input.read = () => ({ steer: 0, throttle: 0.6, brake: 0, handbrake: false, nitro: false });
  let t = 0;
  while (!g.military.block && t < 40) { g.player.hp = 999; g.time += 1/30; g.updatePlay(1 / 30); t += 1 / 30; }
  const bl = g.military.block;
  if (!bl) return { ok: false, t };
  // stop the player 70m before the block and let the tanks open fire
  const p = g.player;
  const dx = bl.x - p.x, dz = bl.z - p.z, d = Math.hypot(dx, dz);
  p.place(bl.x - dx / d * 70, bl.z - dz / d * 70, Math.atan2(dx, dz));
  g.input.read = () => ({ steer: 0, throttle: 0, brake: 0, handbrake: true, nitro: false });
  let shots = 0;
  for (let i = 0; i < 150; i++) { p.hp = 999; g.time += 1/30; g.updatePlay(1 / 30); g.effects.update(1/30, 0, 0); if (g.military.projectiles.some(q => q.kind === 'shell')) shots++; }
  const tanks = bl.tanks.map(t => ({ mode: t.ai.mode, x: t.x.toFixed(1), z: t.z.toFixed(1) }));
  // camera behind the player, looking down the road at the block
  g.camera.position.set(p.x - dx / d * 9, 5.5, p.z - dz / d * 9);
  g.camera.lookAt(bl.x, 1.5, bl.z);
  g.focus.x = p.x; g.focus.z = p.z;
  return { ok: true, t: t.toFixed(1), tanks, soldiers: bl.soldiers.map(s => s.mode).join(','), shellFrames: shots, hp: p.hp.toFixed(0), scorch: g.military.scorch.length, spikes: g.police.spikes.length };
});
console.log(JSON.stringify(info));
await p.waitForTimeout(700);
await p.screenshot({ path: out + '/blk-1.png' });
await p.evaluate(() => { const g = window.game, bl = g.military.block; const p = g.player; const dx = bl.x - p.x, dz = bl.z - p.z, d = Math.hypot(dx, dz);
  g.camera.position.set(bl.x - dx / d * 22 + dz / d * 10, 8, bl.z - dz / d * 22 - dx / d * 10); g.camera.lookAt(bl.x, 1, bl.z); g.focus.x = bl.x; g.focus.z = bl.z; });
await p.waitForTimeout(700);
await p.screenshot({ path: out + '/blk-2.png' });
console.log(errs.join('\n') || 'no errors');
await b.close();
