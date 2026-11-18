// The minimap: the whole city shrunk into a corner, with blips for the player (white arrow),
// the objective (yellow), cop cars (blue), traffic (grey dots) and foot cops (red dots).
import { BEACH_Y, SEA_Y, WORLD } from './config.js';
import { currentObjective } from './missions.js';

export function drawMinimap(ctx, state, x, y, w, h) {
  const sx = w / WORLD.width;
  const sy = h / WORLD.height;
  ctx.save();
  ctx.fillStyle = 'rgba(20, 24, 32, 0.85)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(244, 241, 232, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  // Sea and beach along the south edge.
  ctx.fillStyle = '#2f8fb5';
  ctx.fillRect(x, y + SEA_Y * sy, w, h - SEA_Y * sy);
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(x, y + BEACH_Y * sy, w, (SEA_Y - BEACH_Y) * sy);

  // Roads as pale lines.
  ctx.strokeStyle = 'rgba(232, 200, 90, 0.55)';
  ctx.lineWidth = 1;
  for (const roadX of [240, 540, 840, 1140, 1440, 1740, 2040]) {
    ctx.beginPath();
    ctx.moveTo(x + roadX * sx, y);
    ctx.lineTo(x + roadX * sx, y + h);
    ctx.stroke();
  }
  for (const roadY of [240, 540, 840, 1140]) {
    ctx.beginPath();
    ctx.moveTo(x, y + roadY * sy);
    ctx.lineTo(x + w, y + roadY * sy);
    ctx.stroke();
  }

  // Buildings as small blocks.
  ctx.fillStyle = 'rgba(244, 241, 232, 0.35)';
  for (const b of state.city.buildings) {
    ctx.fillRect(x + b.x * sx, y + b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
  }

  const dot = (px, py, color, radius) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + px * sx, y + py * sy, radius, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const car of state.cars) {
    if (car.exploded) continue;
    dot(car.x, car.y, car.driver === 'police' ? '#5b8cff' : 'rgba(200, 200, 200, 0.8)', car.driver === 'police' ? 2.5 : 1.6);
  }
  for (const cop of state.footCops) dot(cop.x, cop.y, '#ff5a4d', 2);
  const objective = currentObjective(state);
  if (objective.target) {
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(x + objective.target.x * sx, y + objective.target.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // The player: a white arrow pointing where they face.
  const player = state.player;
  const px = x + player.x * sx;
  const py = y + player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}
