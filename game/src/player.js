// The player: on foot (walk, run, punch, shoot, talk, steal a car) and behind the wheel
// (arcade car physics: accelerate, brake, reverse, steer harder at low speed). The player
// object is the one the camera, the HUD, the police and the missions all read.
import { CAR, PLAYER, WORLD } from './config.js';
import { resolveCircle, rectHitsBuilding } from './world.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, radius: PLAYER.radius,
    health: PLAYER.health, money: 120, hasPistol: false,
    inCar: null, speed: 0, walkAngle: -Math.PI / 2,
    punchTimer: 0, shootTimer: 0, invulnerable: 0,
    skidTimer: 0, exhaustTimer: 0,
  };
}

function nearestCar(player, cars, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of cars) {
    if (car.dead || car.isPlayerCar) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

/** Drive one fixed step. Returns true when the car hit a building hard. */
function driveStep(player, car, move, dt, city, particles) {
  const forward = move.y < 0 ? 1 : move.y > 0 ? -1 : 0;
  const steer = move.x;
  if (forward > 0) {
    car.speed += CAR.accel * dt;
  } else if (forward < 0) {
    car.speed -= (car.speed > 5 ? CAR.brake : CAR.reverseAccel) * dt;
  } else {
    car.speed -= car.speed * 1.2 * dt;
  }
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 120 + 0.25);
  car.angle += steer * CAR.turnRate * steerAuthority * dt * (car.speed >= 0 ? 1 : -1) * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const halfL = CAR.length / 2;
  const halfW = CAR.width / 2;
  const hit = rectHitsBuilding(nx - halfL, ny - halfW, CAR.length, CAR.width, city);
  const speedBefore = car.speed;
  if (hit) {
    car.speed *= -0.25;
    car.health -= Math.min(24, Math.abs(speedBefore) * 0.05);
    if (Math.abs(speedBefore) > 200) {
      particles.sparks(car.x + Math.cos(car.angle) * halfL, car.y + Math.sin(car.angle) * halfL);
    }
    return true;
  }
  car.x = Math.max(halfL, Math.min(WORLD.width - halfL, nx));
  car.y = Math.max(halfW, Math.min(WORLD.height - halfW, ny));
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = car.speed;
  if (Math.abs(car.speed) > 300 && Math.abs(steer) > 0.4) {
    player.skidTimer -= dt;
    if (player.skidTimer <= 0) {
      player.skidTimer = 0.09;
      particles.smoke(car.x - Math.cos(car.angle) * halfL, car.y - Math.sin(car.angle) * halfL, 1);
    }
  }
  player.exhaustTimer -= dt;
  if (player.exhaustTimer <= 0 && Math.abs(car.speed) > 40) {
    player.exhaustTimer = 0.12;
    particles.exhaust(car.x, car.y, car.angle);
  }
  return false;
}

/** Walk one fixed step. Returns nothing; the position is resolved against buildings. */
function walkStep(player, move, dt, city) {
  const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const dx = move.x;
  const dy = move.y;
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    player.walkAngle = Math.atan2(dy, dx);
    player.angle = player.walkAngle;
    const nx = player.x + (dx / len) * speed * dt;
    const ny = player.y + (dy / len) * speed * dt;
    const pos = resolveCircle(nx, ny, player.radius, city);
    player.x = pos.x;
    player.y = pos.y;
  }
  player.speed = len > 0 ? speed : 0;
}

export function updatePlayer(player, input, dt, state, city, particles) {
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootTimer > 0) player.shootTimer -= dt;
  if (player.invulnerable > 0) player.invulnerable -= dt;
  const move = input.move();
  if (player.inCar) {
    driveStep(player, player.inCar, move, dt, city, particles);
  } else {
    walkStep(player, move, dt, city);
  }
  return { move };
}

export function tryEnterCar(player, cars, onSteal) {
  const car = nearestCar(player, cars, 70);
  if (!car) return null;
  const wasParkedOrTraffic = car.kind === 'parked' || car.kind === 'traffic';
  car.isPlayerCar = true;
  car.kind = 'player';
  player.inCar = car;
  player.speed = 0;
  if (wasParkedOrTraffic && onSteal) onSteal(car);
  return car;
}

export function exitCar(player) {
  if (!player.inCar) return;
  const car = player.inCar;
  car.isPlayerCar = false;
  car.speed = 0;
  player.inCar = null;
  player.x = car.x - Math.cos(car.angle) * 0 - Math.sin(car.angle) * 34;
  player.y = car.y + Math.cos(car.angle) * 34;
  player.speed = 0;
}

export function damagePlayer(player, amount, state) {
  if (player.invulnerable > 0 || state.screen === 'busted' || state.screen === 'wasted') return false;
  player.health -= amount;
  player.invulnerable = 0.35;
  return player.health <= 0;
}

export function drawPlayer(context, player) {
  if (player.inCar) return;
  const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0;
  if (blink) return;
  context.save();
  context.translate(player.x, player.y);
  context.rotate(player.angle);
  context.fillStyle = 'rgba(0,0,0,0.3)';
  context.beginPath();
  context.ellipse(0, 3, 12, 9, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#ff5a3c';
  context.beginPath();
  context.arc(0, 0, 11, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#ffd34d';
  context.fillRect(2, -8, 10, 16);
  context.fillStyle = '#e8c9a8';
  context.beginPath();
  context.arc(7, 0, 7, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#2a1a12';
  context.beginPath();
  context.arc(9, -3, 3.5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#20242e';
  context.fillRect(11, -2, 8, 4);
  context.restore();
}
