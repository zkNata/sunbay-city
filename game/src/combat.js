// Combat: the player's fists and pistol, bullets in flight, and cars that take damage, smoke
// and explode. Hurting people and blowing up cars are crimes: they raise the wanted level.
import { PLAYER } from './config.js';
import { circleHitsBuilding } from './world.js';

export function createCombat() {
  const bullets = [];

  function shoot(state, fromX, fromY, angle, damage) {
    bullets.push({
      x: fromX + Math.cos(angle) * 22,
      y: fromY + Math.sin(angle) * 22,
      vx: Math.cos(angle) * 900,
      vy: Math.sin(angle) * 900,
      life: 0.9,
      damage: damage || PLAYER.bulletDamage,
    });
    state.shotsFiredTimer = 1.2;
  }

  function punch(state, player, audio, particles) {
    if (player.punchTimer > 0 || player.inCar) return false;
    player.punchTimer = PLAYER.punchCooldown;
    audio.punch();
    const px = player.x + Math.cos(player.angle) * 30;
    const py = player.y + Math.sin(player.angle) * 30;
    let hit = false;
    for (const ped of state.peds.peds) {
      if (ped.down) continue;
      const dx = ped.x - px;
      const dy = ped.y - py;
      if (dx * dx + dy * dy < PLAYER.punchRange * PLAYER.punchRange) {
        ped.down = true;
        ped.downTimer = 4;
        ped.x += Math.cos(player.angle) * 18;
        ped.y += Math.sin(player.angle) * 18;
        particles.sparks(ped.x, ped.y);
        hit = true;
      }
    }
    for (const unit of state.police.units) {
      if (unit.kind !== 'foot') continue;
      const dx = unit.x - px;
      const dy = unit.y - py;
      if (dx * dx + dy * dy < PLAYER.punchRange * PLAYER.punchRange) {
        unit.health -= PLAYER.punchDamage * 2;
        particles.sparks(unit.x, unit.y);
        hit = true;
        if (unit.health <= 0) {
          state.police.units.splice(state.police.units.indexOf(unit), 1);
          addWanted(state, 1);
        }
      }
    }
    if (hit) addWanted(state, 1);
    return hit;
  }

  function step(dt, state, city, particles, audio) {
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      if (!dead && circleHitsBuilding(b.x, b.y, 2, city)) dead = true;
      if (!dead) {
        // Pedestrians.
        for (const ped of state.peds.peds) {
          if (ped.down) continue;
          const dx = ped.x - b.x;
          const dy = ped.y - b.y;
          if (dx * dx + dy * dy < 14 * 14) {
            ped.down = true;
            ped.downTimer = 6;
            particles.sparks(b.x, b.y);
            addWanted(state, 1);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        // Foot police.
        for (const unit of state.police.units) {
          if (unit.kind !== 'foot') continue;
          const dx = unit.x - b.x;
          const dy = unit.y - b.y;
          if (dx * dx + dy * dy < 14 * 14) {
            unit.health -= b.damage;
            particles.sparks(b.x, b.y);
            addWanted(state, 1);
            dead = true;
            if (unit.health <= 0) state.police.units.splice(state.police.units.indexOf(unit), 1);
            break;
          }
        }
      }
      if (!dead) {
        // Cars (not the player's own).
        for (const car of state.traffic.cars) {
          if (car.dead || car.isPlayerCar) continue;
          const dx = car.x - b.x;
          const dy = car.y - b.y;
          const localX = dx * Math.cos(-car.angle) - dy * Math.sin(-car.angle);
          const localY = dx * Math.sin(-car.angle) + dy * Math.cos(-car.angle);
          if (Math.abs(localX) < 24 && Math.abs(localY) < 12) {
            car.health -= b.damage;
            particles.sparks(b.x, b.y);
            dead = true;
            if (car.kind === 'police') addWanted(state, 1);
            if (car.health <= 0) explodeCar(state, car, particles, audio);
            break;
          }
        }
        for (const car of state.extraCars) {
          if (car.dead || car.isPlayerCar) continue;
          const dx = car.x - b.x;
          const dy = car.y - b.y;
          const localX = dx * Math.cos(-car.angle) - dy * Math.sin(-car.angle);
          const localY = dx * Math.sin(-car.angle) + dy * Math.cos(-car.angle);
          if (Math.abs(localX) < 24 && Math.abs(localY) < 12) {
            car.health -= b.damage;
            particles.sparks(b.x, b.y);
            dead = true;
            if (car.health <= 0) explodeCar(state, car, particles, audio);
            break;
          }
        }
      }
      if (!dead) {
        // Police cars (they live in the police units, not in the traffic list).
        for (const unit of state.police.units) {
          if (unit.kind !== 'car' || unit.car.dead) continue;
          const car = unit.car;
          const dx = car.x - b.x;
          const dy = car.y - b.y;
          const localX = dx * Math.cos(-car.angle) - dy * Math.sin(-car.angle);
          const localY = dx * Math.sin(-car.angle) + dy * Math.cos(-car.angle);
          if (Math.abs(localX) < 24 && Math.abs(localY) < 12) {
            car.health -= b.damage;
            particles.sparks(b.x, b.y);
            addWanted(state, 1);
            dead = true;
            if (car.health <= 0) explodeCar(state, car, particles, audio);
            break;
          }
        }
      }
      if (dead) bullets.splice(i, 1);
    }
    // A burning car explodes once its health is gone.
    for (const car of [...state.traffic.cars, ...state.extraCars]) {
      if (!car.dead && car.health <= 0) explodeCar(state, car, particles, audio);
    }
    for (const unit of state.police.units) {
      if (unit.kind === 'car' && !unit.car.dead && unit.car.health <= 0) explodeCar(state, unit.car, particles, audio);
    }
  }

  function explodeCar(state, car, particles, audio) {
    if (car.dead) return;
    car.dead = true;
    car.health = 0;
    particles.explosion(car.x, car.y);
    audio.explosion();
    addWanted(state, 1);
    const player = state.player;
    const d = Math.hypot(player.x - car.x, player.y - car.y);
    if (d < 90 && !player.inCar) {
      player.health -= 30;
      if (player.health <= 0) state.pendingWasted = true;
    }
    if (player.inCar === car) {
      player.inCar = null;
      player.x = car.x + 40;
      player.y = car.y;
      player.health -= 25;
      // A second of grace after being thrown clear, so the police do not gun the player
      // down before they can run.
      player.invulnerable = 1.0;
      if (player.health <= 0) state.pendingWasted = true;
    }
  }

  return { bullets, shoot, punch, step, explodeCar };
}

export function addWanted(state, stars) {
  if (state.wanted >= 5) return;
  state.wanted = Math.min(5, state.wanted + stars);
  state.cleanTimer = 0;
}
