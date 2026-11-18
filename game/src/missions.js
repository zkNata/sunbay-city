// The story: four missions in order, told by Marta, the cafe owner who runs Sunbay's
// quiet side. Each mission has one objective at a time — a place to reach, a car to steal,
// a package to deliver, a job to pull — with a marker in the world, a blip on the minimap
// and a line in the HUD. Finishing one pays cash, saves the game and unlocks the next.
import { PLACES } from './world.js';
import { addWanted } from './combat.js';

export const MISSIONS = [
  {
    id: 1,
    name: 'Welcome to Sunbay',
    brief: "Marta needs a word. Go to the cafe on Coral Avenue.",
    steps: [
      { text: "Go to Marta's Cafe", target: PLACES.cafe, radius: 70, action: 'talk' },
    ],
    reward: 150,
    done: 'Marta: "Rook. You look hungry. I have work — and a pistol, if you need it."',
  },
  {
    id: 2,
    name: 'Hot Wheels',
    brief: 'Steal the orange sports car by the marina road and bring it to the garage.',
    steps: [
      { text: 'Steal the orange sports car', target: null, radius: 60, action: 'steal' },
      { text: 'Deliver the car to Sunbay Garage', target: PLACES.garage, radius: 90, action: 'deliver' },
    ],
    reward: 400,
    done: 'Marta: "Clean work. The garage pays well for a car nobody misses."',
  },
  {
    id: 3,
    name: 'Package Run',
    brief: 'Pick up the package at the Old Dock. The beach bar pays on delivery — fast.',
    steps: [
      { text: 'Pick up the package at the Old Dock', target: PLACES.dock, radius: 70, action: 'talk' },
      { text: 'Deliver the package to Palma Beach Bar', target: PLACES.beachBar, radius: 80, action: 'deliver', timer: 90 },
    ],
    reward: 600,
    done: 'Marta: "Ninety seconds and not a scratch. The bar owes you a drink."',
  },
  {
    id: 4,
    name: 'The Marina Job',
    brief: 'Lift the cash from the Marina Office, then lose the cops and reach the safehouse.',
    steps: [
      { text: 'Grab the cash at the Marina Office', target: PLACES.marina, radius: 70, action: 'talk' },
      { text: 'Escape the police and reach the Safehouse', target: PLACES.safehouse, radius: 90, action: 'deliver' },
    ],
    reward: 1000,
    done: 'Marta: "That was the whole marina payroll. Sunbay is yours now, Rook."',
  },
];

export function createMissions() {
  return {
    index: 0,
    step: 0,
    timer: 0,
    active: true,
    completed: false,
    stealCar: null,
    hasPackage: false,
  };
}

export function currentMission(missions) {
  if (missions.index >= MISSIONS.length) return null;
  return MISSIONS[missions.index];
}

export function currentStep(missions) {
  const mission = currentMission(missions);
  if (!mission) return null;
  return mission.steps[missions.step];
}

export function missionTarget(missions, state) {
  const step = currentStep(missions);
  if (!step) return null;
  if (step.action === 'steal' && missions.stealCar) {
    return { x: missions.stealCar.x, y: missions.stealCar.y, radius: step.radius };
  }
  if (!step.target) return null;
  return { x: step.target.x, y: step.target.y, radius: step.radius };
}

export function missionObjectiveText(missions) {
  const mission = currentMission(missions);
  const step = currentStep(missions);
  if (!mission || !step) return 'Free roam — Sunbay is yours.';
  return `${mission.name}: ${step.text}`;
}

/** Advance the mission state one fixed step. Returns 'done' when a mission completes. */
export function stepMissions(dt, missions, state, onEvent) {
  if (!missions.active || missions.completed) return null;
  const mission = currentMission(missions);
  const step = currentStep(missions);
  if (!mission || !step) return null;
  if (step.timer && missions.timer > 0) {
    missions.timer -= dt;
    if (missions.timer <= 0) {
      missions.timer = 0;
      onEvent('fail', 'Too slow — the buyer walked. Talk to Marta to try again.');
      resetMission(missions, state);
      return 'fail';
    }
  }
  const target = missionTarget(missions, state);
  if (!target) return null;
  const player = state.player;
  const d = Math.hypot(player.x - target.x, player.y - target.y);
  if (step.action === 'deliver' && d < target.radius) {
    if (step.action === 'deliver' && missions.step > 0 && mission.id === 2 && player.inCar !== missions.stealCar) return null;
    return completeStep(missions, state, onEvent);
  }
  return null;
}

/** The player pressed E near the objective (or in the target car): try to finish this step. */
export function interactMission(missions, state, onEvent) {
  if (!missions.active || missions.completed) return false;
  const mission = currentMission(missions);
  const step = currentStep(missions);
  if (!mission || !step) return false;
  const target = missionTarget(missions, state);
  if (!target) return false;
  const player = state.player;
  const d = Math.hypot(player.x - target.x, player.y - target.y);
  if (step.action === 'talk' && d < target.radius + 30) {
    return completeStep(missions, state, onEvent) === 'done';
  }
  if (step.action === 'steal' && player.inCar === missions.stealCar) {
    return completeStep(missions, state, onEvent) === 'done';
  }
  return false;
}

/** Complete the current step from outside the mission module (e.g. stealing the target car). */
export function forceCompleteStep(missions, state, onEvent) {
  return completeStep(missions, state, onEvent);
}

function completeStep(missions, state, onEvent) {
  const mission = currentMission(missions);
  const step = currentStep(missions);
  missions.step += 1;
  if (mission.id === 1 && missions.step === 1) {
    state.player.hasPistol = true;
  }
  if (mission.id === 3 && missions.step === 1) {
    missions.hasPackage = true;
    missions.timer = 90;
    addWanted(state, 2);
    onEvent('info', 'Package in hand. Two stars — the cops heard about the run.');
  }
  if (mission.id === 4 && missions.step === 1) {
    state.player.money += 1200;
    addWanted(state, 3);
    onEvent('info', 'Cash grabbed: +$1,200. Three stars — run for the safehouse!');
  }
  if (missions.step >= mission.steps.length) {
    state.player.money += mission.reward;
    missions.index += 1;
    missions.step = 0;
    missions.timer = 0;
    missions.hasPackage = false;
    const finishedAll = missions.index >= MISSIONS.length;
    if (finishedAll) {
      missions.completed = true;
      missions.active = false;
    }
    // The progress is updated before the event fires: the event saves the game, and the
    // save must hold the new mission, not the one just finished.
    onEvent('done', `${mission.done} (+$${mission.reward})`);
    if (finishedAll) {
      onEvent('complete', 'Story complete — Sunbay City is yours. Free roam!');
    }
    return 'done';
  }
  const next = currentStep(missions);
  if (next) onEvent('info', next.text);
  return 'step';
}

export function resetMission(missions, state) {
  missions.step = 0;
  missions.timer = 0;
  missions.hasPackage = false;
  if (state.wanted > 0) {
    state.wanted = 0;
    state.cleanTimer = 0;
    state.police.clear();
  }
}

/** Place the mission-2 target car: the orange sports car by the marina road. */
export function setupStealCar(missions, traffic, rand) {
  if (missions.index !== 1 || missions.stealCar) return;
  const car = traffic.spawnParkedCar();
  car.color = '#ff8a3d';
  car.x = 2700;
  car.y = 2130;
  car.angle = 0;
  car.kind = 'parked';
  traffic.cars.push(car);
  missions.stealCar = car;
}
