// Pedestrians: people on the sidewalks who stroll between corners and run from trouble.
// They never leave the walkable city and they never walk through buildings.
import { WORLD } from './config.js';
import { clampToWorld, collideBuildings } from './world.js';

const SHIRTS = ['#e5534b', '#4fc3f7', '#f2c94c', '#9a8fd0', '#58d977', '#f28bb1', '#e8e8e8'];

export function spawnPeds(state, count) {
  for (let i = 0; i < count; i += 1) {
    const ped = {
      x: state.rng.range(120, WORLD.width - 120),
      y: state.rng.range(120, WORLD.height - 260),
      tx: 0, ty: 0,
      speed: state.rng.range(55, 95),
      color: state.rng.pick(SHIRTS),
      flee: 0, wait: 0,
    };
    pickTarget(state, ped);
    state.peds.push(ped);
  }
}

function pickTarget(state, ped) {
  ped.tx = ped.x + state.rng.range(-320, 320);
  ped.ty = ped.y + state.rng.range(-320, 320);
  ped.tx = Math.max(60, Math.min(WORLD.width - 60, ped.tx));
  ped.ty = Math.max(60, Math.min(WORLD.height - 220, ped.ty));
}

export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    const dx = ped.x - x;
    const dy = ped.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist < radius && dist > 1) {
      ped.flee = 2.5;
      ped.tx = ped.x + (dx / dist) * 320;
      ped.ty = ped.y + (dy / dist) * 320;
      ped.tx = Math.max(60, Math.min(WORLD.width - 60, ped.tx));
      ped.ty = Math.max(60, Math.min(WORLD.height - 220, ped.ty));
    }
  }
}

export function updatePeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.flee > 0) ped.flee -= dt;
    const dx = ped.tx - ped.x;
    const dy = ped.ty - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) {
      ped.wait -= dt;
      if (ped.wait <= 0) {
        pickTarget(state, ped);
        ped.wait = state.rng.range(0, 2);
      }
      continue;
    }
    const speed = ped.flee > 0 ? ped.speed * 2.2 : ped.speed;
    ped.x += (dx / dist) * speed * dt;
    ped.y += (dy / dist) * speed * dt;
    clampToWorld(ped, 8);
    collideBuildings(state, ped, 8);
  }
}
