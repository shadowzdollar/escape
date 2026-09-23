// Usage: node dev/shot.mjs <url> <out.png> [width] [height] [waitMs]
import { chromium } from 'playwright-core';
const [url, out, w = 1400, h = 800, wait = 1500] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
console.log(logs.slice(0, 30).join('\n') || 'no errors');
await browser.close();
