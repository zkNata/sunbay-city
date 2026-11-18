// Every tuning number and colour in one place. Sunbay City is a fixed 3200x2400 world:
// a grid of roads every 400 px, blocks of pastel buildings between them, a beach and the sea
// along the south edge, a park, a marina pier and a safehouse. The viewport is 1280x720.

export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 3200, height: 2400 };
export const ROAD = { width: 84, spacing: 400, first: 200 };
export const STEP = 1 / 60;

export const PLAYER = {
  walkSpeed: 230,
  runSpeed: 320,
  radius: 14,
  health: 100,
  punchRange: 56,
  punchDamage: 26,
  punchCooldown: 0.45,
  shootCooldown: 0.22,
  bulletDamage: 34,
};

export const CAR = {
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 160,
  turnRate: 2.6,
  length: 46,
  width: 22,
  health: 100,
};

export const TRAFFIC = { count: 16, minSpeed: 130, maxSpeed: 210 };
export const PEDS = { count: 26, walkSpeed: 55 };

export const POLICE = {
  carSpeed: 520,
  footSpeed: 205,
  bustHold: 1.1,
  bustRadius: 30,
  shootRange: 420,
  shootCooldown: 0.9,
  decaySeconds: 25,
};

export const MONEY = { start: 120, bustFine: 150 };

export const SAVE_KEY = 'sunbay-city.save.v1';

export const PALETTE = {
  ground: '#c9b183',
  block: '#bfa878',
  sidewalk: '#8f8a80',
  road: '#3b3b44',
  roadEdge: '#2c2c34',
  dash: '#e8d98a',
  sand: '#ecd9a0',
  seaDeep: '#1d6f8e',
  seaShallow: '#3fa7c4',
  park: '#7fae62',
  parkDark: '#6b9a52',
  building: ['#e8a87c', '#d4847a', '#f2d5a0', '#8fb8a8', '#e8c9c9', '#c9a2c8', '#f0e0c0', '#a8c8d8'],
  roof: ['#b06a4a', '#8f5a52', '#c8a86a', '#5f8a7a', '#a87a8a', '#8a6a9a', '#b89a6a', '#6a8aa0'],
  glass: '#9fd8e8',
  palmTrunk: '#8a6a4a',
  palmLeaf: '#3f8a4a',
  player: '#ff5a3c',
  playerDark: '#c23a22',
  ped: ['#4a7ac2', '#c2a24a', '#7ac24a', '#c24a8a', '#8a5ac2', '#e8e8e8', '#3a3a3a'],
  policeCar: '#2a4a8a',
  policeLight: ['#ff3b30', '#3b82ff'],
  hudPanel: 'rgba(12, 10, 24, 0.72)',
  hudText: '#f5efe0',
  hudGold: '#ffd34d',
  hudRed: '#ff5a4a',
  objective: '#ffd34d',
  marker: '#ffcf3d',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
