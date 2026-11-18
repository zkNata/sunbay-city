// Sunbay City itself: the road grid, the blocks of buildings, the park, the beach and the sea,
// the named story locations, and the collision helpers every moving thing uses. The city is
// built once from the seeded random, so the same seed always builds the same streets.
import { PALETTE, ROAD, WORLD } from './config.js';
import { pick, range, rangeInt } from './random.js';

export const ROAD_LINES = [];
for (let i = 0; i < 8; i += 1) ROAD_LINES.push(ROAD.first + i * ROAD.spacing);

export const BEACH_Y = 2240;
export const SEA_Y = 2320;

/** The story's named places: cafe, garage, dock, beach bar, marina office, safehouse. */
export const PLACES = {
  cafe: { x: 1150, y: 1150, label: "Marta's Cafe" },
  garage: { x: 2400, y: 800, label: 'Sunbay Garage' },
  dock: { x: 320, y: 2080, label: 'Old Dock' },
  beachBar: { x: 1600, y: 2290, label: 'Palma Beach Bar' },
  marina: { x: 2900, y: 2280, label: 'Marina Office' },
  safehouse: { x: 400, y: 400, label: 'Safehouse' },
  hospital: { x: 2000, y: 2000, label: 'Sunbay Clinic' },
};

export function createCity(rand) {
  const buildings = [];
  const palms = [];
  const half = ROAD.width / 2 + 14;
  // One or two pastel buildings per block, with a margin from the road.
  for (let col = 0; col < 7; col += 1) {
    for (let row = 0; row < 5; row += 1) {
      const x0 = ROAD_LINES[col] + half;
      const x1 = ROAD_LINES[col + 1] - half;
      const y0 = ROAD_LINES[row] + half;
      const y1 = ROAD_LINES[row + 1] - half;
      // The middle block is Coral Park; the rest hold buildings.
      if (col === 3 && row === 2) continue;
      const count = rand() < 0.45 ? 1 : 2;
      for (let b = 0; b < count; b += 1) {
        const w = range(rand, 110, 190);
        const h = range(rand, 100, 170);
        const bx = count === 1 ? x0 + (x1 - x0 - w) / 2 : x0 + 8 + b * ((x1 - x0 - w) / 2);
        const by = y0 + 14 + rand() * Math.max(1, y1 - y0 - h - 28);
        const colorIndex = rangeInt(rand, 0, PALETTE.building.length - 1);
        buildings.push({
          x: bx, y: by, w, h,
          color: PALETTE.building[colorIndex],
          roof: PALETTE.roof[colorIndex],
          windows: rangeInt(rand, 2, 4),
        });
      }
    }
  }
  // Palm trees along the beach promenade and a few on the park's edge.
  for (let x = 260; x < 3100; x += 130) {
    palms.push({ x: x + range(rand, -14, 14), y: BEACH_Y - 46 + range(rand, -8, 8) });
  }
  for (let i = 0; i < 10; i += 1) {
    palms.push({ x: range(rand, 1420, 1780), y: range(rand, 1020, 1380) });
  }
  return { buildings, palms, park: { x: ROAD_LINES[3] + half, y: ROAD_LINES[2] + half, w: ROAD_LINES[4] - ROAD_LINES[3] - half * 2, h: ROAD_LINES[3] - ROAD_LINES[2] - half * 2 } };
}

export function isOnRoad(x, y) {
  const half = ROAD.width / 2;
  for (const line of ROAD_LINES) {
    if (Math.abs(x - line) <= half || Math.abs(y - line) <= half) return true;
  }
  return false;
}

export function nearestRoadLine(value) {
  let best = ROAD_LINES[0];
  for (const line of ROAD_LINES) if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  return best;
}

/** Push a circle out of every building it overlaps and clamp it inside the world. */
export function resolveCircle(x, y, radius, city) {
  let nx = Math.max(radius, Math.min(WORLD.width - radius, x));
  let ny = Math.max(radius, Math.min(WORLD.height - radius, y));
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
    const dx = nx - cx;
    const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    if (d2 > 0.01) {
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * radius;
      ny = cy + (dy / d) * radius;
    } else {
      // Centre inside the building: push out along the smallest overlap.
      const left = nx - b.x;
      const right = b.x + b.w - nx;
      const top = ny - b.y;
      const bottom = b.y + b.h - ny;
      const min = Math.min(left, right, top, bottom);
      if (min === left) nx = b.x - radius;
      else if (min === right) nx = b.x + b.w + radius;
      else if (min === top) ny = b.y - radius;
      else ny = b.y + b.h + radius;
    }
  }
  return { x: nx, y: ny };
}

export function circleHitsBuilding(x, y, radius, city) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

export function rectHitsBuilding(x, y, w, h, city) {
  for (const b of city.buildings) {
    if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) return b;
  }
  return null;
}
