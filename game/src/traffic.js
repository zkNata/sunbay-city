// Traffic: ordinary cars that drive their road, brake for the car ahead, and keep the city
// feeling alive. They stay on their road's lane; a nudge back to the lane keeps them honest.
import { CAR, ROADS_H, ROADS_V, ROAD_W, WORLD } from './config.js';
import { clampToWorld, collideBuildings, makeCar } from './world.js';

const KINDS = ['sedan', 'sedan', 'taxi', 'sedan', 'van', 'taxi'];

export function spawnTraffic(state, count) {
  for (let i = 0; i < count; i += 1) {
    const car = makeCar(state.rng.pick(KINDS), 0, 0, 0, 'traffic');
    placeOnRoad(state, car, true);
    state.cars.push(car);
  }
}

function placeOnRoad(state, car, anywhere) {
  const rng = state.rng;
  const vertical = rng.chance(0.5);
  if (vertical) {
    const road = rng.pick(ROADS_V);
    car.road = { axis: 'v', at: road };
    car.lane = rng.pick([-24, 24]);
    car.roadDir = car.lane > 0 ? 1 : -1;
    car.x = road + car.lane;
    car.y = anywhere ? rng.range(80, WORLD.height - 80) : rng.pick([60, WORLD.height - 60]);
    car.angle = car.roadDir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    const road = rng.pick(ROADS_H);
    car.road = { axis: 'h', at: road };
    car.lane = rng.pick([-24, 24]);
    car.roadDir = car.lane > 0 ? 1 : -1;
    car.y = road + car.lane;
    car.x = anywhere ? rng.range(80, WORLD.width - 80) : rng.pick([60, WORLD.width - 60]);
    car.angle = car.roadDir > 0 ? 0 : Math.PI;
  }
  car.speed = rng.range(CAR.trafficSpeed * 0.8, CAR.trafficSpeed * 1.15);
}

function carAhead(state, car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let nearest = null;
  let nearestDist = 78;
  for (const other of state.cars) {
    if (other === car || other.exploded) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = dx * fx + dy * fy;
    if (forward <= 0 || forward > nearestDist) continue;
    const side = Math.abs(-dx * fy + dy * fx);
    if (side < 26) {
      nearestDist = forward;
      nearest = other;
    }
  }
  return nearest;
}

export function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.driver !== 'traffic' || car.exploded) continue;
    const ahead = carAhead(state, car);
    const target = ahead ? 0 : car.maxSpeed * 0.34;
    if (car.speed < target) car.speed = Math.min(target, car.speed + CAR.accel * 0.5 * dt);
    else if (car.speed > target) car.speed = Math.max(target, car.speed - CAR.brake * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Ease back to the lane centre after any shove.
    if (car.road) {
      const want = car.road.axis === 'v' ? car.road.at + car.lane : car.road.at + car.lane;
      const current = car.road.axis === 'v' ? car.x : car.y;
      const diff = want - current;
      if (car.road.axis === 'v') car.x += diff * Math.min(1, 2 * dt);
      else car.y += diff * Math.min(1, 2 * dt);
    }
    clampToWorld(car, CAR.length / 2);
    collideBuildings(state, car, CAR.length / 2 - 4);
    // Recycle far-away cars onto a road near the player so traffic never runs dry.
    const player = state.player;
    if (Math.hypot(car.x - player.x, car.y - player.y) > 1100) {
      placeOnRoad(state, car, false);
      const near = state.rng.chance(0.5);
      if (car.road.axis === 'v') car.y = player.y + (near ? -700 : 700);
      else car.x = player.x + (near ? -700 : 700);
      clampToWorld(car, CAR.length / 2);
    }
  }
}
