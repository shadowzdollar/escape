// Authentic Neon District Vesper City integration for Fender Bender.
// Directly builds and renders the complete authentic voxel metropolis from the reference
// (Kasumi Ward, Lantern Market, Iron Docks, Stacktown, Meridian East, Crown Plaza,
// 646 signs, 48 advert campaigns, elevated walkways, service fixtures and air traffic).
import * as THREE from 'three';
import { createCity as createRefCity } from './neon/city.js';

export class NeonCityAdapter {
  constructor(city, map) {
    this.city = city;
    this.map = map;
    this.group = new THREE.Group();
    this.group.name = 'Neon District Vesper City';
    city.group.add(this.group);

    // Build the authentic full reference city
    this.refCity = createRefCity(this.group);

    // Bridge all colliders into Fender Bender's spatial collision hash
    const colliders = [...(this.refCity.colliders || []), ...(this.refCity.streetColliders || [])];
    for (const c of colliders) {
      const cs = Math.abs(Math.cos(c.ry || 0)), sn = Math.abs(Math.sin(c.ry || 0));
      const hx = ((cs * c.sx + sn * c.sz) / 2) || 1;
      const hz = ((sn * c.sx + cs * c.sz) / 2) || 1;
      const x0 = c.x - hx, x1 = c.x + hx;
      const z0 = c.z - hz, z1 = c.z + hz;
      const h = c.sy || 12;
      city.addBox(x0, x1, z0, z1, c.kind || 'building', h);
    }

    // Set ground height sampler
    this.groundHeightAt = this.refCity.groundHeightAt;

    // Roads
    this.roads = this.refCity.roads || [];

    // Populate city.blocks from authentic Neon District blocks
    const chunks = this.refCity.chunks || this.refCity.layoutStats?.chunks || [];
    if (chunks.length > 0) {
      city.blocks = chunks.map((c, idx) => ({
        id: c.id,
        i: idx % 6,
        j: Math.floor(idx / 6),
        x0: c.x - (c.sx || 70) / 2,
        x1: c.x + (c.sx || 70) / 2,
        z0: c.z - (c.sz || 60) / 2,
        z1: c.z + (c.sz || 60) / 2,
        type: c.theme === 'market' ? 'plaza' : c.theme === 'docks' ? 'industrial' : 'downtown',
        district: c.district,
      }));
    } else {
      // Create default district blocks along Kasumi Boulevard and avenues
      city.blocks = (this.roads || []).map((r, idx) => ({
        id: 'block-' + idx,
        i: idx % 4,
        j: Math.floor(idx / 4),
        x0: r.x - (r.sx || 30) / 2 - 20,
        x1: r.x + (r.sx || 30) / 2 + 20,
        z0: r.z - (r.sz || 40) / 2 - 20,
        z1: r.z + (r.sz || 40) / 2 + 20,
        type: idx % 3 === 0 ? 'plaza' : 'downtown',
      }));
    }
  }

  randomRoadSpot(rng, cx, cz, minD = 20, maxD = 120, tries = 30) {
    if (!this.roads || this.roads.length === 0) return null;
    for (let t = 0; t < tries; t++) {
      const r = this.roads[Math.floor(rng() * this.roads.length)];
      const along = (rng() - 0.5) * (r.sz * 0.9);
      const across = (rng() - 0.5) * (r.sx * 0.6);
      const x = r.x + across;
      const z = r.z + along;
      const d = Math.hypot(x - cx, z - cz);
      if (d >= minD && d <= maxD) {
        const y = this.groundHeightAt ? this.groundHeightAt(x, z) : 0.15;
        const dir = r.sz >= r.sx ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
        return { x, y, z, heading: dir };
      }
    }
    const r = this.roads[0];
    const dir = r.sz >= r.sx ? 0 : Math.PI / 2;
    return { x: r.x, y: 0.15, z: r.z, heading: dir };
  }

  isRoad(x, z) {
    for (const r of this.roads) {
      if (Math.abs(x - r.x) <= r.sx / 2 && Math.abs(z - r.z) <= r.sz / 2) return true;
    }
    // Also include Kasumi Boulevard central avenue
    if (Math.abs(x) <= 12 && z >= -220 && z <= 40) return true;
    return false;
  }

  update(dt, time, playerPos) {
    if (this.refCity && this.refCity.update) {
      this.refCity.update(dt, time, playerPos);
    }
  }

  dispose() {
    this.city.group.remove(this.group);
  }
}
