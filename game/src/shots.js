// The screenshot scenes behind ?shot=start|chase|driving|mission|onfoot (with &seed=N).
// Each one builds a fresh game from the seed, stages the real rules into the named moment —
// a police chase, a drive through traffic, a mission on foot — steps the world forward a
// fixed number of ticks so it is what real play looks like, and returns the screen to draw.
import { STEP } from './config.js';
import { PLACES } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { setupStealCar } from './missions.js';

function settle(state, seconds, input) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) state.tick(STEP, input || { move: () => ({ x: 0, y: 0, run: false }), mouse: () => ({ x: 0, y: 0, down: false }), takeClick: () => false, takeActions: () => 0 });
}

function putPlayerInCar(state, x, y, angle, speed) {
  const car = state.traffic.cars.find((c) => c.kind === 'parked' && !c.dead);
  const use = car || state.traffic.spawnTrafficCar();
  use.kind = 'player';
  use.isPlayerCar = true;
  use.x = x;
  use.y = y;
  use.angle = angle;
  use.speed = speed;
  use.color = '#ff8a3d';
  state.player.inCar = use;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  state.player.speed = speed;
  if (car) return use;
  state.traffic.cars.push(use);
  return use;
}

function addPoliceChase(state, count) {
  state.wanted = 3;
  state.cleanTimer = 0;
  for (let i = 0; i < count; i += 1) {
    const behind = state.player.angle + Math.PI + (i - 1) * 0.35;
    const car = state.police.spawnCarNear(state.player, state);
    car.x = state.player.x + Math.cos(behind) * (180 + i * 60);
    car.y = state.player.y + Math.sin(behind) * (180 + i * 60);
    car.angle = state.player.angle;
    car.speed = 420;
  }
}

/**
 * Set `state` to the named scene (start, chase, driving, mission or onfoot; any other name
 * is start) and return the screen to draw over it.
 */
export function stageShot(name, state) {
  state.reset();
  if (name !== 'chase' && name !== 'driving' && name !== 'mission' && name !== 'onfoot') {
    settle(state, 2, null);
    return { screen: SCREEN_TITLE };
  }
  const player = state.player;
  if (name === 'onfoot') {
    player.x = PLACES.cafe.x + 40;
    player.y = PLACES.cafe.y + 90;
    player.angle = -Math.PI / 2;
    state.missions.index = 0;
    state.missions.step = 0;
    state.message = "Go to Marta's Cafe";
    state.messageTimer = 3;
    settle(state, 1.5, null);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'driving') {
    state.missions.index = 1;
    state.missions.step = 0;
    setupStealCar(state.missions, state.traffic, state.rand);
    // Staged one block east and 16 px south of the first pass: with the camera snapped
    // to the player, the traffic car on road x=2200 was kissing the right frame edge and
    // a car on road y=1400 was sliced by the bottom edge; this puts both fully inside
    // the frame while the player stays centred.
    putPlayerInCar(state, 1160, 1034, 0, 300);
    state.message = 'Steal the orange sports car';
    state.messageTimer = 3;
    // Settle 1.4 s (was 1.2 s): the extra 0.2 s lets the southbound car on road x=1800
    // clear the bottom edge entirely instead of being sliced by it; the player ends
    // further east but the camera follows, so framing stays centred.
    settle(state, 1.4, { move: () => ({ x: 0, y: -1, run: false }), mouse: () => ({ x: 0, y: 0, down: false }), takeClick: () => false, takeActions: () => 0 });
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    state.missions.index = 2;
    state.missions.step = 1;
    state.missions.hasPackage = true;
    state.missions.timer = 74;
    putPlayerInCar(state, 1400, 1418, 0, 380);
    addPoliceChase(state, 3);
    state.message = 'Deliver the package to Palma Beach Bar';
    state.messageTimer = 3;
    settle(state, 1.0, { move: () => ({ x: 0, y: -1, run: false }), mouse: () => ({ x: 0, y: 0, down: false }), takeClick: () => false, takeActions: () => 0 });
    return { screen: SCREEN_PLAY };
  }
  // mission: on foot at the marina, the final job, two stars and a cop closing in.
  state.missions.index = 3;
  state.missions.step = 0;
  player.x = PLACES.marina.x - 60;
  player.y = PLACES.marina.y - 40;
  player.angle = Math.PI / 4;
  player.hasPistol = true;
  state.wanted = 2;
  state.cleanTimer = 0;
  state.police.spawnFootNear(player);
  state.message = 'Grab the cash at the Marina Office';
  state.messageTimer = 3;
  settle(state, 1.2, null);
  return { screen: SCREEN_PLAY };
}
