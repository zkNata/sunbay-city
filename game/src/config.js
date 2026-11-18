// Every tuning number and colour in one place. Sunbay City is one fixed world; the camera
// shows a 1280x720 window of it, clamped exactly to the world's edges.

export const STEP = 1 / 60;

export const WORLD = { width: 2400, height: 1680 };
export const VIEW = { width: 1280, height: 720 };

/** Road centrelines. Roads are ROAD_W wide; blocks sit between them. */
export const ROADS_V = [240, 540, 840, 1140, 1440, 1740, 2040];
export const ROADS_H = [240, 540, 840, 1140];
export const ROAD_W = 96;

/** The south edge is beach, then sea. */
export const BEACH_Y = 1380;
export const SEA_Y = 1500;

/** The city layout never changes between runs; only traffic and people are seeded per run. */
export const LAYOUT_SEED = 20261118;

export const PLAYER = {
  radius: 11,
  walkSpeed: 195,
  runSpeed: 265,
  health: 100,
  regen: 4,
  regenDelay: 5,
  punchRange: 46,
  punchDamage: 20,
  punchCooldown: 0.4,
  shootCooldown: 0.32,
  bulletDamage: 34,
  invulnerable: 1,
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 520,
  brake: 760,
  maxSpeed: 430,
  sportsMaxSpeed: 540,
  reverseSpeed: 170,
  turnRate: 2.6,
  trafficSpeed: 150,
};

export const POLICE = {
  /** Ramming damage per cop car hit, with a per-cop cooldown, so three cops can never melt the player. */
  ramDamage: 10,
  ramCooldown: 1,
  footCopHealth: 50,
  carHealth: 150,
  /** Seconds a foot cop must stay touching the player on foot before the bust lands. */
  bustSeconds: 0.6,
};

export const WANTED = {
  max: 5,
  /** Seconds without a crime before the heat starts to cool, then one star per interval. */
  coolDelay: 25,
  coolInterval: 10,
};

export const MISSIONS = {
  reward: [50, 100, 150, 250],
  packageTime: 90,
};

/** Game clock: 10:00 at the start, one game minute every 6 real seconds. */
export const CLOCK_START_MINUTES = 600;
export const CLOCK_SECONDS_PER_MINUTE = 6;

export const PALETTE = {
  ground: '#d9bd8f',
  block: '#e0c69c',
  road: '#333945',
  roadEdge: '#6b7280',
  lane: '#e8c85a',
  park: '#8fbf6f',
  parkDark: '#7aa85c',
  sand: '#ecd9a4',
  sea: '#3fa8c9',
  seaDeep: '#2f8fb5',
  pier: '#8a6b46',
  buildingRoof: '#7a5c48',
  text: '#f4f1e8',
  muted: '#c9c2b2',
  gold: '#f2c94c',
  health: '#58d977',
  danger: '#e5534b',
  police: '#3b6fe0',
};

export const BUILDING_COLORS = ['#f2a0a0', '#f7c08a', '#a8d8ea', '#d8a7d8', '#f5e6a8', '#a8d8a8', '#f2b8c6'];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'sunbay-city.save.v1';
