// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between five screens: title, play, paused, busted and wasted.
//
// ?seed=N fixes the city. ?shot=start|chase|driving|mission|onfoot (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { CAR, MONEY, STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import { createCity, PLACES } from './world.js';
import { createInput, ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH } from './input.js';
import { createAudio } from './audio.js';
import { createParticles } from './particles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer, updatePlayer, tryEnterCar, exitCar, damagePlayer } from './player.js';
import { createPolice } from './police.js';
import { createCombat, addWanted } from './combat.js';
import { createMissions, currentMission, currentStep, missionTarget, stepMissions, interactMission, resetMission, setupStealCar, forceCompleteStep } from './missions.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';
import { readSave, writeSave } from './save.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;
const AUTOSAVE_SECONDS = 20;

export function createGame(seed) {
  const rand = createRandom(seed);
  const city = createCity(rand);
  const state = {
    rand, city,
    player: createPlayer(PLACES.cafe.x + 40, PLACES.cafe.y + 120),
    traffic: null, peds: null, police: null, combat: null, particles: null, missions: null,
    wanted: 0, cleanTimer: 0, clockMinutes: 600,
    message: '', messageTimer: 0, prompt: '',
    shotsFiredTimer: 0, enemyBullets: [], extraCars: [],
    screen: SCREEN_TITLE, hasSave: false, bustFine: 0,
    pendingBusted: false, pendingWasted: false,
    autosaveTimer: AUTOSAVE_SECONDS,
  };
  state.traffic = createTraffic(rand, city);
  state.peds = createPedestrians(rand, city);
  state.police = createPolice(rand);
  state.combat = createCombat();
  state.particles = createParticles();
  state.missions = createMissions();
  state.audio = null;

  state.reset = function reset() {
    const freshRand = createRandom(seed);
    state.city = createCity(freshRand);
    state.player = createPlayer(PLACES.cafe.x + 40, PLACES.cafe.y + 120);
    state.player.money = MONEY.start;
    state.traffic = createTraffic(freshRand, state.city);
    state.peds = createPedestrians(freshRand, state.city);
    state.police = createPolice(freshRand);
    state.combat = createCombat();
    state.particles = createParticles();
    state.missions = createMissions();
    state.wanted = 0;
    state.cleanTimer = 0;
    state.clockMinutes = 600;
    state.message = '';
    state.messageTimer = 0;
    state.prompt = '';
    state.shotsFiredTimer = 0;
    state.enemyBullets = [];
    state.extraCars = [];
    state.pendingBusted = false;
    state.pendingWasted = false;
    state.autosaveTimer = AUTOSAVE_SECONDS;
  };

  state.onMissionEvent = function onMissionEvent(type, text) {
    state.message = text;
    state.messageTimer = type === 'done' ? 5 : 4;
    if (type === 'done' || type === 'complete') {
      if (state.audio) state.audio.missionDone();
      state.particles.floatText(state.player.x, state.player.y - 40, text.split('(+$')[1] ? `+${text.split('(+$')[1]}` : '+$', '#ffd34d');
      writeSave(state);
    }
  };

  /** One fixed step of live play. `input` supplies move/mouse/click; `actions` (when given)
   *  is the one-shot flags already taken this frame — the loop takes them once, so the tick
   *  must not take them again. */
  state.tick = function tick(dt, input, actions) {
    const player = state.player;
    state.clockMinutes += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.shotsFiredTimer > 0) state.shotsFiredTimer -= dt;
    const acts = actions === undefined ? input.takeActions() : actions;
    if (acts & ACTION_MUTE && state.audio) {
      const muted = state.audio.toggleMute();
      state.message = muted ? 'Sound off (M to turn back on)' : 'Sound on';
      state.messageTimer = 2;
    }
    if (acts & ACTION_INTERACT) {
      if (player.inCar) {
        exitCar(player);
      } else if (!interactMission(state.missions, state, state.onMissionEvent)) {
        const car = tryEnterCar(player, state.traffic.cars, (stolenCar) => {
          addWanted(state, 1);
          state.message = 'Car stolen! The owner called it in.';
          state.messageTimer = 3;
          if (state.missions.index === 1 && state.missions.step === 0 && stolenCar === state.missions.stealCar) {
            forceCompleteStep(state.missions, state, state.onMissionEvent);
          }
        });
        if (car) state.message = '';
      }
    }
    if (acts & ACTION_PUNCH) {
      state.combat.punch(state, player, state.audio || { punch() {} }, state.particles);
    }
    if (input.takeClick() && player.hasPistol && !player.inCar && player.shootTimer <= 0) {
      const mouse = input.mouse();
      const worldX = mouse.x + state.cameraX - VIEW.width / 2;
      const worldY = mouse.y + state.cameraY - VIEW.height / 2;
      const angle = Math.atan2(worldY - player.y, worldX - player.x);
      player.angle = angle;
      player.shootTimer = 0.22;
      state.combat.shoot(state, player.x, player.y, angle);
      state.particles.muzzle(player.x + Math.cos(angle) * 26, player.y + Math.sin(angle) * 26, angle);
      if (state.audio) state.audio.shoot();
    }
    updatePlayer(player, input, dt, state, state.city, state.particles);
    // Traffic that hits the player on foot hurts.
    if (!player.inCar) {
      for (const car of state.traffic.cars) {
        if (car.dead || car.kind === 'parked' || Math.abs(car.speed) < 60) continue;
        const dx = car.x - player.x;
        const dy = car.y - player.y;
        if (dx * dx + dy * dy < 30 * 30) {
          if (damagePlayer(player, 12, state)) state.pendingWasted = true;
          player.x += dx * 0.4;
          player.y += dy * 0.4;
        }
      }
    }
    if (state.missions.index === 1 && !state.missions.stealCar) {
      setupStealCar(state.missions, state.traffic, state.rand);
    }
    state.traffic.step(dt, state);
    state.peds.step(dt, state);
    state.police.step(dt, state, state.city, state.particles, state.audio || { shoot() {} }, () => {
      state.pendingBusted = true;
    });
    state.combat.step(dt, state, state.city, state.particles, state.audio || { explosion() {} });
    stepMissions(dt, state.missions, state, state.onMissionEvent);
    state.particles.step(dt);
    // The player's own car, burning out.
    if (player.inCar && player.inCar.health <= 0) {
      state.combat.explodeCar(state, player.inCar, state.particles, state.audio || { explosion() {} });
    }
    if (player.health <= 0) state.pendingWasted = true;
    state.autosaveTimer -= dt;
    if (state.autosaveTimer <= 0) {
      state.autosaveTimer = AUTOSAVE_SECONDS;
      writeSave(state);
    }
    updatePrompt(state);
  };

  return state;
}

