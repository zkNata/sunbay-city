// The Sunbay PD: wanted heat that cools when the player lies low, cop cars that chase and ram
// (gently — ramming is capped so three cops can never melt the player), and foot cops who can
// bust a player on foot. Busted means a fine and a trip back to the bus stop.
import { CAR, PLAYER, POLICE, ROADS_H, ROADS_V, WANTED, WORLD } from './config.js';
import { clampToWorld, collideBuildings, distance, makeCar } from './world.js';
import { damagePlayer } from './player.js';

export function updateWanted(state, dt) {
  const player = state.player;
  if (state.wanted === 0) return;
  if (state.time - player.lastCrime > WANTED.coolDelay) {
    state.wantedTimer = (state.wantedTimer ?? 0) + dt;
    if (state.wantedTimer >= WANTED.coolInterval) {
      state.wantedTimer = 0;
      state.wanted = Math.max(0, state.wanted - 1);
    }
  } else {
    state.wantedTimer = 0;
  }
}

function spawnCopCar(state) {
  const player = state.player;
  const car = makeCar('police', 0, 0, 0, 'police');
  // Appear on a road a little way from the player, already facing roughly toward them.
  const vertical = state.rng.chance(0.5);
  const offset = state.rng.pick([-1, 1]) * state.rng.range(420, 650);
  if (vertical) {
    car.x = state.rng.pick(ROADS_V);
    car.y = Math.max(80, Math.min(WORLD.height - 80, player.y + offset));
    car.angle = car.y > player.y ? -Math.PI / 2 : Math.PI / 2;
  } else {
    car.y = state.rng.pick(ROADS_H);
    car.x = Math.max(80, Math.min(WORLD.width - 80, player.x + offset));
    car.angle = car.x > player.x ? Math.PI : 0;
  }
  car.speed = 200;
  state.cars.push(car);
  return car;
}

function spawnFootCop(state) {
  const player = state.player;
  const angle = state.rng.range(0, Math.PI * 2);
  const cop = {
    x: player.x + Math.cos(angle) * state.rng.range(260, 420),
    y: player.y + Math.sin(angle) * state.rng.range(260, 420),
    angle: 0, speed: 0, health: POLICE.footCopHealth,
  };
  clampToWorld(cop, 10);
  state.footCops.push(cop);
  return cop;
}

function copCars(state) {
  return state.cars.filter((car) => car.driver === 'police' && !car.exploded);
}

export function updatePolice(state, dt) {
  const player = state.player;
  const wanted = state.wanted;
  // How many units the heat calls for: cop cars first, foot cops join from 3 stars up.
  const wantCars = Math.min(wanted, 4);
  const wantFoot = player.inCar === null && wanted >= 3 ? Math.min(2, wanted - 2) : 0;
  while (copCars(state).length < wantCars) spawnCopCar(state);
  while (state.footCops.length < wantFoot) spawnFootCop(state);
  if (wanted === 0) {
    // The heat is off: standing units drive away and foot cops leave.
    for (const car of copCars(state)) {
      car.driver = 'traffic';
      car.road = null;
    }
    state.footCops.length = 0;
  }

  // Cop cars chase the player (or their car) and ram, with a per-cop cooldown on damage.
  for (const car of copCars(state)) {
    if (car.ramCooldown > 0) car.ramCooldown -= dt;
    const targetAngle = Math.atan2(player.y - car.y, player.x - car.x);
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
    car.angle += turn;
    const targetSpeed = Math.min(CAR.maxSpeed * 0.92, distance(car, player) * 0.9 + 180);
    if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + CAR.accel * 0.8 * dt);
    else car.speed = Math.max(120, car.speed - CAR.brake * 0.5 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    clampToWorld(car, CAR.length / 2);
    collideBuildings(state, car, CAR.length / 2 - 4);
    if (car.smoke > 0) car.smoke -= dt;
    // Ramming: a gentle shove and a little damage, at most once a second per cop.
    if (distance(car, player) < CAR.length / 2 + 14 && car.ramCooldown <= 0) {
      car.ramCooldown = POLICE.ramCooldown;
      if (damagePlayer(state, POLICE.ramDamage)) {
        state.particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, size: 14, color: '#e5534b', kind: 'flash' });
      }
    }
  }

  // Foot cops run the player down on foot; staying in reach fills the bust meter.
  let touched = false;
  for (const cop of state.footCops) {
    const d = distance(cop, player);
    if (player.inCar === null && !player.dead) {
      const angle = Math.atan2(player.y - cop.y, player.x - cop.x);
      cop.angle = angle;
      const speed = d > 40 ? 235 : 200;
      cop.x += Math.cos(angle) * speed * dt;
      cop.y += Math.sin(angle) * speed * dt;
      clampToWorld(cop, 10);
      collideBuildings(state, cop, 10);
      if (d < 30) touched = true;
    }
  }
  if (touched) {
    player.bustMeter += dt;
    if (player.bustMeter >= POLICE.bustSeconds) {
      player.bustMeter = 0;
      player.money = Math.max(0, player.money - 50);
      state.stats.busted += 1;
      state.busted = true;
    }
  } else {
    player.bustMeter = Math.max(0, player.bustMeter - dt * 2);
  }
}
