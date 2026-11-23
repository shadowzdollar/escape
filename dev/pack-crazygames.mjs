// Package the production build in dist/ into escape-overdrive-crazygames.zip
// and validate CrazyGames technical requirements (relative paths, file count, size).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const zipPath = path.join(root, 'escape-overdrive-crazygames.zip');

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('Error: dist/index.html not found. Run `npm run build` first.');
  process.exit(1);
}

// 1. Verify index.html uses relative asset paths
const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
const badPaths = [...html.matchAll(/(?:src|href)="(\/[^/][^"]*)"/g)].map((m) => m[1]);
if (badPaths.length > 0) {
  console.error('Error: Found root-absolute paths in dist/index.html (CrazyGames requires relative paths):', badPaths);
  process.exit(1);
}

// 2. Count files and total uncompressed size
function walk(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walk(full));
    else files.push(full);
  }
  return files;
}

const files = walk(distDir);
const totalBytes = files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

if (files.length > 1500) {
  console.error(`Error: Too many files (${files.length} > 1500 limit).`);
  process.exit(1);
}
if (totalBytes > 250 * 1024 * 1024) {
  console.error(`Error: Total size ${totalMB} MB exceeds 250 MB limit.`);
  process.exit(1);
}

// 3. Create zip archive with index.html at root
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
try {
  execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: distDir });
} catch {
  // Fallback using python3 zipfile if `zip` binary is not installed
  execFileSync('python3', [
    '-c',
    `import os, zipfile
with zipfile.ZipFile(${JSON.stringify(zipPath)}, 'w', zipfile.ZIP_DEFLATED) as zf:
  for root_dir, _, filenames in os.walk(${JSON.stringify(distDir)}):
    for f in filenames:
      full = os.path.join(root_dir, f)
      zf.write(full, os.path.relpath(full, ${JSON.stringify(distDir)}))
`,
  ]);
}

const zipMB = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
console.log(`CrazyGames package ready: ${zipPath}`);
console.log(`  Files: ${files.length} (limit: 1500)`);
console.log(`  Uncompressed size: ${totalMB} MB (initial limit: 50 MB, mobile tier: 20 MB)`);
console.log(`  Zip size: ${zipMB} MB`);
console.log(`  Relative paths check: PASSED`);