function updatePrompt(state) {
  const player = state.player;
  state.prompt = '';
  if (player.inCar) {
    state.prompt = 'E — Get out of the car';
    return;
  }
  const mission = currentMission(state.missions);
  const step = currentStep(state.missions);
  if (mission && step && step.action === 'talk') {
    const target = missionTarget(state.missions, state);
    if (target && Math.hypot(player.x - target.x, player.y - target.y) < target.radius + 40) {
      state.prompt = mission.id === 1 ? 'E — Talk to Marta' : mission.id === 3 && state.missions.step === 0 ? 'E — Pick up the package' : 'E — Grab the cash';
      return;
    }
  }
  let nearest = null;
  let nearestDist = 70;
  for (const car of state.traffic.cars) {
    if (car.dead || car.isPlayerCar) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = car;
    }
  }
  if (nearest) {
    const isTarget = state.missions.stealCar === nearest;
    state.prompt = isTarget ? 'E — Steal the orange sports car' : 'E — Steal the car';
  }
}

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createGame(seed);
window.__game = state;
const renderer = createRenderer(canvas);
const audio = createAudio();
state.audio = audio;

function runShot(name) {
  const scene = stageShot(name, state);
  // Snap the camera onto the player before the first paint: the smooth follow only moves
  // 8% a frame, so without this the staged scene would show the wrong streets.
  renderer.camera.x = state.player.x;
  renderer.camera.y = state.player.y;
  let painted = 0;
  function paint() {
    state.cameraX = renderer.camera.x;
    state.cameraY = renderer.camera.y;
    renderer.draw(state, state.city, scene.screen);
    state.cameraX = renderer.camera.x;
    state.cameraY = renderer.camera.y;
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  state.screen = screen;
  let accumulator = 0;
  let last = performance.now();
  const saved = readSave();
  state.hasSave = !!saved;

  function announce(message) {
    status.textContent = message;
  }

  function applySave(data) {
    state.reset();
    state.player.money = data.money;
    state.player.health = data.health || 100;
    state.player.hasPistol = !!data.hasPistol;
    state.player.x = data.x;
    state.player.y = data.y;
    state.missions.index = Math.min(data.missionIndex, 3);
    state.missions.step = data.missionStep || 0;
    state.clockMinutes = data.clockMinutes || 600;
    if (state.missions.index === 1) setupStealCar(state.missions, state.traffic, state.rand);
  }

  function startGame(fresh) {
    if (fresh) state.reset();
    else if (saved) applySave(saved);
    accumulator = 0;
    screen = SCREEN_PLAY;
    state.screen = screen;
    audio.unlock();
    announce('Playing Sunbay City. Follow the yellow marker.');
  }

  function doBusted() {
    state.pendingBusted = false;
    const fine = Math.min(state.player.money, MONEY.bustFine);
    state.bustFine = fine;
    state.player.money -= fine;
    state.wanted = 0;
    state.cleanTimer = 0;
    state.police.clear();
    if (state.player.inCar) {
      state.player.inCar.isPlayerCar = false;
      state.player.inCar = null;
    }
    state.player.x = PLACES.hospital.x;
    state.player.y = PLACES.hospital.y;
    state.player.health = Math.max(state.player.health, 60);
    audio.busted();
    writeSave(state);
    screen = SCREEN_BUSTED;
    state.screen = screen;
    announce(`Busted. Fine $${fine}.`);
  }

  function doWasted() {
    state.pendingWasted = false;
    state.player.money = Math.max(0, state.player.money - 100);
    state.wanted = 0;
    state.cleanTimer = 0;
    state.police.clear();
    if (state.player.inCar) {
      state.player.inCar.isPlayerCar = false;
      state.player.inCar = null;
    }
    state.player.x = PLACES.hospital.x;
    state.player.y = PLACES.hospital.y;
    state.player.health = 100;
    writeSave(state);
    screen = SCREEN_WASTED;
    state.screen = screen;
    announce('Wasted. You woke up at the Sunbay Clinic.');
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyC' && screen === SCREEN_TITLE && saved) startGame(false);
  });

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_BUSTED || screen === SCREEN_WASTED)) {
      startGame(screen === SCREEN_TITLE);
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      state.screen = screen;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      state.screen = screen;
      announce('Playing.');
    }
    // One-shot presses the screens did not use belong to this frame's play step.
    return actions & (ACTION_INTERACT | ACTION_PUNCH | ACTION_MUTE);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const frameActions = handleActions();
    if (screen === SCREEN_PLAY) {
      let firstStep = true;
      while (accumulator >= STEP) {
        state.cameraX = renderer.camera.x;
        state.cameraY = renderer.camera.y;
        // One-shot presses belong to the frame's first step only: handing them to every
        // catch-up step would press E twice (enter, then immediately leave the car).
        state.tick(STEP, input, firstStep ? frameActions : 0);
        firstStep = false;
        state.cameraX = renderer.camera.x;
        state.cameraY = renderer.camera.y;
        accumulator -= STEP;
        if (state.pendingBusted) {
          doBusted();
          break;
        }
        if (state.pendingWasted) {
          doWasted();
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    audio.update(!!state.player.inCar, state.player.inCar ? state.player.inCar.speed : 0, state.wanted, STEP);
    renderer.draw(state, state.city, screen);
    state.cameraX = renderer.camera.x;
    state.cameraY = renderer.camera.y;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      state.screen = screen;
      announce('Paused.');
    }
  });

  announce('Sunbay City. Press Enter to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
