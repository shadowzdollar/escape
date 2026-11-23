import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const chromePath = fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : fs.existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : '/usr/bin/google-chrome';

async function runAudit() {
  console.log('--- STARTING COMPREHENSIVE CRAZYGAMES AUDIT ---');
  const results = {
    checks: [],
    passed: true,
  };

  function assert(title, condition, extra = '') {
    const ok = Boolean(condition);
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${title} ${extra}`);
    results.checks.push({ title, ok, extra });
    if (!ok) results.passed = false;
  }

  // 1. Check Package Zip & Files
  const zipPath = path.resolve('fender-bender-crazygames.zip');
  assert('Package zip exists', fs.existsSync(zipPath));
  if (fs.existsSync(zipPath)) {
    const stat = fs.statSync(zipPath);
    const mb = stat.size / 1024 / 1024;
    assert('Zip size < 50MB (CrazyGames initial download limit)', mb < 50, `(${mb.toFixed(2)} MB)`);
    assert('Zip size < 20MB (CrazyGames mobile tier limit)', mb < 20, `(${mb.toFixed(2)} MB)`);
  }

  // 2. Check Dist Output & Relative Paths
  const distHtml = path.resolve('dist/index.html');
  assert('dist/index.html exists', fs.existsSync(distHtml));
  if (fs.existsSync(distHtml)) {
    const html = fs.readFileSync(distHtml, 'utf8');
    assert('Title is Fender Bender', html.includes('<title>Fender Bender</title>'));
    assert('CrazyGames SDK v3 script present', html.includes('https://sdk.crazygames.com/crazygames-sdk-v3.js'));
    assert('No absolute /src/ or /assets/ paths', !html.match(/href="\/[^/]/) && !html.match(/src="\/[^/]/));
    assert('Draco decoder assets present in dist', fs.existsSync('dist/assets/draco_decoder-Z1_iN-Ht.wasm') || fs.existsSync('dist/assets/draco_decoder-C32yEggz.wasm'));
  }

  // 3. Check Promotional Assets
  const covers = [
    { file: 'crazygames-assets/cover-landscape-1920x1080.png', w: 1920, h: 1080 },
    { file: 'crazygames-assets/cover-portrait-800x1200.png', w: 800, h: 1200 },
    { file: 'crazygames-assets/cover-square-800x800.png', w: 800, h: 800 },
  ];
  for (const c of covers) {
    assert(`Promo cover exists: ${c.file}`, fs.existsSync(c.file), `(${fs.statSync(c.file).size} bytes)`);
  }

  // 4. Start Vite Preview server for E2E headless testing
  console.log('--- LAUNCHING E2E TEST IN BROWSER ---');
  const port = 5199;
  const srv = spawn('./node_modules/.bin/vite', ['preview', '--port', String(port), '--host', '127.0.0.1', '--strictPort'], { stdio: 'pipe' });
  await new Promise(r => setTimeout(r, 1200));

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
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      hasTouch: true,
    });

    const page = await context.newPage();

    // Intercept CrazyGames SDK script to supply mock and record all lifecycle/ad calls
    await page.route('https://sdk.crazygames.com/crazygames-sdk-v3.js', route => {
      const mockScript = `
        window.sdkCalls = [];
        window.CrazyGames = {
          SDK: {
            environment: 'crazygames',
            init: async () => {
              window.sdkCalls.push('init');
              return true;
            },
            game: {
              loadingStart: () => { window.sdkCalls.push('loadingStart'); },
              loadingStop: () => { window.sdkCalls.push('loadingStop'); },
              gameplayStart: () => { window.sdkCalls.push('gameplayStart'); },
              gameplayStop: () => { window.sdkCalls.push('gameplayStop'); },
              happytime: () => { window.sdkCalls.push('happytime'); },
              addSettingsChangeListener: (cb) => {},
              settings: { muteAudio: false },
            },
            ad: {
              requestAd: (type, callbacks) => {
                window.sdkCalls.push('ad:' + type);
                callbacks?.adStarted?.();
                setTimeout(() => {
                  callbacks?.adFinished?.();
                }, 80);
              }
            },
            data: {
              getItem: (k) => null,
              setItem: (k, v) => {},
            },
            user: {
              isUserAccountAvailable: true,
              getUser: async () => null,
            }
          }
        };
      `;
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: mockScript,
      });
    });

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    // Open game
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Verify initial loading calls
    const calls1 = await page.evaluate(() => window.sdkCalls);
    assert('SDK init() was invoked', calls1.includes('init'));
    assert('SDK loadingStart() was invoked', calls1.includes('loadingStart'));
    assert('SDK loadingStop() was invoked', calls1.includes('loadingStop'));

    // Check UI is visible
    const menuVisible = await page.evaluate(() => {
      const el = document.getElementById('menu');
      return el && el.classList.contains('show');
    });
    assert('Main menu is displayed', menuVisible);

    // Disable intro cutscene in settings for immediate gameplay testing
    await page.evaluate(() => {
      window.game.save.settings.intro = false;
    });

    // Click Play button
    console.log('Testing: Clicking ▶ PLAY...');
    await page.click('button[data-action="play"]');
    await page.waitForTimeout(400);

    // Click Endless mode to start driving immediately
    await page.click('.mode-card.endless');
    await page.waitForTimeout(1000);

    // Verify gameplayStart was invoked
    const calls2 = await page.evaluate(() => window.sdkCalls);
    assert('SDK gameplayStart() was invoked on run start', calls2.includes('gameplayStart'));

    // Drive the car with controls
    console.log('Testing: Simulating driving throttle...');
    const stepResult = await page.evaluate(() => {
      const g = window.game;
      g.input.touch.gas = true;
      const readBefore = g.input.read();
      g.updatePlay(0.05);
      return {
        readBefore,
        carInput: g.car.input,
        speed: g.car.speed,
        adActive: g.adActive,
        frozen: g.frozen,
      };
    });
    console.log('Step direct evaluation result:', stepResult);
    await page.waitForTimeout(600);
    const debugInfo = await page.evaluate(() => {
      const g = window.game;
      const c = g?.car;
      return {
        state: g?.state,
        speed: c?.speed || 0,
        hasCar: !!c,
        input: c?.input,
        vx: c?.vx,
        vz: c?.vz,
      };
    });
    console.log('Driving telemetry:', debugInfo);
    assert('Car physics responded to throttle/steer', debugInfo.speed > 0.01, `(speed: ${debugInfo.speed.toFixed(2)})`);
    await page.evaluate(() => {
      window.game.input.touch.gas = false;
    });

    // Test Pause
    console.log('Testing: Pausing game...');
    await page.evaluate(() => {
      window.game.pause();
    });
    await page.waitForTimeout(500);

    const calls3 = await page.evaluate(() => window.sdkCalls);
    assert('SDK gameplayStop() invoked on pause', calls3.includes('gameplayStop'));

    // Exit to menu and open garage
    console.log('Testing: Opening Garage and triggering rewarded ad...');
    await page.evaluate(() => {
      window.game.toMenu();
      window.game.ui.openGarage();
    });
    await page.waitForTimeout(600);

    const initialCoins = await page.evaluate(() => window.game?.save?.coins || 0);
    // Click +500 rewarded ad button
    const adBtn = await page.$('#garage-ad-coins');
    assert('Rewarded ad button #garage-ad-coins exists in garage', !!adBtn);
    if (adBtn) {
      await adBtn.click();
      await page.waitForTimeout(500);
      const calls4 = await page.evaluate(() => window.sdkCalls);
      assert('SDK requestAd("rewarded") invoked on click', calls4.includes('ad:rewarded'));
      const newCoins = await page.evaluate(() => window.game?.save?.coins || 0);
      assert('Rewarded ad awarded +500 coins', newCoins === initialCoins + 500, `(${initialCoins} -> ${newCoins})`);
    }

    // Test Mobile Touch Controls overlay
    console.log('Testing: Mobile Touch Layout...');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(() => {
      window.game?.startRun?.();
    });
    await page.waitForTimeout(1000);

    const touchVisible = await page.evaluate(() => {
      const touch = document.getElementById('touch');
      const style = window.getComputedStyle(touch);
      return style.display !== 'none';
    });
    assert('Touch controls display properly on mobile landscape viewport', touchVisible);

    // Check console errors
    assert('Zero console errors throughout test', consoleErrors.length === 0, consoleErrors.join('; '));

  } finally {
    if (browser) await browser.close();
    srv.kill();
  }

  console.log('--- AUDIT FINISHED ---');
  if (!results.passed) {
    console.error('AUDIT FAILED!');
    process.exit(1);
  } else {
    console.log('ALL AUDIT CHECKS PASSED PERFECTLY!');
  }
}

runAudit().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
