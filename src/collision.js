// Shared character-vs-city and character-vs-vehicle collision solvers.
// Uses multi-iteration depenetration + substepped sweeping to eliminate wall
// tunneling (even on high-speed vehicle impacts) and prevent walking through vehicles.
import { clamp } from './utils.js';

// Push a circle (x, z, r) cleanly outside all overlapping static city colliders.
export function resolveCircleCity(x, z, r, y, city, opts = {}) {
  const skipRiver = !!opts.skipRiver;
  const checkPiers = !!opts.checkPiers;
  let hit = false, hitNx = 0, hitNz = 0, hitKind = null;

  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    city.query(x, z, r + 0.6, (o) => {
      if (o.type === 'box') {
        if (skipRiver && o.kind === 'river') return;
        if (o.kind === 'bridgePier' && !checkPiers) return;
        if (o.kind !== 'bridgePier' && checkPiers && o.kind !== 'wall') return;
        if (o.h !== undefined && o.h <= y + 0.35 && o.kind !== 'bridgePier') return;
        const px = clamp(x, o.x0, o.x1);
        const pz = clamp(z, o.z0, o.z1);
        const dx = x - px, dz = z - pz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) return;
        let nx, nz, pen;
        if (d2 < 1e-8) {
          // Center is inside box: push out along the shortest axis
          const dl = x - o.x0, dr = o.x1 - x, dt = z - o.z0, db = o.z1 - z;
          const m = Math.min(dl, dr, dt, db);
          if (m === dl) { nx = -1; nz = 0; pen = dl + r; }
          else if (m === dr) { nx = 1; nz = 0; pen = dr + r; }
          else if (m === dt) { nx = 0; nz = -1; pen = dt + r; }
          else { nx = 0; nz = 1; pen = db + r; }
        } else {
          const d = Math.sqrt(d2);
          nx = dx / d; nz = dz / d; pen = r - d;
        }
        x += nx * pen;
        z += nz * pen;
        hit = true; moved = true; hitNx = nx; hitNz = nz; hitKind = o.kind || 'box';
      } else if (!checkPiers) {
        const dx = x - o.x, dz = z - o.z;
        const rs = r + o.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rs * rs) return;
        const d = Math.sqrt(d2) || 1e-4;
        const nx = dx / d, nz = dz / d, pen = rs - d;
        x += nx * pen;
        z += nz * pen;
        hit = true; moved = true; hitNx = nx; hitNz = nz; hitKind = o.kind || 'circle';
      }
    });
    if (!moved) break;
  }
  return { x, z, hit, nx: hitNx, nz: hitNz, kind: hitKind };
}

// Substepped sweep from (x0, z0) -> (x1, z1) so high-speed knockback can never
// tunnel through building walls or thin barriers across any frame rate.
export function sweepCircleCity(x0, z0, x1, z1, r, y, city, opts = {}) {
  const dx = x1 - x0, dz = z1 - z0;
  const dist = Math.hypot(dx, dz);
  const maxStep = Math.max(0.18, r * 0.55);
  const steps = Math.min(20, Math.max(1, Math.ceil(dist / maxStep)));
  let cx = x0, cz = z0;
  let hit = false, hitNx = 0, hitNz = 0, hitKind = null;
  const sx = dx / steps, sz = dz / steps;

  for (let i = 0; i < steps; i++) {
    const res = resolveCircleCity(cx + sx, cz + sz, r, y, city, opts);
    cx = res.x; cz = res.z;
    if (res.hit) {
      hit = true; hitNx = res.nx; hitNz = res.nz; hitKind = res.kind;
      // Slide remaining motion along the wall tangent instead of tunneling through
      const remX = (steps - 1 - i) * sx, remZ = (steps - 1 - i) * sz;
      const vn = remX * hitNx + remZ * hitNz;
      if (vn < 0) {
        const slideX = remX - vn * hitNx, slideZ = remZ - vn * hitNz;
        const end = resolveCircleCity(cx + slideX, cz + slideZ, r, y, city, opts);
        cx = end.x; cz = end.z;
      }
      break;
    }
  }
  return { x: cx, z: cz, hit, nx: hitNx, nz: hitNz, kind: hitKind };
}

// Exact Oriented Bounding Box (OBB) vs circle separation against a vehicle.
// Prevents characters from walking through parked or slow vehicles.
export function resolveCircleVehicle(x, z, r, v) {
  const rx = x - v.x, rz = z - v.z;
  const bound = v.L * 0.5 + v.W * 0.5 + r + 1.0;
  if (rx * rx + rz * rz > bound * bound) return null;

  const s = Math.sin(v.heading), c = Math.cos(v.heading);
  // Local coordinates: fwd along +heading (s, c), side along right (c, -s)
  const fwd = rx * s + rz * c;
  const side = rx * c - rz * s;
  const hl = v.L * 0.5, hw = v.W * 0.5;

  const cf = clamp(fwd, -hl, hl);
  const cs = clamp(side, -hw, hw);
  const df = fwd - cf, ds = side - cs;
  const d2 = df * df + ds * ds;
  if (d2 >= r * r) return null;

  let lnx, lns, pen;
  if (d2 < 1e-8) {
    // Center inside vehicle footprint: push out along nearest edge
    const ef = hl - Math.abs(fwd);
    const es = hw - Math.abs(side);
    if (es <= ef) {
      lnx = 0; lns = side >= 0 ? 1 : -1; pen = es + r;
    } else {
      lnx = fwd >= 0 ? 1 : -1; lns = 0; pen = ef + r;
    }
  } else {
    const d = Math.sqrt(d2);
    lnx = df / d; lns = ds / d; pen = r - d;
  }
  // Convert local normal back to world space
  const nx = lnx * s + lns * c;
  const nz = lnx * c - lns * s;
  return { nx, nz, pen, fwd, side };
}
