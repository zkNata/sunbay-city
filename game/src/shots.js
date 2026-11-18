// The screenshot scenes behind ?shot=chase|driving|mission|onfoot|start. Each one sets the real
// game to a chosen moment — mission, wanted level, cars and people placed on the roads — then
// plays the real rules forward for a couple of seconds with a simple autopilot, so the frame is
// what a short game really looks like and the same seed always gives the same frame. The camera
// is snapped to the player before the first paint, and it is clamped exactly to the world.
import { STEP } from './config.js';
import { createWorld, LANDMARKS, makeCar } from './world.js';
import { setupMission } from './missions.js';
import { spawnPeds } from './pedestrians.js';
import { spawnTraffic } from './traffic.js';
import { cameraFor, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function seedScene(seed) {
  const state = createWorld(seed);
  state.muted = true;
  spawnTraffic(state, 14);
  spawnPeds(state, 22);
  return state;
}

function placePlayerInCar(state, x, y, angle, kind) {
  const car = makeCar(kind, x, y, angle, 'player');
  car.speed = 220;
  state.cars.push(car);
  state.player.inCar = car.id;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  return car;
}

/** Put the player in the mission's own sports car (the Hot Wheels job), moved to a good stretch. */
function putPlayerInSportsCar(state, x, y, angle) {
  const car = state.cars.find((c) => c.id === state.sportsCarId);
  if (!car) return null;
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = 220;
  car.driver = 'player';
  state.player.inCar = car.id;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  state.mission.stage = 'drive';
  return car;
}

function placePoliceChase(state, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const behind = 120 + i * 70;
    const lateral = (i - 1) * 46;
    const cop = makeCar('police', x - behind, y + lateral, 0, 'police');
    cop.speed = 260 + i * 12;
    state.cars.push(cop);
  }
}

/** Drive straight ahead for a fixed time so the scene is a real simulated frame. */
function driveForward(state, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const player = state.player;
    const car = state.cars.find((c) => c.id === player.inCar);
    if (!car) break;
    car.speed = Math.min(car.maxSpeed, car.speed + 300 * STEP);
    car.x += Math.cos(car.angle) * car.speed * STEP;
    car.y += Math.sin(car.angle) * car.speed * STEP;
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    // The chasing cops close in while the player drives.
    for (const cop of state.cars) {
      if (cop.driver !== 'police') continue;
      const targetAngle = Math.atan2(player.y - cop.y, player.x - cop.x);
      let diff = targetAngle - cop.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.angle += Math.max(-2.8 * STEP, Math.min(2.8 * STEP, diff));
      cop.x += Math.cos(cop.angle) * cop.speed * STEP;
      cop.y += Math.sin(cop.angle) * cop.speed * STEP;
    }
  }
}

function settle(state, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    state.time += STEP;
    for (const car of state.cars) {
      if (car.driver === 'traffic') {
        car.x += Math.cos(car.angle) * car.speed * STEP;
        car.y += Math.sin(car.angle) * car.speed * STEP;
      }
    }
  }
  state.camera = cameraFor(state.player.x, state.player.y);
}

/**
 * Stage the named scene into a fresh state and return the screen to draw over it.
 * Names: start (title over the city), chase (the cover), driving, mission, onfoot.
 */
export function stageShot(name, seed) {
  const state = seedScene(seed);
  if (name === 'start') {
    state.player.x = 900;
    state.player.y = 700;
    settle(state, 2);
    return { state, screen: SCREEN_TITLE };
  }
  if (name === 'driving') {
    setupMission(state, 1);
    state.player.money = 120;
    // The player is already in the job's orange sports car, driving it to the garage.
    // Start further north on the same road so the garage building lands mid-frame,
    // clear of the top-right wanted-stars pill (it used to sit right under it, its
    // GARAGE label showing through the pill behind the stars).
    putPlayerInSportsCar(state, 1140, 400, Math.PI / 2);
    driveForward(state, 1.0);
    settle(state, 0.4);
    return { state, screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    setupMission(state, 3);
    // On the pier, a few steps from the cash, the office hut right ahead.
    state.player.x = 2100;
    state.player.y = 1470;
    state.player.angle = Math.PI / 2;
    state.wanted = 2;
    state.player.money = 120;
    settle(state, 1);
    return { state, screen: SCREEN_PLAY };
  }
  if (name === 'onfoot') {
    setupMission(state, 0);
    state.player.x = 660;
    state.player.y = 470;
    state.player.angle = Math.PI / 2;
    state.player.money = 120;
    settle(state, 1);
    return { state, screen: SCREEN_PLAY };
  }
  // chase — the cover: Package Run, wanted 3, three cop cars on the player's tail.
  // The player drives the orange sports car, so it stands out from the yellow taxis.
  setupMission(state, 2);
  state.mission.timer = 74;
  state.wanted = 3;
  state.player.money = 120;
  placePlayerInCar(state, 900, 840, 0, 'sports');
  placePoliceChase(state, 900, 840, 3);
  driveForward(state, 1.4);
  settle(state, 0.4);
  return { state, screen: SCREEN_PLAY };
}
