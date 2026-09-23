// Procedural canvas textures: no external assets needed.
import * as THREE from 'three';
import { mulberry32 } from './utils.js';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function noiseFill(ctx, w, h, base, amount, rng, size = 1) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      const n = (rng() - 0.5) * amount;
      for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) {
        const i = ((y + yy) * w + (x + xx)) * 4;
        d[i] += n; d[i + 1] += n; d[i + 2] += n;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function asphaltTexture(tone = '#3a3d42', seed = 1) {
  const rng = mulberry32(seed);
  const [c, ctx] = canvas(512);
  noiseFill(ctx, 512, 512, tone, 26, rng, 2);
  // patches and cracks
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${rng() < 0.5 ? '0,0,0' : '255,255,255'},${0.012 + rng() * 0.018})`;
    ctx.beginPath();
    ctx.ellipse(rng() * 512, rng() * 512, 20 + rng() * 60, 10 + rng() * 40, rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    let x = rng() * 512, y = rng() * 512;
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (rng() - 0.5) * 40; y += (rng() - 0.5) * 40; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return toTexture(c);
}

export function groundTexture(kind, seed = 2) {
  const rng = mulberry32(seed);
  const [c, ctx] = canvas(256);
  const base = { grass: '#5d8f3b', sand: '#d9b27a', snow: '#e8eef5', concrete: '#9ea3a8', dirt: '#8a6b4a' }[kind] || '#777';
  noiseFill(ctx, 256, 256, base, kind === 'snow' ? 14 : 30, rng, 2);
  for (let i = 0; i < 300; i++) {
    const a = rng() * 0.12;
    ctx.fillStyle = kind === 'grass' ? `rgba(${rng() < 0.5 ? '40,80,20' : '140,180,70'},${a})` : `rgba(0,0,0,${a * 0.5})`;
    ctx.fillRect(rng() * 256, rng() * 256, 2 + rng() * 6, 2 + rng() * 6);
  }
  return toTexture(c);
}

export function sidewalkTexture(tone = '#b8b5ad', seed = 3) {
  const rng = mulberry32(seed);
  const [c, ctx] = canvas(256);
  noiseFill(ctx, 256, 256, tone, 18, rng, 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64); ctx.stroke();
  }
  return toTexture(c);
}

// Facade atlas: an 8x8 grid of window cells, plus a matching emissive map for night.
// UVs map 8 cells per texture repeat so each building shows varied lit windows.
export function facadeTextures(style, seed = 4) {
  const rng = mulberry32(seed);
  const S = 512, cells = 8, cs = S / cells;
  const [c, ctx] = canvas(S);
  const [e, ectx] = canvas(S);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, S, S);

  const wall = { office: '#e6e3dc', glass: '#c9d3dc', residential: '#efe7da', adobe: '#f2e2c4', brick: '#d9b8a6' }[style];
  noiseFill(ctx, S, S, wall, 12, rng, 2);

  for (let gy = 0; gy < cells; gy++) {
    for (let gx = 0; gx < cells; gx++) {
      const x0 = gx * cs, y0 = gy * cs;
      let wx, wy, ww, wh;
      if (style === 'glass') {
        wx = x0 + 2; wy = y0 + 6; ww = cs - 4; wh = cs - 12;
      } else if (style === 'office') {
        wx = x0 + 8; wy = y0 + 12; ww = cs - 16; wh = cs - 22;
      } else if (style === 'adobe') {
        if (rng() < 0.45) continue;
        wx = x0 + 20; wy = y0 + 18; ww = cs - 40; wh = cs - 30;
      } else {
        wx = x0 + 14; wy = y0 + 12; ww = cs - 28; wh = cs - 24;
      }
      // window glass with a sky-reflection gradient
      const g = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
      const tint = style === 'glass' ? [60, 100, 140] : [45, 62, 82];
      const k = 0.75 + rng() * 0.5;
      g.addColorStop(0, `rgb(${tint[0] * k + 40},${tint[1] * k + 50},${tint[2] * k + 60})`);
      g.addColorStop(1, `rgb(${tint[0] * k * 0.5},${tint[1] * k * 0.55},${tint[2] * k * 0.65})`);
      ctx.fillStyle = g;
      ctx.fillRect(wx, wy, ww, wh);
      // frame
      ctx.strokeStyle = style === 'glass' ? 'rgba(40,50,60,0.9)' : 'rgba(70,70,70,0.8)';
      ctx.lineWidth = style === 'glass' ? 2 : 3;
      ctx.strokeRect(wx, wy, ww, wh);
      if (style !== 'glass') {
        ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke();
        // sill
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(wx - 2, wy + wh, ww + 4, 4);
      }
      if (style === 'residential' && rng() < 0.3) {
        // closed blinds
        ctx.fillStyle = 'rgba(230,220,200,0.7)';
        ctx.fillRect(wx + 2, wy + 2, ww - 4, wh * (0.3 + rng() * 0.5));
      }
      // lit windows at night
      if (rng() < 0.42) {
        const warm = rng() < 0.7;
        const b = 0.55 + rng() * 0.45;
        ectx.fillStyle = warm
          ? `rgb(${255 * b},${200 * b},${120 * b})`
          : `rgb(${180 * b},${220 * b},${255 * b})`;
        ectx.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
      }
    }
    if (style === 'glass') {
      // floor slab band
      ctx.fillStyle = 'rgba(30,40,50,0.8)';
      ctx.fillRect(0, gy * cs, S, 5);
    }
  }
  return { map: toTexture(c), emissive: toTexture(e) };
}

export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const [c, ctx] = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(c, { repeat: false });
}

// Soft rectangular shadow for under cars.
export function blobShadowTexture() {
  const [c, ctx] = canvas(128);
  ctx.filter = 'blur(10px)';
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.beginPath();
  ctx.roundRect(28, 16, 72, 96, 20);
  ctx.fill();
  return toTexture(c, { repeat: false, srgb: false });
}

// Forward-facing light cone on the ground (headlights).
export function beamTexture() {
  const [c, ctx] = canvas(128, 256);
  const g = ctx.createLinearGradient(0, 256, 0, 0);
  g.addColorStop(0, 'rgba(255,245,220,0.9)');
  g.addColorStop(1, 'rgba(255,245,220,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(52, 256); ctx.lineTo(76, 256); ctx.lineTo(128, 0); ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  const t = toTexture(c, { repeat: false });
  return t;
}

export function iconTexture(letter, color) {
  const [c, ctx] = canvas(128);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 64, 68);
  return toTexture(c, { repeat: false });
}

export function signTexture(text, fg, bg) {
  const [c, ctx] = canvas(256, 64);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = fg;
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  return toTexture(c, { repeat: false });
}
