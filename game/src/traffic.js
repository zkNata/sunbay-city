// The city's traffic: cars that cruise along the roads in lanes, slow down for the car ahead,
// and respawn on a far road when they leave the area. Parked cars sit at the kerb waiting to
// be stolen. Every car is one object the player, the police and combat all share.
import { CAR, TRAFFIC } from './config.js';
import { ROAD_LINES, isOnRoad } from './world.js';
import { pick, range } from './random.js';

const TRAFFIC_COLORS = ['#d8d8d8', '#c25a4a', '#4a7ac2', '#e8c95a', '#5a8a5a', '#8a5ac2', '#e8e8e8', '#3a3a3a', '#c28a4a'];
const PARKED_COLORS = ['#ff8a3d', '#2ad8c2', '#e84a7a', '#ffd34d', '#7ab8ff'];

export function makeCar(rand, x, y, angle, color, kind) {
  return {
    x, y, angle, speed: 0, color: color || pick(rand, TRAFFIC_COLORS),
    kind: kind || 'traffic',
    health: CAR.health,
    road: 0, axis: 'x', dir: 1, lane: 0,
    cruise: range(rand, TRAFFIC.minSpeed, TRAFFIC.maxSpeed),
    smokeTimer: 0, dead: false, isPlayerCar: false,
  };
}

/** A parked car on the kerb of a random road, facing along it. */
export function spawnParkedCar(rand, city) {
  const axis = rand() < 0.5 ? 'x' : 'y';
  const line = pick(rand, ROAD_LINES);
  const along = range(rand, 260, 2940);
  const lane = (rand() < 0.5 ? -1 : 1) * 34;
  const x = axis === 'x' ? along : line + lane;
  const y = axis === 'x' ? line + lane : along;
  const angle = axis === 'x' ? (lane > 0 ? 0 : Math.PI) : (lane > 0 ? Math.PI / 2 : -Math.PI / 2);
  const car = makeCar(rand, x, y, angle, pick(rand, PARKED_COLORS), 'parked');
  car.axis = axis;
  car.road = line;
  return car;
}

/** A moving traffic car on a random road, in a lane, heading one way. */
export function spawnTrafficCar(rand) {
  const axis = rand() < 0.5 ? 'x' : 'y';
  const line = pick(rand, ROAD_LINES);
  const along = range(rand, 200, 3000);
  const dir = rand() < 0.5 ? -1 : 1;
  const lane = dir * 18;
  const x = axis === 'x' ? along : line + lane;
  const y = axis === 'x' ? line + lane : along;
  const angle = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  const car = makeCar(rand, x, y, angle, null, 'traffic');
  car.axis = axis;
  car.road = line;
  car.dir = dir;
  car.lane = lane;
  car.speed = car.cruise;
  return car;
}

export function createTraffic(rand, city) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.count; i += 1) cars.push(spawnTrafficCar(rand));
  for (let i = 0; i < 8; i += 1) cars.push(spawnParkedCar(rand, city));

  function carAhead(car, carsList) {
    const aheadX = car.x + Math.cos(car.angle) * 52;
    const aheadY = car.y + Math.sin(car.angle) * 52;
    for (const other of carsList) {
      if (other === car || other.dead) continue;
      const dx = other.x - aheadX;
      const dy = other.y - aheadY;
      if (dx * dx + dy * dy < 42 * 42) return other;
    }
    return null;
  }

  function step(dt, state) {
    const player = state.player;
    for (const car of cars) {
      if (car.dead || car.isPlayerCar || car.kind === 'parked') continue;
      // Slow down for the car ahead, then cruise again.
      const blocked = carAhead(car, cars);
      const target = blocked ? 0 : car.cruise;
      car.speed += Math.max(-500 * dt, Math.min(260 * dt, target - car.speed));
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      // Off the map: respawn on a road far from the player.
      if (car.x < 120 || car.x > 3080 || car.y < 120 || car.y > 2320) {
        const fresh = spawnTrafficCar(rand);
        const dx = fresh.x - player.x;
        const dy = fresh.y - player.y;
        if (dx * dx + dy * dy < 500 * 500) {
          fresh.x = 3000 - fresh.x + 200;
          fresh.y = 2200 - fresh.y + 200;
        }
        Object.assign(car, fresh);
      }
    }
  }

  return { cars, step, spawnTrafficCar: () => spawnTrafficCar(rand), spawnParkedCar: () => spawnParkedCar(rand, city) };
}

/** A simple top-down car body: rounded rectangle, windshield, roof, headlights. */
export function drawCar(context, car) {
  context.save();
  context.translate(car.x, car.y);
  context.rotate(car.angle);
  context.fillStyle = 'rgba(0,0,0,0.3)';
  context.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
  context.fillStyle = car.color;
  context.beginPath();
  context.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
  context.fill();
  context.fillStyle = '#20242e';
  context.beginPath();
  context.roundRect(-6, -CAR.width / 2 + 3, 14, CAR.width - 6, 3);
  context.fill();
  context.fillStyle = 'rgba(255,255,255,0.25)';
  context.fillRect(CAR.length / 2 - 8, -CAR.width / 2 + 3, 3, 5);
  context.fillRect(CAR.length / 2 - 8, CAR.width / 2 - 8, 3, 5);
  context.fillStyle = '#ffe9a8';
  context.fillRect(CAR.length / 2 - 2, -CAR.width / 2 + 2, 2, 5);
  context.fillRect(CAR.length / 2 - 2, CAR.width / 2 - 7, 2, 5);
  if (car.kind === 'police') {
    const blink = Math.floor(performance.now() / 180) % 2 === 0;
    context.fillStyle = blink ? '#ff3b30' : '#3b82ff';
    context.beginPath();
    context.arc(-2, -CAR.width / 2 + 2, 4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = blink ? '#3b82ff' : '#ff3b30';
    context.beginPath();
    context.arc(-2, CAR.width / 2 - 2, 4, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
  if (car.health < 60 && car.health > 0) {
    context.fillStyle = 'rgba(90,90,90,0.6)';
    context.beginPath();
    context.arc(car.x - Math.cos(car.angle) * 10, car.y - Math.sin(car.angle) * 10, 5 + Math.random() * 4, 0, Math.PI * 2);
    context.fill();
  }
}
