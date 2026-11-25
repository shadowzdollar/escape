// Optimise the Neon District (Vesper City) reference assets for the VESPER CITY map.
// Source: game_reference/public/assets (MIT, Hiraeth010/neon-district).
// Output: public/models/vesper/  (advert panels -> 512px WebP, drone + kiosk GLBs, LICENSE)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const src = path.join(process.cwd(), 'game_reference', 'public', 'assets');
const out = path.join(process.cwd(), 'public', 'models', 'vesper');
fs.mkdirSync(out, { recursive: true });

const ads = fs.readdirSync(src).filter((f) => /^advert-.*\.png$/.test(f) && f !== 'advert-portrait.png' || f === 'advert-portrait.png').sort();
let total = 0;
const manifest = [];
for (const f of ads) {
  const name = f.replace(/^advert-/, 'ad-').replace(/\.png$/, '.webp');
  const img = sharp(path.join(src, f));
  const meta = await img.metadata();
  const info = await img.resize({ width: 512, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(out, name));
  total += info.size;
  manifest.push({ file: name, aspect: +(info.width / info.height).toFixed(3) });
}
fs.writeFileSync(path.join(out, 'ads.json'), JSON.stringify(manifest));
for (const g of ['drone.glb', 'kiosk.glb']) fs.copyFileSync(path.join(src, g), path.join(out, g));
fs.copyFileSync(path.join(process.cwd(), 'game_reference', 'LICENSE'), path.join(out, 'LICENSE.txt'));
console.log(`ads: ${ads.length} files, ${(total / 1024).toFixed(0)} KB; manifest written`);
