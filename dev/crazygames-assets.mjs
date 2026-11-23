// Generate the 3 mandatory CrazyGames cover images (1920x1080, 800x1200, 800x800)
// directly from the live 3D game scene into crazygames-assets/.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const outDir = path.join(process.cwd(), 'crazygames-assets');
fs.mkdirSync(outDir, { recursive: true });

const viteBin = path.join(process.cwd(), 'node_modules', '.bin', 'vite');

// Start Vite preview server for dist/
const srv = spawn(viteBin, ['preview', '--port', '5189', '--host', '127.0.0.1', '--strictPort'], {
  cwd: process.cwd(),
  stdio: 'inherit',
});

// Wait until server responds
async function waitForServer(url, maxWaitMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 400) resolve();
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on('error', reject);
        req.setTimeout(1000, () => req.destroy());
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`Server failed to start at ${url}`);
}

try {
  await waitForServer('http://127.0.0.1:5189/');

  const chromePath = fs.existsSync('/usr/bin/chromium')
    ? '/usr/bin/chromium'
    : fs.existsSync('/usr/bin/google-chrome-stable')
      ? '/usr/bin/google-chrome-stable'
      : '/usr/bin/google-chrome';

  const browser = await chromium.launch({
    executablePath: chromePath,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://127.0.0.1:5189/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 90000 });

  // Stage an action-packed chase scene
  await page.evaluate(() => {
    const g = window.game;
    g.save.selected = 'stinger';
    g.startRun({ intro: false });
    g.simulate(8, true);
    // Keep rendering actively
    document.getElementById('hud').classList.remove('show');
    const cover = document.createElement('div');
    cover.id = 'cg-cover-logo';
    cover.innerHTML = `<div class="logo" style="position:fixed;left:5vw;bottom:6vh;z-index:99;transform:scale(1.2);transform-origin:left bottom;pointer-events:none;"><span>FENDER</span><em>BENDER</em></div>`;
    document.body.appendChild(cover);
  });
  await page.waitForTimeout(1000);

  const baseScreenshotPath = path.join(outDir, 'raw-1920x1080.png');
  await page.screenshot({ path: baseScreenshotPath, timeout: 15000 });
  await browser.close();

  // 1. Landscape: 1920x1080
  const landscapePath = path.join(outDir, 'cover-landscape-1920x1080.png');
  await sharp(baseScreenshotPath)
    .resize(1920, 1080, { fit: 'cover', position: 'center' })
    .toFile(landscapePath);
  console.log(`Generated ${landscapePath} (1920x1080)`);

  // 2. Portrait: 800x1200
  const portraitPath = path.join(outDir, 'cover-portrait-800x1200.png');
  await sharp(baseScreenshotPath)
    .resize(800, 1200, { fit: 'cover', position: 'center' })
    .toFile(portraitPath);
  console.log(`Generated ${portraitPath} (800x1200)`);

  // 3. Square: 800x800
  const squarePath = path.join(outDir, 'cover-square-800x800.png');
  await sharp(baseScreenshotPath)
    .resize(800, 800, { fit: 'cover', position: 'center' })
    .toFile(squarePath);
  console.log(`Generated ${squarePath} (800x800)`);

  if (fs.existsSync(baseScreenshotPath)) fs.unlinkSync(baseScreenshotPath);
} finally {
  srv.kill('SIGTERM');
}
