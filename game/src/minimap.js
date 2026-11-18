// The minimap: a small live map of Sunbay City in the bottom-left corner — roads, the sea,
// the player (white arrow), police (blue/red), traffic (grey dots), pedestrians (faint dots),
// the mission target (pulsing yellow) and the story places (letters).
import { PALETTE, VIEW, WORLD } from './config.js';
import { ROAD_LINES, PLACES } from './world.js';
import { missionTarget } from './missions.js';

const MAP = { x: 16, y: VIEW.height - 176, w: 220, h: 160 };

export function drawMinimap(context, state) {
  const scaleX = MAP.w / WORLD.width;
  const scaleY = MAP.h / WORLD.height;
  const toMapX = (x) => MAP.x + x * scaleX;
  const toMapY = (y) => MAP.y + y * scaleY;
  context.fillStyle = 'rgba(12, 10, 24, 0.78)';
  context.beginPath();
  context.roundRect(MAP.x - 6, MAP.y - 6, MAP.w + 12, MAP.h + 12, 10);
  context.fill();
  // Land, beach and sea.
  context.fillStyle = '#8a7a52';
  context.fillRect(MAP.x, MAP.y, MAP.w, MAP.h);
  context.fillStyle = '#ecd9a0';
  context.fillRect(MAP.x, toMapY(2240), MAP.w, MAP.h - (toMapY(2240) - MAP.y));
  context.fillStyle = '#1d6f8e';
  context.fillRect(MAP.x, toMapY(2320), MAP.w, MAP.h - (toMapY(2320) - MAP.y));
  // Roads.
  context.strokeStyle = '#3b3b44';
  context.lineWidth = 3;
  for (const line of ROAD_LINES) {
    context.beginPath();
    context.moveTo(toMapX(line), MAP.y);
    context.lineTo(toMapX(line), MAP.y + MAP.h);
    context.stroke();
    context.beginPath();
    context.moveTo(MAP.x, toMapY(line));
    context.lineTo(MAP.x + MAP.w, toMapY(line));
    context.stroke();
  }
  // Story places.
  context.font = 'bold 10px sans-serif';
  context.textAlign = 'center';
  for (const key of Object.keys(PLACES)) {
    const place = PLACES[key];
    context.fillStyle = '#ffd34d';
    context.fillText(key[0].toUpperCase(), toMapX(place.x), toMapY(place.y) + 3);
  }
  // Mission target: a pulsing yellow blip.
  const target = missionTarget(state.missions, state);
  if (target) {
    const pulse = 4 + 2 * Math.sin(performance.now() / 220);
    context.fillStyle = '#ffcf3d';
    context.beginPath();
    context.arc(toMapX(target.x), toMapY(target.y), pulse, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#fff';
    context.lineWidth = 1;
    context.stroke();
  }
  // Traffic and pedestrians, faint.
  context.fillStyle = 'rgba(220,220,220,0.7)';
  for (const car of state.traffic.cars) {
    if (car.dead || car.isPlayerCar) continue;
    context.fillRect(toMapX(car.x) - 1, toMapY(car.y) - 1, 2, 2);
  }
  context.fillStyle = 'rgba(255,255,255,0.45)';
  for (const ped of state.peds.peds) {
    if (ped.down) continue;
    context.fillRect(toMapX(ped.x) - 1, toMapY(ped.y) - 1, 2, 2);
  }
  // Police, flashing blue.
  const blink = Math.floor(performance.now() / 300) % 2 === 0;
  context.fillStyle = blink ? '#3b82ff' : '#ff3b30';
  for (const unit of state.police.units) {
    const x = unit.kind === 'car' ? unit.car.x : unit.x;
    const y = unit.kind === 'car' ? unit.car.y : unit.y;
    context.beginPath();
    context.arc(toMapX(x), toMapY(y), 3.5, 0, Math.PI * 2);
    context.fill();
  }
  // The player: a white arrow pointing where they face.
  const player = state.player;
  context.save();
  context.translate(toMapX(player.x), toMapY(player.y));
  context.rotate(player.angle);
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.moveTo(7, 0);
  context.lineTo(-5, -5);
  context.lineTo(-5, 5);
  context.closePath();
  context.fill();
  context.restore();
  context.strokeStyle = 'rgba(255,255,255,0.5)';
  context.lineWidth = 1;
  context.strokeRect(MAP.x - 6, MAP.y - 6, MAP.w + 12, MAP.h + 12);
  context.fillStyle = 'rgba(245,239,224,0.85)';
  context.font = '11px sans-serif';
  context.textAlign = 'left';
  context.fillText('SUNBAY CITY', MAP.x, MAP.y - 10);
}
