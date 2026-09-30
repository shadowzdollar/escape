// Game data: cars, maps, heat levels, pickups.

export const CITY = {
  N: 16,          // blocks per side
  BLOCK: 58,      // block size (m)
  ROAD: 16,       // road width (m)
  SIDEWALK: 3,
  RIVER_ROW: 5,   // block row that becomes a river
};
CITY.CELL = CITY.BLOCK + CITY.ROAD;
CITY.HALF = (CITY.N / 2) * CITY.CELL + CITY.ROAD / 2; // outer edge of the ring road

// speed m/s, accel m/s², handling = max yaw rate (rad/s), grip = lateral damping, hp, mass (relative)
export const CARS = [
  {
    id: 'bolt', name: 'BOLT', model: 'hatch', price: 0, color: '#e63946',
    tagline: 'Plucky city hatchback. Tight turns, thin skin.',
    stats: { speed: 37, accel: 24, handling: 3.1, grip: 7.0, hp: 100, mass: 1.0 },
  },
  {
    id: 'cruiser', name: 'CRUISER', model: 'sedan', price: 300, color: '#2f6fe0',
    tagline: 'Everyday sedan with a surprising kick.',
    stats: { speed: 40, accel: 25, handling: 2.9, grip: 7.4, hp: 125, mass: 1.2 },
  },
  {
    id: 'brute', name: 'BRUTE', model: 'muscle', price: 900, color: '#f4a300',
    tagline: 'V8 muscle. Loves drifting, loves ramming.',
    stats: { speed: 45, accel: 28, handling: 2.6, grip: 6.0, hp: 160, mass: 1.55 },
  },
  {
    id: 'ranger', name: 'RANGER', model: 'truck', price: 1800, color: '#4d8a3d',
    tagline: 'Lifted off-road pickup. Shrugs off cops.',
    stats: { speed: 41, accel: 23, handling: 2.5, grip: 7.2, hp: 240, mass: 2.1 },
  },
  {
    id: 'stinger', name: 'STINGER', model: 'sports', price: 3000, color: '#d90429',
    tagline: 'Precision sports coupe. Corners like rails.',
    stats: { speed: 49, accel: 31, handling: 3.3, grip: 8.2, hp: 125, mass: 1.2 },
  },
  {
    id: 'apex', name: 'APEX', model: 'super', price: 5000, color: '#ffc300',
    tagline: 'Mid-engine supercar. Blink and it is gone.',
    stats: { speed: 55, accel: 35, handling: 3.4, grip: 8.6, hp: 135, mass: 1.3 },
  },
  {
    id: 'photon', name: 'PHOTON', model: 'hyper', price: 8000, color: '#7b2ff7',
    tagline: 'Electric hypercar from the future. Neon included.',
    stats: { speed: 60, accel: 40, handling: 3.6, grip: 9.0, hp: 160, mass: 1.35 },
  },

  // ---- real-world inspired (fictional names)
  { id: 'minima', name: 'MINIMA', model: 'minima', price: 1200, color: '#0f5132', accent: '#f2f2f2', tagline: 'Tiny British icon. Darts through traffic.', stats: { speed: 38, accel: 25, handling: 3.5, grip: 7.8, hp: 95, mass: 0.9 } },
  { id: 'buggle', name: 'BUGGLE', model: 'buggle', price: 1500, color: '#6ec1e4', tagline: 'The round little people-mover everyone loves.', stats: { speed: 36, accel: 20, handling: 3.2, grip: 7.2, hp: 110, mass: 0.95 } },
  { id: 'hippie', name: 'HIPPIE BUS', model: 'hippie', price: 2500, color: '#f5f0e6', accent: '#e07a5f', tagline: 'Peace, love and surprisingly thick steel.', stats: { speed: 34, accel: 18, handling: 2.3, grip: 6.8, hp: 200, mass: 1.8 } },
  { id: 'stallion', name: 'STALLION 67', model: 'stallion', price: 4000, color: '#1e40af', accent: '#ffffff', tagline: 'Classic fastback pony car. Pure V8 thunder.', stats: { speed: 46, accel: 29, handling: 2.7, grip: 6.4, hp: 165, mass: 1.5 } },
  { id: 'eldorado', name: 'ELDORADO 59', model: 'eldorado', price: 5500, color: '#ff9ec7', accent: '#f5f5f5', tagline: 'Chrome, fins and a sofa for a seat.', stats: { speed: 44, accel: 24, handling: 2.4, grip: 6.5, hp: 190, mass: 1.8 } },
  { id: 'stutt', name: 'STUTT 9', model: 'stutt', price: 6500, color: '#c0c0c0', tagline: 'Rear-engined legend. Perfect on the limit.', stats: { speed: 52, accel: 33, handling: 3.5, grip: 8.8, hp: 130, mass: 1.2 } },
  { id: 'gelande', name: 'GELANDE G', model: 'gelande', price: 7000, color: '#1b1b1b', tagline: 'Boxy luxury off-roader. Built like a vault.', stats: { speed: 45, accel: 27, handling: 2.6, grip: 7.5, hp: 260, mass: 2.2 } },
  { id: 'raptor', name: 'RAPTOR TR', model: 'raptor', price: 8000, color: '#8a8d91', tagline: 'Desert-racing super truck. Jumps curbs for fun.', stats: { speed: 47, accel: 28, handling: 2.6, grip: 7.4, hp: 280, mass: 2.3 } },
  { id: 'rosso', name: 'ROSSO F8', model: 'rosso', price: 9000, color: '#d40000', tagline: 'Italian V8 berlinetta. Screams to redline.', stats: { speed: 56, accel: 36, handling: 3.5, grip: 8.8, hp: 135, mass: 1.25 } },
  { id: 'velox', name: 'VELOX MX', model: 'velox', price: 11000, color: '#ff7a00', tagline: 'Carbon-tub British hypercar.', stats: { speed: 58, accel: 38, handling: 3.6, grip: 9.0, hp: 135, mass: 1.25 } },
  { id: 'toro', name: 'TORO V12', model: 'toro', price: 12000, color: '#9acd32', tagline: 'Angular Italian V12 wedge. Loud in every way.', stats: { speed: 60, accel: 39, handling: 3.5, grip: 8.9, hp: 145, mass: 1.3 } },
  { id: 'veyra', name: 'VEYRA', model: 'veyra', price: 20000, color: '#1e3a8a', accent: '#0b0f1a', tagline: 'Sixteen cylinders. The fastest thing on wheels.', stats: { speed: 66, accel: 42, handling: 3.5, grip: 9.2, hp: 170, mass: 1.4 } },
];

