// Particles: sparks, smoke and flashes. Small, short-lived, and pooled nowhere — the arrays
// stay tiny because every particle dies within a second.
export function spawnSparks(state, x, y, count, color) {
  for (let i = 0; i < count; i += 1) {
    const angle = state.rng.range(0, Math.PI * 2);
    const speed = state.rng.range(50, 240);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: state.rng.range(0.25, 0.7), maxLife: 0.7,
      size: state.rng.range(4, 10), color: color ?? '#ffd94d', kind: 'spark',
    });
  }
}

export function spawnSmoke(state, x, y) {
  state.particles.push({
    x: x + state.rng.range(-8, 8), y: y + state.rng.range(-8, 8),
    vx: state.rng.range(-12, 12), vy: state.rng.range(-30, -10),
    life: state.rng.range(0.6, 1.1), maxLife: 1.1,
    size: state.rng.range(10, 18), color: '#8b93a3', kind: 'smoke',
  });
}

export function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'smoke') {
      p.size += 14 * dt;
      p.vx *= 1 - dt;
      p.vy *= 1 - dt;
    }
  }
}
