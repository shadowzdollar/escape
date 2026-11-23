// Persistent progress in CrazyGames SDK data + localStorage fallback.
import { CARS } from './config.js';

const KEY = 'fender-bender-save-v1';
const LEGACY_KEY = 'escape-overdrive-save-v1';

const DEFAULTS = () => ({
  coins: 0,
  owned: ['bolt'],
  selected: 'bolt',
  colors: {},
  map: 'city',
  best: {},        // mapId -> { score, time }
  totals: { runs: 0, copsWrecked: 0, coins: 0, time: 0 },
  settings: { quality: 'medium', camera: 'top', sound: true, music: true, fps: false, intro: true, voice: true, joyInvSteer: false, joyInvThrottle: false },
});

function parseRaw(raw) {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function normalizeSave(parsed) {
  let data = DEFAULTS();
  if (parsed) {
    data = {
      ...data,
      ...parsed,
      settings: { ...data.settings, ...(parsed.settings || {}) },
      totals: { ...data.totals, ...(parsed.totals || {}) },
    };
  }
  if (!CARS.some((c) => c.id === data.selected)) data.selected = 'bolt';
  if (!Array.isArray(data.owned)) data.owned = ['bolt'];
  if (!data.owned.includes('bolt')) data.owned.push('bolt');
  return data;
}

export function loadSave() {
  let parsed = null;
  try {
    parsed = parseRaw(localStorage.getItem(KEY)) || parseRaw(localStorage.getItem(LEGACY_KEY));
  } catch { /* storage unavailable */ }
  return normalizeSave(parsed);
}

// Called after CrazyGames SDK v3 finishes async init() to merge cloud save with local progress.
export function syncSaveFromCloud(current) {
  try {
    const cgRaw = window.CrazyGames?.SDK?.data?.getItem?.(KEY);
    const cloud = parseRaw(cgRaw);
    if (!cloud) {
      writeSave(current);
      return current;
    }
    const c = normalizeSave(cloud);
    const merged = normalizeSave({
      ...c,
      ...current,
      coins: Math.max(current.coins || 0, c.coins || 0),
      owned: [...new Set([...(current.owned || []), ...(c.owned || [])])],
      colors: { ...(c.colors || {}), ...(current.colors || {}) },
      trophies: { ...(c.trophies || {}), ...(current.trophies || {}) },
      best: { ...(c.best || {}), ...(current.best || {}) },
      story: {
        ...(c.story || {}),
        ...(current.story || {}),
        xp: Math.max(current.story?.xp || 0, c.story?.xp || 0),
        done: { ...(c.story?.done || {}), ...(current.story?.done || {}) },
      },
      totals: {
        ...c.totals,
        ...current.totals,
        runs: Math.max(current.totals?.runs || 0, c.totals?.runs || 0),
        copsWrecked: Math.max(current.totals?.copsWrecked || 0, c.totals?.copsWrecked || 0),
        coins: Math.max(current.totals?.coins || 0, c.totals?.coins || 0),
        time: Math.max(current.totals?.time || 0, c.totals?.time || 0),
      },
    });
    for (const [mapId, b] of Object.entries(c.best || {})) {
      const curB = current.best?.[mapId];
      if (!curB || (b && b.score > curB.score)) merged.best[mapId] = b;
    }
    writeSave(merged);
    return merged;
  } catch {
    return current;
  }
}

export function writeSave(data) {
  const str = JSON.stringify(data);
  try { localStorage.setItem(KEY, str); } catch { /* ignore */ }
  try { window.CrazyGames?.SDK?.data?.setItem?.(KEY, str); } catch { /* ignore */ }
}
