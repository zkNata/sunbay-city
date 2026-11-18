// Short-lived visual effects: muzzle flashes, tyre smoke, exhaust puffs, explosion fire and
// sparks, and the floating "+$400" text. Particles never collide with anything; they fade.

export function createParticles() {
  const list = [];

  function spawn(x, y, vx, vy, life, size, color, gravity) {
    if (list.length > 400) list.shift();
    list.push({ x, y, vx, vy, life, maxLife: life, size, color, gravity: gravity || 0, text: null });
  }

  return {
    list,
    smoke(x, y, count) {
      for (let i = 0; i < count; i += 1) {
        spawn(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 30, -20 - Math.random() * 30, 0.7 + Math.random() * 0.5, 6 + Math.random() * 8, 'rgba(120,120,120,0.5)');
      }
    },
    exhaust(x, y, angle) {
      spawn(x - Math.cos(angle) * 24, y - Math.sin(angle) * 24, -Math.cos(angle) * 40, -Math.sin(angle) * 40, 0.5, 5, 'rgba(150,150,150,0.45)');
    },
    muzzle(x, y, angle) {
      for (let i = 0; i < 5; i += 1) {
        spawn(x, y, Math.cos(angle) * (180 + Math.random() * 160) + (Math.random() - 0.5) * 60, Math.sin(angle) * (180 + Math.random() * 160) + (Math.random() - 0.5) * 60, 0.12 + Math.random() * 0.1, 3 + Math.random() * 3, '#ffd34d');
      }
    },
    explosion(x, y) {
      for (let i = 0; i < 34; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 320;
        spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.5 + Math.random() * 0.7, 4 + Math.random() * 9, ['#ff9a3d', '#ff5a3c', '#ffd34d', '#5a5a5a'][i % 4]);
      }
      for (let i = 0; i < 12; i += 1) {
        spawn(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 20, -30 - Math.random() * 40, 1.4 + Math.random() * 0.8, 10 + Math.random() * 12, 'rgba(90,90,90,0.55)');
      }
    },
    sparks(x, y) {
      for (let i = 0; i < 6; i += 1) {
        spawn(x, y, (Math.random() - 0.5) * 260, (Math.random() - 0.5) * 260, 0.25, 2.5, '#ffe08a');
      }
    },
    floatText(x, y, text, color) {
      if (list.length > 400) list.shift();
      list.push({ x, y, vx: 0, vy: -46, life: 1.4, maxLife: 1.4, size: 20, color: color || '#ffd34d', gravity: 0, text });
    },
    step(dt) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) {
          list.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        p.vx *= 0.98;
      }
    },
    clear() {
      list.length = 0;
    },
  };
}
