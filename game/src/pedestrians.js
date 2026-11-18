// Pedestrians: they stroll the sidewalks, cross at intersections, chat in place, and run
// away from gunfire, speeding cars and the police. A pedestrian who is hit gets up angry or
// stays down; hurting one is a crime the police notice.
import { PEDS } from './config.js';
import { ROAD_LINES, resolveCircle } from './world.js';
import { pick, range } from './random.js';

export function makePed(rand, x, y) {
  return {
    x, y, angle: range(rand, 0, Math.PI * 2),
    speed: range(rand, PEDS.walkSpeed * 0.7, PEDS.walkSpeed * 1.3),
    color: pick(rand, ['#4a7ac2', '#c2a24a', '#7ac24a', '#c24a8a', '#8a5ac2', '#e8e8e8', '#3a3a3a']),
    state: 'walk',
    stateTimer: range(rand, 2, 8),
    targetX: x, targetY: y,
    down: false, downTimer: 0, fleeX: 0, fleeY: 0,
  };
}

export function createPedestrians(rand, city) {
  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    const line = pick(rand, ROAD_LINES);
    const along = range(rand, 240, 2960);
    const side = (rand() < 0.5 ? -1 : 1) * 58;
    const horizontal = rand() < 0.5;
    const ped = makePed(rand, horizontal ? along : line + side, horizontal ? line + side : along);
    peds.push(ped);
  }

  function pickSidewalkTarget(ped) {
    const line = pick(rand, ROAD_LINES);
    const along = range(rand, 240, 2960);
    const side = (rand() < 0.5 ? -1 : 1) * 58;
    const horizontal = rand() < 0.5;
    ped.targetX = horizontal ? along : line + side;
    ped.targetY = horizontal ? line + side : along;
  }

  function step(dt, state) {
    const player = state.player;
    for (const ped of peds) {
      if (ped.down) {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.down = false;
          ped.state = 'flee';
          ped.stateTimer = 2.5;
          ped.fleeX = ped.x + (ped.x - player.x);
          ped.fleeY = ped.y + (ped.y - player.y);
        }
        continue;
      }
      // Flee from danger: the player shooting, a fast car, or a wanted chase nearby.
      const dxp = ped.x - player.x;
      const dyp = ped.y - player.y;
      const distPlayer = Math.hypot(dxp, dyp);
      const danger = state.shotsFiredTimer > 0 || state.wanted > 0;
      if (danger && distPlayer < 320 && ped.state !== 'flee') {
        ped.state = 'flee';
        ped.stateTimer = 2 + Math.random() * 2;
        ped.fleeX = ped.x + dxp;
        ped.fleeY = ped.y + dyp;
      }
      if (ped.state === 'flee') {
        ped.stateTimer -= dt;
        const dx = ped.fleeX - ped.x;
        const dy = ped.fleeY - ped.y;
        const d = Math.hypot(dx, dy) || 1;
        ped.angle = Math.atan2(dy, dx);
        const speed = ped.speed * 2.6;
        const pos = resolveCircle(ped.x + Math.cos(ped.angle) * speed * dt, ped.y + Math.sin(ped.angle) * speed * dt, 12, city);
        ped.x = pos.x;
        ped.y = pos.y;
        if (ped.stateTimer <= 0 || d < 20) ped.state = 'walk';
        continue;
      }
      ped.stateTimer -= dt;
      if (ped.stateTimer <= 0) {
        if (ped.state === 'walk') {
          ped.state = Math.random() < 0.3 ? 'idle' : 'walk';
          ped.stateTimer = ped.state === 'idle' ? range(rand, 2, 6) : range(rand, 3, 9);
          if (ped.state === 'walk') pickSidewalkTarget(ped);
        } else {
          ped.state = 'walk';
          ped.stateTimer = range(rand, 3, 9);
          pickSidewalkTarget(ped);
        }
      }
      if (ped.state === 'walk') {
        const dx = ped.targetX - ped.x;
        const dy = ped.targetY - ped.y;
        const d = Math.hypot(dx, dy);
        if (d < 12) {
          ped.stateTimer = 0;
          continue;
        }
        ped.angle = Math.atan2(dy, dx);
        const pos = resolveCircle(ped.x + Math.cos(ped.angle) * ped.speed * dt, ped.y + Math.sin(ped.angle) * ped.speed * dt, 12, city);
        ped.x = pos.x;
        ped.y = pos.y;
      }
    }
  }

  return { peds, step };
}

export function drawPed(context, ped) {
  context.save();
  context.translate(ped.x, ped.y);
  if (ped.down) {
    context.rotate(ped.angle + Math.PI / 2);
    context.fillStyle = ped.color;
    context.beginPath();
    context.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8c9a8';
    context.beginPath();
    context.arc(13, 0, 6, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }
  const bob = Math.sin(performance.now() / 160 + ped.x) * 1.5;
  context.rotate(ped.angle);
  context.fillStyle = 'rgba(0,0,0,0.25)';
  context.beginPath();
  context.ellipse(0, 2, 10, 7, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = ped.color;
  context.beginPath();
  context.arc(0, 0, 9, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#e8c9a8';
  context.beginPath();
  context.arc(6, bob * 0.3, 6, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#2a2a2a';
  context.beginPath();
  context.arc(8, bob * 0.3 - 2, 3, 0, Math.PI * 2);
  context.fill();
  context.restore();
}
