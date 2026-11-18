// Boot and the one loop: input is read exactly once per frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. Screens: title, play, paused, busted,
// wasted, story. ?seed=N fixes the run; ?shot=chase|driving|mission|onfoot|start (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets window.__shotReady.
import { CLOCK_SECONDS_PER_MINUTE, STEP } from './config.js';
import { createWorld } from './world.js';
import { createAudio } from './audio.js';
import { spawnPeds } from './pedestrians.js';
import { spawnTraffic } from './traffic.js';
import { updatePlayer, respawnPlayer, carById } from './player.js';
import { updatePolice } from './police.js';
import { updateCombat, shootAt } from './combat.js';
import { updateMissions, nearMissionInteract, setupMission } from './missions.js';
import { updateParticles } from './particles.js';
import { updatePeds } from './pedestrians.js';
import { updateTraffic } from './traffic.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_SHOOT, createInput } from './input.js';
import { createRenderer, cameraFor, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_STORY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';
import { clearSave, readSave, writeSave } from './save.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const { state, screen } = stageShot(name, seed);
  const renderer = createRenderer(canvas);
  let painted = 0;
  function paint() {
    renderer.draw(state, screen, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
  window.__game = { state, screen };
}

function runGame() {
  const state = createWorld(seed);
  const input = createInput(canvas);
  const renderer = createRenderer(canvas);
  const saved = readSave();
  let screen = SCREEN_TITLE;
  let clockAccumulator = 0;

  spawnTraffic(state, 14);
  spawnPeds(state, 24);

  function applySave(data) {
    state.player.money = data.money;
    state.player.health = data.health;
    state.player.x = data.x;
    state.player.y = data.y;
    state.player.pistol = data.pistol;
    state.clockMinutes = data.clockMinutes;
    if (data.missionIndex === 1) {
      // The sports car waits again for a returning player who still needs it.
      setupMission(state, 1);
    } else if (data.missionIndex < 4) {
      setupMission(state, data.missionIndex);
    } else {
      state.mission.index = 4;
    }
  }

  function startNewGame() {
    clearSave();
    state.mission.index = 0;
    state.mission.stage = 'go';
    state.player.money = 120;
    state.player.health = 100;
    state.player.pistol = false;
    state.player.x = 360;
    state.player.y = 840;
    state.player.inCar = null;
    state.wanted = 0;
    state.clockMinutes = 600;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startMusic();
    announce('Playing. Meet Marta at her cafe.');
  }

  function continueGame() {
    if (saved) applySave(saved);
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startMusic();
    announce('Playing. Welcome back to Sunbay.');
  }

  function step(dt, actions) {
    state.time += dt;
    clockAccumulator += dt;
    if (clockAccumulator >= CLOCK_SECONDS_PER_MINUTE) {
      clockAccumulator -= CLOCK_SECONDS_PER_MINUTE;
      state.clockMinutes += 1;
    }
    updatePlayer(state, input, actions, dt, nearMissionInteract(state));
    if (actions.punch) audio.thud();
    if (actions.shoot) {
      const mouse = input.mouse();
      const worldX = state.camera.x + mouse.x;
      const worldY = state.camera.y + mouse.y;
      shootAt(state, worldX, worldY);
      audio.shot();
    }
    updateTraffic(state, dt);
    updatePeds(state, dt);
    updatePolice(state, dt);
    updateCombat(state, dt);
    updateMissions(state, dt, Boolean(actions.interact));
    updateParticles(state, dt);
    // Sirens while the heat is on; the engine hums while driving.
    if (state.wanted > 0) audio.startSiren();
    else audio.stopSiren();
    if (state.player.inCar !== null) {
      const car = carById(state, state.player.inCar);
      audio.engine(car ? Math.abs(car.speed) / car.maxSpeed : 0);
    } else {
      audio.stopEngine();
    }
    // Camera follows the player, clamped exactly to the world.
    state.camera = cameraFor(state.player.x, state.player.y);
    // Busted or wasted: show the screen, fine the player, send them back to the bus stop.
    if (state.busted) {
      state.busted = false;
      screen = SCREEN_BUSTED;
      audio.stopSiren();
    } else if (state.player.dead) {
      state.player.money = Math.max(0, state.player.money - 100);
      screen = SCREEN_WASTED;
      audio.stopSiren();
    } else if (state.mission.index >= 4 && screen === SCREEN_PLAY && state.mission.toastTime <= 0) {
      screen = SCREEN_STORY;
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    // One read per frame, here and nowhere else. One-shot gameplay presses (E, F, click)
    // wait in stepHeld until a simulation step consumes them: a frame that runs no step
    // (a fast frame) must never swallow a press.
    const bits = input.takeActions();
    const confirm = bits & ACTION_CONFIRM;
    const pause = bits & ACTION_PAUSE;
    const mute = bits & ACTION_MUTE;
    stepHeld |= bits & (ACTION_INTERACT | ACTION_PUNCH | ACTION_SHOOT);

    if (mute) {
      audio.setMuted(!audio.isMuted());
      state.muted = audio.isMuted();
    }
    if (screen === SCREEN_TITLE) {
      if (confirm) {
        if (saved) continueGame();
        else startNewGame();
      }
    } else if (screen === SCREEN_PAUSED) {
      if (pause || confirm) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (confirm) {
        respawnPlayer(state);
        writeSave(state);
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_STORY) {
      if (confirm) screen = SCREEN_PLAY;
    } else if (screen === SCREEN_PLAY) {
      if (pause) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    }

    if (screen === SCREEN_PLAY) {
      const dt = Math.min((now - last) / 1000, MAX_FRAME);
      last = now;
      accumulator += dt;
      while (accumulator >= STEP) {
        const actions = {
          interact: stepHeld & ACTION_INTERACT,
          punch: stepHeld & ACTION_PUNCH,
          shoot: stepHeld & ACTION_SHOOT,
        };
        stepHeld = 0;
        step(STEP, actions);
        accumulator -= STEP;
      }
    } else {
      last = now;
      accumulator = 0;
      stepHeld = 0;
    }
    renderer.draw(state, screen, saved !== null);
  }

  let last = performance.now();
  let accumulator = 0;
  let stepHeld = 0;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Sunbay City. Press Enter or click to start.');
  window.__game = { state, get screen() { return screen; } };
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
