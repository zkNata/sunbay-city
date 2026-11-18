// Sunbay City itself: one fixed city layout (same every run), the full game state, and the
// collision helpers every system shares. Nothing here draws or touches the browser.
import {
  BEACH_Y, BUILDING_COLORS, CAR, CLOCK_SECONDS_PER_MINUTE, CLOCK_START_MINUTES, LAYOUT_SEED,
  PLAYER, ROADS_H, ROADS_V, ROAD_W, SEA_Y, WORLD,
} from './config.js';
import { createRandom } from './random.js';

let nextCarId = 1;

function buildCity() {
  const rng = createRandom(LAYOUT_SEED);
  const buildings = [];
  const parks = [];
  const blockXs = [];
  for (let i = 0; i < ROADS_V.length - 1; i += 1) blockXs.push([ROADS_V[i] + ROAD_W / 2 + 12, ROADS_V[i + 1] - ROAD_W / 2 - 12]);
  blockXs.push([ROADS_V[ROADS_V.length - 1] + ROAD_W / 2 + 12, WORLD.width - 12]);
  const blockYs = [];
  for (let i = 0; i < ROADS_H.length - 1; i += 1) blockYs.push([ROADS_H[i] + ROAD_W / 2 + 12, ROADS_H[i + 1] - ROAD_W / 2 - 12]);
  blockYs.push([ROADS_H[ROADS_H.length - 1] + ROAD_W / 2 + 12, BEACH_Y - 12]);

  function addBuilding(x, y, w, h, name) {
    buildings.push({ x, y, w, h, color: rng.pick(BUILDING_COLORS), name: name ?? null });
  }

  for (let bx = 0; bx < blockXs.length; bx += 1) {
    for (let by = 0; by < blockYs.length; by += 1) {
      const [x0, x1] = blockXs[bx];
      const [y0, y1] = blockYs[by];
      // Landmark blocks hold one named building; the rest are parks or 1-3 houses.
      if (bx === 1 && by === 0) {
        addBuilding(640, 320, 140, 130, 'cafe');
        continue;
      }
      if (bx === 4 && by === 1) {
        addBuilding(1540, 640, 130, 110, 'garage');
        continue;
      }
      if (bx === 6 && by === 3) {
        addBuilding(2110, 1210, 130, 90, 'bar');
        continue;
      }
      if (rng.chance(0.26)) {
        const palms = [];
        const count = rng.int(4, 8);
        for (let i = 0; i < count; i += 1) palms.push({ x: rng.range(x0 + 14, x1 - 14), y: rng.range(y0 + 14, y1 - 14) });
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, palms });
        continue;
      }
      const count = rng.int(1, 3);
      for (let i = 0; i < count; i += 1) {
        const w = rng.range(110, 190);
        const h = rng.range(85, 150);
        const x = rng.range(x0, Math.max(x0 + 1, x1 - w));
        const y = rng.range(y0, Math.max(y0 + 1, y1 - h));
        addBuilding(x, y, w, h);
      }
    }
  }
  // The Marina Office: a hut on stilts at the end of the pier, over the sea. Fixed colour, so
  // the seeded layout above never shifts.
  buildings.push({ x: 2090, y: 1530, w: 130, h: 70, color: '#f2a0a0', name: 'marina' });
  return { buildings, parks };
}

/** The places the story happens: door points the player walks to. */
export const LANDMARKS = {
  cafe: { x: 710, y: 500, label: "Marta's Cafe" },
  garage: { x: 1605, y: 810, label: 'Sunbay Garage' },
  bar: { x: 2175, y: 1345, label: 'Palma Beach Bar' },
  marina: { x: 2130, y: 1490, label: 'Marina Office' },
  spawn: { x: 360, y: 840, label: 'Sunbay Bus Stop' },
};

export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = buildCity();
  const state = {
    seed,
    rng,
    time: 0,
    clockMinutes: CLOCK_START_MINUTES,
    city,
    player: {
      x: LANDMARKS.spawn.x, y: LANDMARKS.spawn.y, angle: -Math.PI / 2, speed: 0,
      health: PLAYER.health, money: 120, inCar: null, pistol: false,
      invulnerable: 0, bustMeter: 0, lastDamage: -99, lastCrime: -99,
      punchCooldown: 0, shootCooldown: 0, aimAngle: 0, dead: false,
    },
    cars: [],
    peds: [],
    footCops: [],
    bullets: [],
    particles: [],
    wanted: 0,
    mission: { index: 0, stage: 'go', timer: 0, toast: '', toastTime: 0, packageCarried: false },
    camera: { x: 0, y: 0 },
    stats: { stolen: 0, shots: 0, punches: 0, busted: 0, wasted: 0 },
    muted: false,
  };
  return state;
}

/** Push a circle out of every building it overlaps; returns true when it touched one. */
export function collideBuildings(state, entity, radius) {
  let hit = false;
  for (const b of state.city.buildings) {
    const cx = Math.max(b.x, Math.min(entity.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(entity.y, b.y + b.h));
    const dx = entity.x - cx;
    const dy = entity.y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < radius) {
      hit = true;
      if (dist > 0.01) {
        entity.x = cx + (dx / dist) * radius;
        entity.y = cy + (dy / dist) * radius;
      } else {
        entity.y = b.y - radius;
      }
    }
  }
  return hit;
}

export function clampToWorld(entity, radius) {
  entity.x = Math.max(radius, Math.min(WORLD.width - radius, entity.x));
  entity.y = Math.max(radius, Math.min(WORLD.height - radius, entity.y));
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** A car object. kind: sedan | taxi | sports | van | police. driver: traffic | police | player | null. */
export function makeCar(kind, x, y, angle, driver) {
  const colors = { sedan: '#e8b13c', taxi: '#f2d13c', sports: '#ff8a3d', van: '#9a8fd0', police: '#3b6fe0' };
  return {
    id: nextCarId++,
    kind, x, y, angle,
    speed: 0,
    color: colors[kind] ?? '#c0c0c0',
    driver,
    health: kind === 'police' ? 150 : 100,
    maxSpeed: kind === 'sports' ? CAR.sportsMaxSpeed : CAR.maxSpeed,
    ramCooldown: 0,
    smoke: 0,
    exploded: false,
    road: null,
    roadDir: 1,
    lane: 0,
  };
}
