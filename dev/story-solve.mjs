// Plays missions "for real" (teleport-assisted): each step is completed through the game's
// own mechanics, never by calling complete(). Checks every step type can be finished.
//   node dev/story-solve.mjs <outdir> id1 id2 ...
import { chromium } from 'playwright-core';
const [out, ...ids] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
await p.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu' && window.game.humans.ready, null, { timeout: 120000 });
let shot = 0;
for (const id of ids) {
  const r = await p.evaluate(async (id) => {
    const g = window.game;
    g.save.settings.intro = false; g.save.settings.voice = false;
    await g.startMission(id, 0);
    g.frozen = true; g.bustLimit = 1e9;
    const m = g.mission, log = [];
    const tp = (x, z) => { const P = g.player; P.x = x; P.z = z; if (P.vx !== undefined) { P.vx = 0; P.vz = 0; } };
    const onFoot = () => { if (g.car) { g.car.vx = g.car.vz = 0; g.exitCar(); g.doorAnim = null; g.avatar.state = 'foot'; } };
    const inCar = (v) => { if (g.car !== v) { onFoot(); g.avatar.state = 'foot'; g.commitEnter(v); } };
    const anyCar = () => { if (!g.car) { const v = [...g.vehicles].find((x) => x.kind === 'traffic' && !x.boat) || [...g.vehicles].find((x) => !x.boat && x.alive); if (v) { tp(v.x + 2, v.z); inCar(v); } } };
    let guard = 0;
    while (g.mission === m && !m.done && !m.failed && guard++ < 60) {
      const k = m.idx, s = m.step, st = m.st;
      let f = 0;
      while (m.idx === k && !m.failed && !m.done && f++ < 30 * 200) {
        g.player.hp = Math.max(g.player.hp, 500);
        const P = g.player;
        switch (s.t) {
          case 'reach':
            if (s.foot || s.swim) onFoot();
            if (s.boat) { const bt = st.boat || [...g.vehicles].find((v) => v.boat && v.kind === 'empty'); if (bt && !g.car?.boat) inCar(bt); }
            if (f > 5) tp(st.pt.x + 1, st.pt.z);
            break;
          case 'collect': { const mk = m.markers[0]; if (mk) tp(mk.x, mk.z); break; }
          case 'kill':
            if (st.car) { st.car.damage(50); if (!st.car.alive && !st.car.destroyed) g.onDestroyed(st.car); break; }
            onFoot(); if (st.tgt && !st.tgt.dead && f > 10) { tp(st.tgt.x - 1, st.tgt.z); if (f % 10 === 0) m.consumeInteract(); } break;
          case 'takedown': case 'chaseOn':
            tp(st.v.x + 25, st.v.z); if (f % 5 === 0) { st.v.damage(60); if (!st.v.alive && !st.v.destroyed) g.onDestroyed(st.v); } break;
          case 'tail': { const v = st.v; anyCar(); tp(v.x - Math.sin(v.heading) * 40, v.z - Math.cos(v.heading) * 40); break; }
          case 'steal': if (f > 5) { tp(st.v.x + 2, st.v.z); inCar(st.v); } break;
          case 'deliver': if (m.vehicle && g.car !== m.vehicle) inCar(m.vehicle); if (f > 5 && g.car) { g.car.x = st.pt.x; g.car.z = st.pt.z; g.car.vx = g.car.vz = 0; } break;
          case 'hold': tp(st.pt.x, st.pt.z); break;
          case 'clear': tp(st.pt.x + 30, st.pt.z); for (const q of st.list) if (!q.dead && f % 15 === 0) { q.hp = 0; q.dead = true; g.people.knock(q, 1, 1); } break;
          case 'race': { const pt = st.pts[st.k]; if (pt) tp(pt.x, pt.z); break; }
          case 'plant': case 'scout': { onFoot(); const site = st.sites.find((x) => !x.ok); if (site) tp(site.x, site.z); break; }
          case 'meet': if (st.who) { onFoot(); tp(st.who.x + 1.5, st.who.z); } break;
          case 'wreck': { if (f % 20 === 0) { const c = g.police.cops.find((v) => v.alive && (s.of === 'any' || !s.of || v.copType === s.of)) || g.boats.cops.find((v) => v.alive); if (c) { c.damage(9999); if (!c.destroyed) g.onDestroyed(c); } } break; }
          case 'heli': if (f % 30 === 0) { const h = g.military.gunships.find((x) => !x.falling) || (g.police.heli && !g.police.heli.falling ? g.police.heli : null); if (h) g.damageHeli(h, 9999); } break;
          case 'evade': for (const c of g.police.cops) { c.x = P.x + 500; c.z = P.z + 500; } if (g.police.heli) { g.police.heli.x = P.x + 600; } for (const o of g.people.list) if (o.copFoot) { o.x = P.x + 400; } break;
        }
        g.time += 1 / 30; g.updatePlay(1 / 30);
        if (g.state !== 'playing') break;
      }
      log.push(`${s.t}${m.failed ? '!FAIL' : m.idx === k && !m.done ? '!STUCK' : ''}`);
      if (m.idx === k && !m.done && !m.failed) break;
      if (g.state !== 'playing') break;
    }
    const res = `${m.done ? 'DONE' : m.failed ? 'FAILED' : 'STUCK'} [${log.join(' ')}] t=${m.t.toFixed(0)}s`;
    return res;
  }, id);
  console.log(id.padEnd(8), r);
  if (shot++ < 2) { await p.evaluate(() => { const g = window.game; g.frozen = false; }); await p.waitForTimeout(1800); await p.screenshot({ path: `${out}/solve-${id}.png` }); }
  await p.evaluate(() => { const g = window.game; g.frozen = false; g.toMenu(); });
}
console.log(errs.slice(0, 8).join('\n') || 'no errors');
await b.close();
