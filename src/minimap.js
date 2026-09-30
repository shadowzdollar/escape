// Radar-style minimap: a pre-rendered city map, cropped around the player.
import { CITY, POWERUPS } from './config.js';
import { rc } from './city.js';

const SCALE = 0.5; // px per meter in the base map

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.base = null;
    this.range = 140; // meters from center to edge
  }

  build(city) {
    const size = Math.ceil(CITY.HALF * 2 * SCALE) + 40;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const o = size / 2;
    const P = (v) => o + v * SCALE;
    ctx.fillStyle = '#1b2230';
    ctx.fillRect(0, 0, size, size);
    const typeColor = {
      downtown: '#3a4458', midtown: '#364055', suburb: '#2f4a3a', industrial: '#4a4136',
      park: '#2f6b3a', plaza: '#4f5566', parking: '#3a3f4a',
    };
    for (const b of city.blocks) {
      ctx.fillStyle = typeColor[b.type] || '#333';
      ctx.fillRect(P(b.x0), P(b.z0), (b.x1 - b.x0) * SCALE, (b.z1 - b.z0) * SCALE);
    }
    ctx.fillStyle = '#6a7690';
    for (const bx of city.boxes) {
      if (bx.kind !== 'building' && bx.kind !== 'container') continue;
      ctx.fillRect(P(bx.x0), P(bx.z0), Math.max(1, (bx.x1 - bx.x0) * SCALE), Math.max(1, (bx.z1 - bx.z0) * SCALE));
    }
    // river
    const z0 = rc(CITY.RIVER_ROW) + CITY.ROAD / 2, z1 = rc(CITY.RIVER_ROW + 1) - CITY.ROAD / 2;
    ctx.fillStyle = '#2f6f9f';
    ctx.fillRect(0, P(z0), size, (z1 - z0) * SCALE);
    ctx.fillStyle = '#8a93a5';
    for (let i = 0; i <= CITY.N; i++) if (city.hasBridge(i)) ctx.fillRect(P(rc(i) - 8), P(z0), 16 * SCALE, (z1 - z0) * SCALE);
    ctx.strokeStyle = '#e0a040';
    ctx.lineWidth = 2;
    ctx.strokeRect(P(-CITY.HALF), P(-CITY.HALF), CITY.HALF * 2 * SCALE, CITY.HALF * 2 * SCALE);
    this.base = c;
    this.baseO = o;
  }

  draw(game, rotate = 0) {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    const p = game.player;
    if (!p || !this.base) return;
    const k = (W / 2) / this.range; // px per meter on the minimap
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#10151f';
    ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    ctx.rotate(rotate);
    const s = k / SCALE;
    ctx.drawImage(this.base, -(this.baseO + p.x * SCALE) * s, -(this.baseO + p.z * SCALE) * s, this.base.width * s, this.base.height * s);
    const toMap = (x, z) => [(x - p.x) * k, (z - p.z) * k];
    // pickups
    for (const u of game.pickups.powerups) {
      const [x, y] = toMap(u.x, u.z);
      ctx.fillStyle = POWERUPS[u.type].color;
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffd24a';
    for (const c of game.pickups.coins) {
      const [x, y] = toMap(c.x, c.z);
      if (Math.abs(x) > W || Math.abs(y) > H) continue;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    for (const s2 of game.police.spikes) {
      const [x, y] = toMap(s2.x, s2.z);
      ctx.fillStyle = '#ff9f1c';
      ctx.fillRect(x - 3, y - 3, 6, 6);
    }
    // cops
    const blink = Math.sin(performance.now() / 90) > 0;
    for (const c of game.police.cops) {
      let [x, y] = toMap(c.x, c.z);
      const r = Math.hypot(x, y), R = W / 2 - 8;
      if (r > R) { x *= R / r; y *= R / r; }
      ctx.fillStyle = !c.alive ? '#555' : blink ? '#ff3b3b' : '#3b7bff';
      if (c.copType === 'tank') { ctx.fillStyle = c.alive ? '#9acd32' : '#555'; ctx.fillRect(x - 6, y - 6, 12, 12); continue; }
      ctx.beginPath(); ctx.arc(x, y, c.copType === 'swat' ? 5 : 4, 0, Math.PI * 2); ctx.fill();
    }
    if (game.police.heli) {
      const [x, y] = toMap(game.police.heli.x, game.police.heli.z);
      ctx.strokeStyle = '#ff5d5d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
    }
    for (const o of game.people.list) {
      if (!o.copFoot || o.dead) continue;
      const [x, y] = toMap(o.x, o.z);
      ctx.fillStyle = '#6ea8ff';
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    for (const gs of game.military?.gunships || []) {
      const [x, y] = toMap(gs.x, gs.z);
      ctx.fillStyle = '#ff9f1c';
      ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 7, y); ctx.closePath(); ctx.fill();
    }
    for (const pr of game.military?.projectiles || []) {
      const [x, y] = toMap(pr.mesh.position.x, pr.mesh.position.z);
      ctx.fillStyle = '#ff3030';
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    for (const m of game.mission?.markers || []) {
      let [x, y] = toMap(m.x, m.z);
      const r = Math.hypot(x, y), R = W / 2 - 10;
      if (r > R) { x *= R / r; y *= R / r; }
      ctx.fillStyle = m.kind === 'cash' ? '#ffd23c' : '#3cff7a';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // your garage boat (anchor-style marker, clamped to the rim)
    const mine = game.boats?.mine;
    if (mine && mine.alive && mine !== game.car) {
      let [x, y] = toMap(mine.x, mine.z);
      const r = Math.hypot(x, y), R = W / 2 - 10;
      if (r > R) { x *= R / r; y *= R / r; }
      ctx.fillStyle = '#35f2ff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 6, y + 5); ctx.lineTo(x - 6, y + 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // player arrow
    ctx.rotate(-rotate);
    ctx.rotate(Math.PI - p.heading + rotate);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); ctx.stroke();
  }
}
