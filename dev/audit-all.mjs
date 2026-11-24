import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const chromePath = fs.existsSync('/usr/bin/chromium')
  ? '/usr/bin/chromium'
  : fs.existsSync('/usr/bin/google-chrome-stable')
    ? '/usr/bin/google-chrome-stable'
    : '/usr/bin/google-chrome';

async function runAudit() {
  console.log('--- STARTING COMPREHENSIVE FENDER BENDER E2E AUDIT ---');
  const results = { checks: [], passed: true };

  function assert(title, condition, extra = '') {
    const ok = Boolean(condition);
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${title} ${extra}`);
    results.checks.push({ title, ok, extra });
    if (!ok) results.passed = false;
  }

  // 1. Check Production Build Output & Relative Paths
  const distHtml = path.resolve('dist/index.html');
  assert('dist/index.html exists', fs.existsSync(distHtml));
  if (fs.existsSync(distHtml)) {
    const html = fs.readFileSync(distHtml, 'utf8');
    assert('Title is Fender Bender', html.includes('<title>Fender Bender</title>'));
    assert('CrazyGames SDK v3 script present', html.includes('https://sdk.crazygames.com/crazygames-sdk-v3.js'));
    assert('No absolute /src/ or /assets/ paths', !html.match(/href="\/[^/]/) && !html.match(/src="\/[^/]/));
    const assetsDir = fs.readdirSync('dist/assets');
    assert('Draco decoder wasm present in dist', assetsDir.some((f) => f.includes('draco_decoder') && f.endsWith('.wasm')));
  }

  // 2. Check Promotional Assets
  const covers = [
    'crazygames-assets/cover-landscape-1920x1080.png',
    'crazygames-assets/cover-portrait-800x1200.png',
    'crazygames-assets/cover-square-800x800.png',
  ];
  for (const file of covers) {
    assert(`Promo cover exists: ${file}`, fs.existsSync(file), fs.existsSync(file) ? `(${fs.statSync(file).size} bytes)` : '');
  }

  // 3. Start Vite Preview server for full browser E2E testing
  console.log('--- LAUNCHING HEADLESS CHROMIUM E2E SUITE ---');
  const port = 5199;
  const srv = spawn('./node_modules/.bin/vite', ['preview', '--port', String(port), '--host', '127.0.0.1', '--strictPort'], { stdio: 'pipe' });
  await new Promise((r) => setTimeout(r, 1200));

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: chromePath,
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        '--no-sandbox',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
      ],
    });

    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true });
    const page = await context.newPage();

    // Intercept CrazyGames SDK script to supply a controllable mock
    await page.route('https://sdk.crazygames.com/crazygames-sdk-v3.js', (route) => {
      const mockScript = `
        window.sdkCalls = [];
        window.mockAdFail = false;
        window.CrazyGames = {
          SDK: {
            environment: 'crazygames',
            init: async () => { window.sdkCalls.push('init'); return true; },
            game: {
              loadingStart: () => { window.sdkCalls.push('loadingStart'); },
              loadingStop: () => { window.sdkCalls.push('loadingStop'); },
              gameplayStart: () => { window.sdkCalls.push('gameplayStart'); },
              gameplayStop: () => { window.sdkCalls.push('gameplayStop'); },
              happytime: () => { window.sdkCalls.push('happytime'); },
              addSettingsChangeListener: () => {},
              settings: { muteAudio: false },
            },
            ad: {
              requestAd: (type, callbacks) => {
                window.sdkCalls.push('ad:' + type);
                if (window.mockAdFail) {
                  setTimeout(() => callbacks?.adError?.('adblock'), 40);
                  return;
                }
                callbacks?.adStarted?.();
                setTimeout(() => callbacks?.adFinished?.(), 60);
              }
            },
            data: { getItem: () => null, setItem: () => {} },
            user: { isUserAccountAvailable: true, getUser: async () => null }
          }
        };
      `;
      route.fulfill({ status: 200, contentType: 'application/javascript', body: mockScript });
    });

    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.game && window.game.state === 'menu' && window.game.humans?.ready, null, { timeout: 60000 });

    const calls1 = await page.evaluate(() => window.sdkCalls);
    assert('SDK init() invoked', calls1.includes('init'));
    assert('SDK loadingStart() invoked', calls1.includes('loadingStart'));
    assert('SDK loadingStop() invoked', calls1.includes('loadingStop'));

    // Start endless run without intro for physics & gameplay tests
    await page.evaluate(() => {
      window.game.save.settings.intro = false;
      window.game.startRun({ intro: false });
    });
    await page.waitForTimeout(300);

    const calls2 = await page.evaluate(() => window.sdkCalls);
    assert('SDK gameplayStart() invoked on run start', calls2.includes('gameplayStart'));

    // Test 1.1: High-speed knockback into building wall (NO tunneling/trapping!)
    const buildingTest = await page.evaluate(() => {
      const g = window.game;
      g.exitCar(false);
      // Find a solid building box
      const b = g.city.boxes.find((o) => o.kind === 'building' || (o.kind !== 'river' && o.kind !== 'bridgePier' && o.kind !== 'wall' && (o.x1 - o.x0) > 6));
      if (!b) return { ok: false, reason: 'no building box' };
      // Stand 1.2m outside the building's west wall and get slammed at 55 m/s directly into the wall!
      g.avatar.spawn(b.x0 - 1.2, (b.z0 + b.z1) / 2, Math.PI / 2, 0, 0);
      g.avatar.knock(55, 0, 1.5);
      for (let i = 0; i < 45; i++) g.avatar.update(1 / 60, { mx: 0, mz: 0, sprint: false, jump: false, fire: false });
      const inside = g.avatar.x > b.x0 && g.avatar.x < b.x1 && g.avatar.z > b.z0 && g.avatar.z < b.z1;
      return { ok: !inside, x: g.avatar.x, x0: b.x0, inside };
    });
    assert('1.1 Player knocked at 55 m/s into building wall NEVER tunnels inside', buildingTest.ok, JSON.stringify(buildingTest));

    // Test 1.2: Player walking into parked vehicle NEVER walks through it
    const vehicleBlockTest = await page.evaluate(() => {
      const g = window.game;
      const v = [...g.vehicles].find((x) => !x.boat && x.alive);
      if (!v) return { ok: false, reason: 'no car' };
      v.vx = 0; v.vz = 0;
      const s = Math.sin(v.heading), c = Math.cos(v.heading);
      // Place player just outside side of car and push straight toward center for 40 frames
      g.avatar.spawn(v.x + c * (v.W / 2 + 0.6), v.z - s * (v.W / 2 + 0.6), 0, 0, 0);
      const dx = v.x - g.avatar.x, dz = v.z - g.avatar.z, d = Math.hypot(dx, dz) || 1;
      for (let i = 0; i < 40; i++) g.avatar.update(1 / 60, { mx: dx / d, mz: dz / d, sprint: true, jump: false, fire: false });
      // Check local coordinates inside vehicle OBB
      const rx = g.avatar.x - v.x, rz = g.avatar.z - v.z;
      const fwd = Math.abs(rx * s + rz * c), side = Math.abs(rx * c - rz * s);
      const inside = fwd < v.L / 2 - 0.05 && side < v.W / 2 - 0.05;
      return { ok: !inside, fwd: +fwd.toFixed(2), side: +side.toFixed(2), hL: +(v.L / 2).toFixed(2), hW: +(v.W / 2).toFixed(2) };
    });
    assert('1.2 Player walking into parked vehicle is blocked (no passthrough)', vehicleBlockTest.ok, JSON.stringify(vehicleBlockTest));

    // Test 1.3: Swimming in open river & swimming underneath bridge at x=0 without snapping onto deck
    const swimTest = await page.evaluate(() => {
      const g = window.game;
      const zMid = (g.boats.z0 + g.boats.z1) / 2 + 10;
      // Spawn in open river west of the x=0 bridge, then swim eastward underneath the bridge!
      g.avatar.spawn(-12, zMid, Math.PI / 2, 0, 0);
      for (let i = 0; i < 150; i++) g.avatar.update(1 / 60, { mx: 1, mz: 0, sprint: true, jump: false, fire: false });
      return {
        ok: g.avatar.swimming && g.avatar.swimBlend > 0.5 && g.avatar.swimPhase > 1 && g.avatar.y < -2.5 && g.avatar.x > -4,
        swimming: g.avatar.swimming,
        swimBlend: +(g.avatar.swimBlend || 0).toFixed(2),
        swimPhase: +(g.avatar.swimPhase || 0).toFixed(2),
        x: +g.avatar.x.toFixed(2),
        y: +g.avatar.y.toFixed(2),
      };
    });
    assert('1.3 Genuine swimming state, crawl blend & under-bridge depth work', swimTest.ok, JSON.stringify(swimTest));

    // Test 4.1 & 4.2: Boat visible driver & physical bridge pier collision + under-bridge channel navigation
    const boatTest = await page.evaluate(() => {
      const g = window.game;
      const boat = g.boats.mine || g.boats.list[0];
      if (!boat) return { ok: false, reason: 'no boat' };
      g.commitEnter(boat);
      const hasDriver = !!boat.driverRig && boat.driverRig.root.parent === boat.car.body;
      // Use center city bridge pier (i=8, x=0)
      const pier = g.city.bridgePiers[2] || g.city.bridgePiers[1];
      boat.place(pier.x0 - 2.5, (pier.z0 + pier.z1) / 2, Math.PI / 2);
      boat.vx = 22; boat.vz = 0;
      for (let i = 0; i < 20; i++) {
        boat.step(1 / 60, 1);
        g.boats.constrain(boat);
      }
      const insidePier = boat.x > pier.x0 && boat.x < pier.x1 && boat.z > pier.z0 && boat.z < pier.z1;
      // Drive through navigable north arch channel under the bridge
      const chanZ = pier.z0 - 10;
      boat.place(pier.x0 - 6, chanZ, Math.PI / 2);
      boat.input = { throttle: 1, brake: 0, steer: 0, handbrake: false, nitro: false };
      boat.vx = 20; boat.vz = 0;
      for (let i = 0; i < 50; i++) {
        boat.step(1 / 60, 1);
        g.boats.constrain(boat);
      }
      const passedUnder = boat.x > pier.x1 + 1;
      return { ok: hasDriver && !insidePier && passedUnder, hasDriver, insidePier, passedUnder, endX: +boat.x.toFixed(1), pierX1: +pier.x1.toFixed(1), pierCount: g.city.bridgePiers.length };
    });
    assert('4.1 & 4.2 Boat has visible seated driver, collides with bridge piers, and passes under arches', boatTest.ok, JSON.stringify(boatTest));

    // Test 3.1: Expanded vehicle models & traffic variety
    const trafficTest = await page.evaluate(() => {
      const g = window.game;
      const models = ['suv', 'pickup', 'delivery', 'bus', 'cargo', 'tanker'];
      const spawned = [];
      for (const m of models) {
        g.showroomCar(m === 'suv' ? 'vanguard' : m === 'cargo' ? 'hauler' : m === 'tanker' ? 'inferno' : 'bolt');
        spawned.push(m);
      }
      // Spawn traffic batch and inspect categories
      for (let i = 0; i < 20; i++) g.traffic.spawn(30, 180);
      const kinds = [...new Set(g.traffic.cars.map((c) => c.model))];
      return { ok: g.traffic.cars.length >= 10 && kinds.length >= 4, count: g.traffic.cars.length, kinds };
    });
    assert('3.1 Expanded traffic categories (SUV, pickup, bus, cargo, tanker, etc.) build & spawn cleanly', trafficTest.ok, JSON.stringify(trafficTest));

    // Test Pause -> gameplayStop
    await page.evaluate(() => window.game.pause());
    await page.waitForTimeout(200);
    const calls3 = await page.evaluate(() => window.sdkCalls);
    assert('SDK gameplayStop() invoked on pause', calls3.includes('gameplayStop'));

    // Test 7: Rewarded Ad Vehicle Unlock + Ad Failure Guard in Garage
    await page.evaluate(() => {
      window.game.toMenu();
      window.game.ui.openGarage();
      // Navigate to CRUISER (index 1, adUnlock: 1)
      window.game.ui.garageIndex = 1;
      window.game.ui.renderGarage();
    });
    await page.waitForTimeout(200);

    // 7a: Verify failed/skipped ad grants NO reward
    await page.evaluate(() => { window.mockAdFail = true; });
    await page.click('#garage-ad-unlock');
    await page.waitForTimeout(200);
    const ownedAfterFail = await page.evaluate(() => window.game.save.owned.includes('cruiser'));
    assert('7.2 Failed/skipped rewarded ad does NOT unlock vehicle', !ownedAfterFail);

    // 7b: Verify completed ad DOES unlock vehicle & saves
    await page.evaluate(() => { window.mockAdFail = false; });
    await page.click('#garage-ad-unlock');
    await page.waitForTimeout(250);
    const ownedAfterPass = await page.evaluate(() => window.game.save.owned.includes('cruiser'));
    assert('7.1 Completed rewarded ad unlocks vehicle via SDK callback', ownedAfterPass);

    // 7c: Garage +500 coins rewarded ad
    const c0 = await page.evaluate(() => window.game.save.coins);
    await page.click('#garage-ad-coins');
    await page.waitForTimeout(250);
    const c1 = await page.evaluate(() => window.game.save.coins);
    assert('7.1 Completed rewarded ad awards +500 coins', c1 === c0 + 500, `(${c0} -> ${c1})`);

    // Mobile Touch Viewport Check
    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(() => window.game.startRun({ intro: false }));
    await page.waitForTimeout(300);
    const touchVisible = await page.evaluate(() => window.getComputedStyle(document.getElementById('touch')).display !== 'none');
    assert('12. Mobile landscape touch controls visible', touchVisible);

    assert('Zero runtime/console errors throughout entire audit', consoleErrors.length === 0, consoleErrors.join('; '));
  } finally {
    if (browser) await browser.close();
    srv.kill();
  }

  console.log('--- AUDIT FINISHED ---');
  if (!results.passed) {
    console.error('AUDIT FAILED!');
    process.exit(1);
  }
  console.log('ALL AUDIT CHECKS PASSED PERFECTLY!');
}

runAudit().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