export const PAINTS = [
  '#e63946', '#d90429', '#f77f00', '#ffc300', '#8ac926', '#2a9d8f', '#00b4d8',
  '#2f6fe0', '#3a0ca3', '#7b2ff7', '#f72585', '#ffffff', '#adb5bd', '#343a40', '#111111',
];

export const MAPS = [
  {
    id: 'city', name: 'METRO CITY', desc: 'Sunny downtown with a river and parks.', seed: 1337,
    theme: 'city', time: 'day', grip: 1.0,
  },
  {
    id: 'night', name: 'NEON NIGHTS', desc: 'Rain-soaked streets under neon light.', seed: 4242,
    theme: 'city', time: 'night', grip: 0.92,
  },
  {
    id: 'desert', name: 'DUST VALLEY', desc: 'Sun-baked desert town at golden hour.', seed: 777,
    theme: 'desert', time: 'dusk', grip: 0.95,
  },
  {
    id: 'giza', name: 'GIZA', desc: 'Sandstone streets on the Nile, beside the pyramids.', seed: 3141,
    theme: 'egypt', time: 'hot', grip: 0.95,
  },
  {
    id: 'snow', name: 'FROSTBITE', desc: 'Icy roads. Every turn is a drift.', seed: 9001,
    theme: 'snow', time: 'overcast', grip: 0.62,
  },
];

// Heat -> wanted level. Each level raises the police response.
export const WANTED = [
  { heat: 0, maxCops: 2, spawnEvery: 5.0, types: ['patrol'] },
  { heat: 30, maxCops: 4, spawnEvery: 4.0, types: ['patrol', 'patrol', 'interceptor'] },
  { heat: 80, maxCops: 6, spawnEvery: 3.2, types: ['patrol', 'interceptor'], roadblocks: true },
  { heat: 140, maxCops: 8, spawnEvery: 2.6, types: ['patrol', 'interceptor', 'interceptor'], roadblocks: true, heli: true },
  // 5★: SWAT armoured trucks join the chase
  { heat: 220, maxCops: 11, spawnEvery: 2.0, types: ['swat', 'swat', 'interceptor', 'patrol'], roadblocks: true, heli: true, swat: true },
  // 6★: the army arrives — tanks do the shooting (roadblocks + chasing tanks)
  { heat: 290, maxCops: 8, spawnEvery: 2.4, types: ['swat', 'interceptor', 'patrol'], heli: true, tanks: 3, tankBlocks: true },
  // 7★: a fleet of attack helicopters opens fire (missiles + bombs), tanks stay on you
  { heat: 370, maxCops: 7, spawnEvery: 2.4, types: ['swat', 'interceptor'], heli: true, tanks: 3, tankBlocks: true, gunships: 5, bombs: true },
];

export const COP_TYPES = {
  patrol: { model: 'sedan', speed: 39, accel: 25, handling: 2.7, grip: 7.5, hp: 90, mass: 1.25, livery: 'police' },
  interceptor: { model: 'sports', speed: 48, accel: 31, handling: 3.0, grip: 8.0, hp: 80, mass: 1.2, livery: 'police' },
  swat: { model: 'van', speed: 35, accel: 20, handling: 2.3, grip: 7.0, hp: 260, mass: 2.8, livery: 'swat' },
  tank: { model: 'tank', speed: 24, accel: 11, handling: 1.5, grip: 9.0, hp: 700, mass: 7.0, livery: null },
};

export const TRAFFIC_MODELS = ['hatch', 'sedan', 'sedan', 'van', 'hatch', 'taxi', 'truck', 'sedan'];
export const TRAFFIC_COLORS = ['#d8d8d8', '#1d3557', '#9d0208', '#6a994e', '#f1faee', '#495057', '#bc6c25', '#264653', '#e9c46a', '#2b2d42', '#8d99ae', '#a4133c'];

export const POWERUPS = {
  nitro: { label: 'NITRO', color: '#00e5ff', icon: 'N' },
  repair: { label: 'REPAIR', color: '#38e54d', icon: '+' },
  shield: { label: 'SHIELD', color: '#ffd000', icon: 'S' },
  emp: { label: 'EMP', color: '#b44dff', icon: 'E' },
  magnet: { label: 'MAGNET', color: '#ff4d6d', icon: 'M' },
  guns: { label: 'MACHINE GUNS', color: '#ff9f1c', icon: 'G' },
  rockets: { label: 'ROCKETS', color: '#e63946', icon: 'R' },
};

export const COIN_VALUE = 5;
