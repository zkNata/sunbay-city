// The story: four missions in order, each with a title, an objective, a target on the map and
// a payout. Completing a mission writes the save AFTER the mission index moves, never before.
import { MISSIONS } from './config.js';
import { distance, LANDMARKS, makeCar } from './world.js';
import { carById } from './player.js';
import { writeSave } from './save.js';

export const MISSION_NAMES = ['Welcome to Sunbay', 'Hot Wheels', 'Package Run', 'The Marina Job'];

function toast(state, text) {
  state.mission.toast = text;
  state.mission.toastTime = 3;
}

export function setupMission(state, index) {
  const mission = state.mission;
  mission.index = index;
  mission.stage = 'go';
  mission.timer = 0;
  if (index === 1) {
    // The orange sports car waits on the 1140 road, engine running, owner nowhere to be seen.
    const car = makeCar('sports', 1140, 1000, Math.PI / 2, null);
    state.cars.push(car);
    state.sportsCarId = car.id;
  }
  if (index === 2) {
    mission.timer = MISSIONS.packageTime;
    state.wanted = Math.max(state.wanted, 2);
  }
  if (index === 3) {
    mission.stage = 'grab';
  }
}

export function currentObjective(state) {
  const mission = state.mission;
  const player = state.player;
  if (mission.index >= 4) {
    return { title: 'Sunbay City', text: 'Free roam — the city is yours', target: null, timer: 0 };
  }
  if (mission.index === 0) {
    return { title: 'Welcome to Sunbay', text: "Go to Marta's Cafe", target: LANDMARKS.cafe, timer: 0 };
  }
  if (mission.index === 1) {
    const car = carById(state, state.sportsCarId);
    if (mission.stage === 'go' && car) {
      return { title: 'Hot Wheels', text: 'Steal the orange sports car', target: { x: car.x, y: car.y }, timer: 0 };
    }
    return { title: 'Hot Wheels', text: 'Take the sports car to Sunbay Garage', target: LANDMARKS.garage, timer: 0 };
  }
  if (mission.index === 2) {
    return { title: 'Package Run', text: 'Deliver the package to Palma Beach Bar', target: LANDMARKS.bar, timer: mission.timer };
  }
  if (mission.stage === 'grab') {
    return { title: 'The Marina Job', text: 'Grab the cash at the Marina Office', target: LANDMARKS.marina, timer: 0 };
  }
  return { title: 'The Marina Job', text: 'Escape to Sunbay Garage', target: LANDMARKS.garage, timer: 0 };
}

/** Distance in metres from the player to the current objective (10 px to a metre). */
export function objectiveDistance(state) {
  const objective = currentObjective(state);
  if (!objective.target) return 0;
  return Math.round(distance(state.player, objective.target) / 10);
}

function completeMission(state) {
  const mission = state.mission;
  const reward = MISSIONS.reward[mission.index];
  state.player.money += reward;
  toast(state, `Mission complete — +$${reward}`);
  mission.index += 1;
  writeSave(state);
  if (mission.index < 4) setupMission(state, mission.index);
  else toast(state, 'Story complete — Sunbay City is yours');
}

/** True when the player stands at a mission talk/grab point: E belongs to the mission there,
 * never to a passing car. */
export function nearMissionInteract(state) {
  const player = state.player;
  const mission = state.mission;
  if (mission.index === 0) return distance(player, LANDMARKS.cafe) < 64;
  if (mission.index === 3 && mission.stage === 'grab') return distance(player, LANDMARKS.marina) < 64;
  return false;
}

/** Advance the story one step. `interact` is true on the frame the player pressed E. */
export function updateMissions(state, dt, interact) {
  const mission = state.mission;
  const player = state.player;
  if (mission.toastTime > 0) mission.toastTime -= dt;
  if (mission.index >= 4 || player.dead) return;

  if (mission.index === 0) {
    if (interact && distance(player, LANDMARKS.cafe) < 64) {
      player.pistol = true;
      toast(state, "Marta: take this. You're going to need it.");
      completeMission(state);
    }
    return;
  }
  if (mission.index === 1) {
    if (mission.stage === 'go' && player.inCar === state.sportsCarId) mission.stage = 'drive';
    if (mission.stage === 'drive' && player.inCar === state.sportsCarId && distance(player, LANDMARKS.garage) < 95) {
      completeMission(state);
    }
    return;
  }
  if (mission.index === 2) {
    mission.timer -= dt;
    if (mission.timer <= 0) {
      mission.timer = MISSIONS.packageTime;
      toast(state, 'Too slow — the package run restarts');
      return;
    }
    if (distance(player, LANDMARKS.bar) < 70) completeMission(state);
    return;
  }
  if (mission.index === 3) {
    if (mission.stage === 'grab') {
      if (interact && distance(player, LANDMARKS.marina) < 64) {
        mission.stage = 'escape';
        state.wanted = Math.max(state.wanted, 3);
        toast(state, 'Cash grabbed — lose the cops!');
      }
      return;
    }
    if (distance(player, LANDMARKS.garage) < 95) completeMission(state);
  }
}
