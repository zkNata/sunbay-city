// The wanted system and the Sunbay Police Department. Crimes raise the star level; the
// level decays when the player stays clean. Police units spawn to match the stars: patrol cars
// that chase and ram, and foot officers who chase on foot and hold the player to bust them.
// Busted costs a fine and clears the heat; wasted (health zero) costs a hospital trip.
import { POLICE } from './config.js';
import { makeCar } from './traffic.js';
import { resolveCircle } from './world.js';
import { damagePlayer } from './player.js';

export const MAX_WANTED = 5;

export function wantedUnitCount(stars) {
  return Math.min(stars, 5);
}

export function createPolice(rand) {
  const units = [];

  function spawnCarNear(player, state) {
    const angle = rand() * Math.PI * 2;
    const dist = 700 + rand() * 300;
    const x = Math.max(160, Math.min(3040, player.x + Math.cos(angle) * dist));
    const y = Math.max(160, Math.min(2280, player.y + Math.sin(angle) * dist));
    const car = makeCar(rand, x, y, Math.atan2(player.y - y, player.x - x), '#2a4a8a', 'police');
    car.speed = POLICE.carSpeed * 0.6;
    units.push({ kind: 'car', car, bustTimer: 0, shootTimer: 0 });
    return car;
  }

  function spawnFootNear(player) {
    const angle = rand() * Math.PI * 2;
    const x = Math.max(60, Math.min(3140, player.x + Math.cos(angle) * 160));
    const y = Math.max(60, Math.min(2340, player.y + Math.sin(angle) * 160));
    units.push({ kind: 'foot', x, y, angle, bustTimer: 0, shootTimer: 0, health: 100 });
    return units[units.length - 1];
  }

  function ensureUnits(state) {
    const want = wantedUnitCount(state.wanted);
    let have = units.length;
    const player = state.player;
    while (have < want) {
      if (player.inCar) spawnCarNear(player, state);
      else spawnFootNear(player);
      have += 1;
    }
    while (units.length > want) {
      const unit = units.pop();
      if (unit.kind === 'car') unit.car.dead = true;
    }
  }

  function step(dt, state, city, particles, audio, onBusted) {
    const player = state.player;
    if (state.wanted > 0) {
      state.cleanTimer += dt;
      if (state.cleanTimer >= POLICE.decaySeconds) {
        state.wanted -= 1;
        state.cleanTimer = 0;
        if (state.wanted === 0) state.message = 'You lost the heat. Stay clean, Rook.';
      }
    }
    ensureUnits(state);
    for (const unit of units) {
      if (unit.kind === 'car') {
        const car = unit.car;
        if (car.dead) continue;
        const targetX = player.x;
        const targetY = player.y;
        const dx = targetX - car.x;
        const dy = targetY - car.y;
        const dist = Math.hypot(dx, dy) || 1;
        const wantAngle = Math.atan2(dy, dx);
        let diff = wantAngle - car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
        car.speed += (POLICE.carSpeed - car.speed) * Math.min(1, 1.4 * dt);
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        car.x = Math.max(60, Math.min(3140, car.x));
        car.y = Math.max(60, Math.min(2340, car.y));
        // Ram the player's car; on foot, stop and send the officer out.
        if (player.inCar) {
          const pcar = player.inCar;
          const ddx = pcar.x - car.x;
          const ddy = pcar.y - car.y;
          const dd = Math.hypot(ddx, ddy);
          if (dd < 52) {
            pcar.health -= 4.5 * dt * 10;
            car.speed *= 0.92;
            pcar.speed *= 0.94;
            if (Math.random() < dt * 8) particles.sparks((pcar.x + car.x) / 2, (pcar.y + car.y) / 2);
          }
        } else if (dist < 130) {
          car.speed = 0;
          unit.kind = 'foot';
          unit.x = car.x;
          unit.y = car.y;
          unit.health = 100;
          car.dead = true;
          car.kind = 'parked';
        }
      } else {
        const dx = player.x - unit.x;
        const dy = player.y - unit.y;
        const dist = Math.hypot(dx, dy) || 1;
        unit.angle = Math.atan2(dy, dx);
        if (player.inCar) {
          // On foot no longer: get back in a car and chase.
          const car = makeCar(rand, unit.x, unit.y, unit.angle, '#2a4a8a', 'police');
          car.speed = POLICE.carSpeed * 0.5;
          unit.kind = 'car';
          unit.car = car;
          state.extraCars.push(car);
          continue;
        }
        const pos = resolveCircle(unit.x + Math.cos(unit.angle) * POLICE.footSpeed * dt, unit.y + Math.sin(unit.angle) * POLICE.footSpeed * dt, 12, city);
        unit.x = pos.x;
        unit.y = pos.y;
        if (dist < POLICE.bustRadius) {
          unit.bustTimer += dt;
          if (unit.bustTimer >= POLICE.bustHold) {
            onBusted();
            return;
          }
        } else {
          unit.bustTimer = Math.max(0, unit.bustTimer - dt * 2);
        }
        // Officers shoot when the heat is high and the player is far — up close they move
        // in to bust instead of gunning the player down.
        if (state.wanted >= 2 && dist > 160 && dist < POLICE.shootRange) {
          unit.shootTimer -= dt;
          if (unit.shootTimer <= 0) {
            unit.shootTimer = POLICE.shootCooldown + Math.random() * 0.6;
            const aim = unit.angle + (Math.random() - 0.5) * 0.35;
            state.enemyBullets.push({ x: unit.x, y: unit.y, vx: Math.cos(aim) * 640, vy: Math.sin(aim) * 640, life: 1.1, fromPolice: true });
            audio.shoot();
          }
        }
      }
    }
    // Enemy bullets: move, hit the player, die on buildings.
    for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
      const b = state.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      const dx = b.x - player.x;
      const dy = b.y - player.y;
      if (!player.inCar && dx * dx + dy * dy < 16 * 16) {
        if (damagePlayer(player, 9, state)) state.pendingWasted = true;
        dead = true;
        particles.sparks(b.x, b.y);
      }
      if (dead) state.enemyBullets.splice(i, 1);
    }
  }

  function clear() {
    for (const unit of units) if (unit.kind === 'car') unit.car.dead = true;
    units.length = 0;
  }

  return { units, step, clear, spawnCarNear, spawnFootNear };
}

export function drawPolice(context, units) {
  for (const unit of units) {
    if (unit.kind === 'foot') {
      context.save();
      context.translate(unit.x, unit.y);
      context.rotate(unit.angle);
      context.fillStyle = 'rgba(0,0,0,0.3)';
      context.beginPath();
      context.ellipse(0, 3, 11, 8, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#2a4a8a';
      context.beginPath();
      context.arc(0, 0, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#e8c9a8';
      context.beginPath();
      context.arc(6, 0, 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#1a2a5a';
      context.beginPath();
      context.arc(7, -2, 3.5, 0, Math.PI * 2);
      context.fill();
      if (unit.bustTimer > 0) {
        context.fillStyle = '#ffd34d';
        context.fillRect(-12, -22, 24 * Math.min(1, unit.bustTimer / POLICE.bustHold), 4);
      }
      context.restore();
    }
  }
}
