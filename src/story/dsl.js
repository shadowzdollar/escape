// Tiny builder language for writing missions. Every builder returns one step;
// `o` can add: say (lines at start), end (lines when done), threat (-1 none … 6 air
// strike), time (step time limit), plus type-specific options.
export const L = (who, text) => [who, text];

export const talk = (lines, o = {}) => ({ t: 'talk', say: lines, ...o });
export const go = (label, at, o = {}) => ({ t: 'reach', label, at, ...o });
export const foot = (label, at, o = {}) => ({ t: 'reach', label, at, foot: true, ...o });
export const boat = (label, at = { river: true }, o = {}) => ({ t: 'reach', label, at, boat: true, ...o });
export const swim = (label, o = {}) => ({ t: 'reach', label, at: { river: true, near: [30, 70] }, swim: true, ...o });
export const collect = (label, count, o = {}) => ({ t: 'collect', label, count, ...o });
export const survive = (label, secs, o = {}) => ({ t: 'survive', label, secs, ...o });
export const evade = (label = 'LOSE THE POLICE', secs = 8, o = {}) => ({ t: 'evade', label, secs, ...o });
export const wreck = (label, count, o = {}) => ({ t: 'wreck', label, count, ...o });
export const heli = (label, count, o = {}) => ({ t: 'heli', label, count, ...o });
export const kill = (label, o = {}) => ({ t: 'kill', label, ...o });
export const takedown = (label, o = {}) => ({ t: 'takedown', label, ...o });
export const tail = (label, o = {}) => ({ t: 'tail', label, ...o });
export const steal = (label, vehicle, o = {}) => ({ t: 'steal', label, vehicle, ...o });
export const deliver = (label, to, o = {}) => ({ t: 'deliver', label, to, ...o });
export const hold = (label, secs, o = {}) => ({ t: 'hold', label, secs, ...o });
export const clear = (label, count, o = {}) => ({ t: 'clear', label, count, ...o });
export const race = (label, count, o = {}) => ({ t: 'race', label, count, ...o });
export const plant = (label, count, o = {}) => ({ t: 'plant', label, count, ...o });
export const scout = (label, count, o = {}) => ({ t: 'scout', label, count, ...o });
export const meet = (label, talkLines, o = {}) => ({ t: 'meet', label, talk: talkLines, ...o });

// places
export const P = {
  near: (a, b) => ({ near: [a, b] }),
  far: { far: true },
  home: { home: true },
  bank: { bank: true },
  river: (a = 200, b = 450) => ({ river: true, near: [a, b] }),
  park: { block: ['park'] },
  plaza: { block: ['plaza'] },
  oldtown: { block: ['oldtown', 'midtown'] },
  downtown: { block: ['downtown'] },
  industrial: { block: ['industrial'] },
  parking: { block: ['parking', 'plaza'] },
  suburb: { block: ['suburb'] },
  block: (types, a, b) => ({ block: types, near: [a, b] }),
  airstrip: { airstrip: true },
  pyramid: { landmark: 'pyramid' },
  sphinx: { landmark: 'sphinx' },
  last: { last: true },
};

// vehicles
export const V = {
  sports: (color = '#0b0b0b', o = {}) => ({ model: 'sports', color, hp: 170, speed: 44, ...o }),
  sedan: (color = '#3a3f47', o = {}) => ({ model: 'sedan', color, hp: 200, speed: 38, ...o }),
  van: (color = '#2b2d42', o = {}) => ({ model: 'van', color, hp: 320, speed: 34, ...o }),
  armored: (o = {}) => ({ model: 'van', color: '#1f2329', livery: 'swat', hp: 520, speed: 33, ...o }),
  truck: (color = '#6c757d', o = {}) => ({ model: 'truck', color, hp: 300, speed: 36, ...o }),
  super: (color = '#d90429', o = {}) => ({ model: 'super', color, hp: 160, speed: 50, ...o }),
  car: (id) => ({ car: id }),
  cop: (type = 'patrol') => ({ cop: type }),
  tank: () => ({ tank: true }),
  boat: (kind = 'speed') => ({ boat: kind }),
};
