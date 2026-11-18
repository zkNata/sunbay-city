// Combat: fists and the pistol. A punch is a short arc in front of the player; a bullet flies
// straight until it hits a cop, a cop car, a pedestrian or a building. Shooting is a crime.
import { PLAYER } from './config.js';
import { distance } from './world.js';
import { raiseWanted } from './player.js';
import { scarePeds } from './pedestrians.js';

export function shootAt(state, targetX, targetY) {
  const player = state.player;
  if (!player.pistol || player.inCar !== null || player.shootCooldown > 0 || player.dead) return;
  player.shootCooldown = PLAYER.shootCooldown;
  state.stats.shots += 1;
  const angle = Math.atan2(targetY - player.y, targetX - player.x);
  player.aimAngle = angle;
  state.bullets.push({
    x: player.x + Math.cos(angle) * 18,
    y: player.y + Math.sin(angle) * 18,
    vx: Math.cos(angle) * 720,
    vy: Math.sin(angle) * 720,
    life: 0.75,
  });
  state.particles.push({ x: player.x + Math.cos(angle) * 22, y: player.y + Math.sin(angle) * 22, vx: 0, vy: 0, life: 0.12, maxLife: 0.12, size: 10, color: '#ffd94d', kind: 'flash' });
  raiseWanted(state, 1);
  scarePeds(state, player.x, player.y, 260);
}

export function updateCombat(state, dt) {
  const player = state.player;
  // The punch arc: anything close in front of the player gets knocked back and hurt.
  if (state.punch) {
    state.punch.time -= dt;
    const punch = state.punch;
    const hit = (target, radius) => {
      if (distance(punch, target) > PLAYER.punchRange + radius) return false;
      const angle = Math.atan2(target.y - punch.y, target.x - punch.x);
      let diff = angle - punch.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return Math.abs(diff) < Math.PI / 2.2;
    };
    for (const cop of state.footCops) {
      if (hit(cop, 10)) {
        cop.health -= PLAYER.punchDamage;
        cop.x += Math.cos(punch.angle) * 26;
        cop.y += Math.sin(punch.angle) * 26;
      }
    }
    for (const ped of state.peds) {
      if (hit(ped, 8)) {
        ped.tx = ped.x + Math.cos(punch.angle) * 240;
        ped.ty = ped.y + Math.sin(punch.angle) * 240;
        ped.flee = 3;
      }
    }
    if (state.punch.time <= 0) state.punch = null;
  }

  // Bullets fly, then die on a building, a cop, a cop car or a pedestrian.
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    let dead = bullet.life <= 0;
    if (!dead) {
      for (const b of state.city.buildings) {
        if (bullet.x > b.x && bullet.x < b.x + b.w && bullet.y > b.y && bullet.y < b.y + b.h) {
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (let j = state.footCops.length - 1; j >= 0; j -= 1) {
        if (distance(bullet, state.footCops[j]) < 14) {
          state.footCops[j].health -= PLAYER.bulletDamage;
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of state.cars) {
        if (car.kind !== 'police' || car.exploded) continue;
        if (distance(bullet, car) < 24) {
          car.health -= PLAYER.bulletDamage;
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const ped of state.peds) {
        if (distance(bullet, ped) < 12) {
          scarePeds(state, ped.x, ped.y, 200);
          dead = true;
          break;
        }
      }
    }
    if (dead) {
      state.particles.push({ x: bullet.x, y: bullet.y, vx: 0, vy: 0, life: 0.2, maxLife: 0.2, size: 8, color: '#ffd94d', kind: 'flash' });
      state.bullets.splice(i, 1);
    }
  }

  // Downed foot cops leave; a cop car at zero health smokes, then blows up and its driver bails.
  for (let i = state.footCops.length - 1; i >= 0; i -= 1) {
    if (state.footCops[i].health <= 0) state.footCops.splice(i, 1);
  }
  for (const car of state.cars) {
    if (car.kind === 'police' && !car.exploded && car.health <= 0) {
      car.exploded = true;
      car.driver = null;
      car.speed = 0;
      car.smoke = 2;
      for (let k = 0; k < 14; k += 1) {
        const angle = state.rng.range(0, Math.PI * 2);
        const speed = state.rng.range(40, 220);
        state.particles.push({
          x: car.x, y: car.y,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: state.rng.range(0.4, 0.9), maxLife: 0.9, size: state.rng.range(6, 16),
          color: state.rng.pick(['#ff8a3d', '#ffd94d', '#8b93a3']), kind: 'spark',
        });
      }
      if (state.player.inCar === car.id) {
        // Thrown clear of the blast, briefly invulnerable.
        state.player.inCar = null;
        state.player.x = car.x + 40;
        state.player.y = car.y;
        state.player.invulnerable = PLAYER.invulnerable;
      }
    }
  }
}
