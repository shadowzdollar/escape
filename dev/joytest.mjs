import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + e.stack));
await p.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 90000 });
const send = (line, n = 1) => p.evaluate(([l, n]) => { for (let i = 0; i < n; i++) window.game.joy.parse(l); }, [line, n]);
const frame = () => p.waitForTimeout(120);
// fake a connected Arduino, calibrate at rest (centre ~ 510/518)
await p.evaluate(() => { const j = window.game.joy; j.connected = true; j.calib = []; j.center = null; });
await send('J,510,518,0,505,520,0', 25);
await p.evaluate(() => window.game.joy.onStatus('Controller ready', true));
console.log('status:', await p.evaluate(() => [window.game.joy.active, document.getElementById('joy-badge').textContent]));
// menu: flick down twice, then back up, check focus moves; then press R on PLAY
const focused = () => p.evaluate(() => document.querySelector('.focus')?.textContent.trim());
await send('J,510,1000,0,505,520,0'); await frame(); await send('J,510,518,0,505,520,0'); await frame();
console.log('after down:', await focused());
await send('J,510,20,0,505,520,0'); await frame(); await send('J,510,518,0,505,520,0'); await frame();
console.log('after up:', await focused());
await p.screenshot({ path: process.argv[2] + '/joy-menu.png' });
await send('J,510,518,0,505,520,1'); await frame(); await send('J,510,518,0,505,520,0'); await frame();
console.log('state after R:', await p.evaluate(() => window.game.state));
// driving: right stick up (low raw) = gas, left stick right = steer
await send('J,1015,518,0,505,15,0');
console.log('drive input:', JSON.stringify(await p.evaluate(() => window.game.input.read())));
await send('J,20,518,1,505,1020,1');
console.log('brake+drift+nitro:', JSON.stringify(await p.evaluate(() => window.game.input.read())));
// hold both buttons -> pause
for (let i = 0; i < 30; i++) { await send('J,510,518,1,505,520,1'); await p.waitForTimeout(50); }
console.log('state after hold both:', await p.evaluate(() => window.game.state));
await send('J,510,518,0,505,520,0'); await frame();
await p.screenshot({ path: process.argv[2] + '/joy-pause.png' });
console.log(errs.join('\n') || 'no errors');
await b.close();
