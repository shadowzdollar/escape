// Persistent progress in localStorage (guarded: works without storage too).
import { CARS } from './config.js';

const KEY = 'escape-overdrive-save-v1';

const DEFAULTS = () => ({
  coins: 0,
  owned: ['bolt'],
  selected: 'bolt',
  colors: {},
  map: 'city',
  best: {},        // mapId -> { score, time }
  totals: { runs: 0, copsWrecked: 0, coins: 0, time: 0 },
  settings: { quality: 'medium', camera: 'top', sound: true, music: true, fps: false, joyInvSteer: false, joyInvThrottle: false },
});

export function loadSave() {
  let data = DEFAULTS();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      data = { ...data, ...parsed, settings: { ...data.settings, ...(parsed.settings || {}) }, totals: { ...data.totals, ...(parsed.totals || {}) } };
    }
  } catch { /* storage unavailable */ }
  if (!CARS.some((c) => c.id === data.selected)) data.selected = 'bolt';
  if (!data.owned.includes('bolt')) data.owned.push('bolt');
  return data;
}

export function writeSave(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
}
