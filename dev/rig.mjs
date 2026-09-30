import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=vulkan', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 600, height: 600 } });
p.on('pageerror', (e) => console.log('ERR', e.message, e.stack));
await p.goto('http://localhost:5174/dev/rig.html', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__done, null, { timeout: 60000 });
console.log(JSON.stringify(await p.evaluate(() => window.__info), null, 1));
await p.screenshot({ path: process.argv[2] });
await b.close();
