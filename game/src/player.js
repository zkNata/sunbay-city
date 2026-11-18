// The player on foot and behind the wheel. Movement, entering and leaving cars, punching and
// shooting, health and regeneration. The loop hands it the frame's input once; this module
// never calls takeActions itself.
import { CAR, PLAYER, WORLD } from './config.js';
import { clampToWorld, collideBuildings, distance, LANDMARKS } from './world.js';

export function carById(state, id) {
  return state.cars.find((car) => car.id === id) ?? null;
}

/** The nearest car the player can get into (police cars stay locked). */
export function nearestEnterableCar(state) {
  let best = null;
  let bestDist = 52;
  for (const car of state.cars) {
    if (car.kind === 'police' || car.driver === 'player' || car.exploded) continue;
    const d = distance(state.player, car);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

function stealCar(state, car) {
  const player = state.player;
  const wasTraffic = car.driver === 'traffic';
  player.inCar = car.id;
  car.driver = 'player';
  car.speed = 0;
  // Taking a car that is not yours is the crime: the heat goes up once per car.
  if (!car.stolen) {
    car.stolen = true;
    state.stats.stolen += 1;
    raiseWanted(state, 1);
  }
  if (wasTraffic) {
    // Its driver bails and runs.
    const rng = state.rng;
    state.peds.push({
      x: car.x + rng.range(-30, 30), y: car.y + rng.range(-30, 30),
      tx: car.x + rng.range(-300, 300), ty: car.y + rng.range(-300, 300),
      speed: 240, color: '#e5534b', flee: 3, wait: 0,
    });
  }
}

export function raiseWanted(state, amount) {
  const player = state.player;
  if (state.wanted >= 5) return;
  state.wanted = Math.min(5, state.wanted + amount);
  player.lastCrime = state.time;
}

export function damagePlayer(state, amount) {
  const player = state.player;
  if (player.invulnerable > 0 || player.dead) return false;
  player.health -= amount;
  player.lastDamage = state.time;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    state.stats.wasted += 1;
  }
  return true;
}

function stepOnFoot(state, input, dt) {
  const player = state.player;
  const dir = input.direction();
  const speed = input.run() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (dir.x !== 0 || dir.y !== 0) {
    player.x += dir.x * speed * dt;
    player.y += dir.y * speed * dt;
    player.angle = Math.atan2(dir.y, dir.x);
    player.speed = speed;
  } else {
    player.speed = 0;
  }
  clampToWorld(player, PLAYER.radius);
  collideBuildings(state, player, PLAYER.radius);
}

function stepDriving(state, input, dt) {
  const player = state.player;
  const car = carById(state, player.inCar);
  if (car === null) {
    player.inCar = null;
    return;
  }
  const throttle = input.throttle();
  const steer = input.steer();
  if (throttle > 0) car.speed = Math.min(car.maxSpeed, car.speed + CAR.accel * dt);
  else if (throttle < 0) car.speed = Math.max(-CAR.reverseSpeed, car.speed - CAR.brake * dt);
  else {
    const drag = CAR.accel * 0.6 * dt;
    car.speed = Math.abs(car.speed) <= drag ? 0 : car.speed - Math.sign(car.speed) * drag;
  }
  if (car.speed !== 0) {
    const turn = steer * CAR.turnRate * dt * Math.min(1, Math.abs(car.speed) / 120) * Math.sign(car.speed);
    car.angle += turn;
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  clampToWorld(car, CAR.length / 2);
  collideBuildings(state, car, CAR.length / 2 - 4);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = Math.abs(car.speed);
}

export function updatePlayer(state, input, actions, dt, missionInteract) {
  const player = state.player;
  if (player.dead) return;
  if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (player.health < PLAYER.health && state.time - player.lastDamage > PLAYER.regenDelay) {
    player.health = Math.min(PLAYER.health, player.health + PLAYER.regen * dt);
  }

  if (player.inCar !== null) stepDriving(state, input, dt);
  else stepOnFoot(state, input, dt);

  if (actions.interact) {
    if (missionInteract) {
      // The mission takes the press: talking to Marta or grabbing the cash, not a car.
    } else if (player.inCar !== null) {
      // Get out: step aside from the car, on foot.
      const car = carById(state, player.inCar);
      player.inCar = null;
      if (car) {
        car.driver = null;
        car.speed = 0;
        player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
        player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
        clampToWorld(player, PLAYER.radius);
        collideBuildings(state, player, PLAYER.radius);
      }
    } else {
      const car = nearestEnterableCar(state);
      if (car) stealCar(state, car);
    }
  }
  if (actions.punch && player.inCar === null && player.punchCooldown <= 0) {
    player.punchCooldown = PLAYER.punchCooldown;
    state.stats.punches += 1;
    state.punch = { x: player.x, y: player.y, angle: player.angle, time: 0.18 };
  }
}

export function respawnPlayer(state) {
  const player = state.player;
  player.x = LANDMARKS.spawn.x;
  player.y = LANDMARKS.spawn.y;
  player.angle = -Math.PI / 2;
  player.health = PLAYER.health;
  player.inCar = null;
  player.dead = false;
  player.invulnerable = 2;
  player.bustMeter = 0;
  state.wanted = 0;
  for (const car of state.cars) {
    if (car.driver === 'police') car.driver = 'police';
  }
  state.footCops.length = 0;
}
