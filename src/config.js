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
    id: 'snow', name: 'FROSTBITE', desc: 'Icy roads. Every turn is a drift.', seed: 9001,
    theme: 'snow', time: 'overcast', grip: 0.62,
  },
];

// Heat -> wanted level. Each level raises the police response.
export const WANTED = [
  { heat: 0, maxCops: 2, spawnEvery: 5.0, types: ['patrol'] },
  { heat: 30, maxCops: 4, spawnEvery: 4.0, types: ['patrol', 'patrol', 'interceptor'] },
  { heat: 80, maxCops: 6, spawnEvery: 3.2, types: ['patrol', 'interceptor'], roadblocks: true },
  { heat: 140, maxCops: 8, spawnEvery: 2.6, types: ['patrol', 'interceptor', 'swat'], roadblocks: true, heli: true },
  { heat: 220, maxCops: 11, spawnEvery: 2.0, types: ['interceptor', 'interceptor', 'swat', 'patrol'], roadblocks: true, heli: true },
];

export const COP_TYPES = {
  patrol: { model: 'sedan', speed: 39, accel: 25, handling: 2.7, grip: 7.5, hp: 90, mass: 1.25, livery: 'police' },
  interceptor: { model: 'sports', speed: 48, accel: 31, handling: 3.0, grip: 8.0, hp: 80, mass: 1.2, livery: 'police' },
  swat: { model: 'van', speed: 35, accel: 20, handling: 2.3, grip: 7.0, hp: 260, mass: 2.8, livery: 'swat' },
};

export const TRAFFIC_MODELS = ['hatch', 'sedan', 'sedan', 'van', 'hatch', 'taxi', 'truck', 'sedan'];
export const TRAFFIC_COLORS = ['#d8d8d8', '#1d3557', '#9d0208', '#6a994e', '#f1faee', '#495057', '#bc6c25', '#264653', '#e9c46a', '#2b2d42', '#8d99ae', '#a4133c'];

export const POWERUPS = {
  nitro: { label: 'NITRO', color: '#00e5ff', icon: 'N' },
  repair: { label: 'REPAIR', color: '#38e54d', icon: '+' },
  shield: { label: 'SHIELD', color: '#ffd000', icon: 'S' },
  emp: { label: 'EMP', color: '#b44dff', icon: 'E' },
  magnet: { label: 'MAGNET', color: '#ff4d6d', icon: 'M' },
};

export const COIN_VALUE = 5;
