// Drawing only: the world and the current screen in, pixels out. The camera follows the
// player smoothly; the world is drawn in world space, the HUD and the screens in screen space.
// Sun-soaked art direction: warm ground, sunset-pastel buildings with long shadows, a turquoise
// sea, palm trees and golden-hour light.
import { FONT, PALETTE, ROAD, VIEW, WORLD } from './config.js';
import { BEACH_Y, ROAD_LINES, SEA_Y } from './world.js';
import { drawCar } from './traffic.js';
import { drawPed } from './pedestrians.js';
import { drawPlayer } from './player.js';
import { drawPolice } from './police.js';
import { drawHud } from './hud.js';
import { drawMinimap } from './minimap.js';
import { missionTarget } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const camera = { x: 1600, y: 1200 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, bold) {
    const key = `${size}-${bold ? 1 : 0}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? 'bold ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawGround(city) {
    // Base ground.
    context.fillStyle = PALETTE.ground;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    // Park.
    context.fillStyle = PALETTE.park;
    context.fillRect(city.park.x, city.park.y, city.park.w, city.park.h);
    context.fillStyle = PALETTE.parkDark;
    context.beginPath();
    context.arc(city.park.x + city.park.w / 2, city.park.y + city.park.h / 2, 46, 0, Math.PI * 2);
    context.fill();
    // Beach and sea.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, BEACH_Y, WORLD.width, WORLD.height - BEACH_Y);
    const seaGradient = context.createLinearGradient(0, SEA_Y, 0, WORLD.height);
    seaGradient.addColorStop(0, PALETTE.seaShallow);
    seaGradient.addColorStop(1, PALETTE.seaDeep);
    context.fillStyle = seaGradient;
    context.fillRect(0, SEA_Y, WORLD.width, WORLD.height - SEA_Y);
    context.strokeStyle = 'rgba(255,255,255,0.5)';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0, SEA_Y + 4);
    context.lineTo(WORLD.width, SEA_Y + 4);
    context.stroke();
    // Marina pier.
    context.fillStyle = '#8a6a4a';
    context.fillRect(2852, BEACH_Y + 20, 96, WORLD.height - BEACH_Y - 20);
    context.fillStyle = '#6a4a2a';
    for (let y = BEACH_Y + 30; y < WORLD.height; y += 22) context.fillRect(2852, y, 96, 3);
    // Roads: asphalt, kerb and centre dashes.
    for (const line of ROAD_LINES) {
      context.fillStyle = PALETTE.road;
      context.fillRect(0, line - ROAD.width / 2, WORLD.width, ROAD.width);
      context.fillRect(line - ROAD.width / 2, 0, ROAD.width, WORLD.height);
    }
    context.strokeStyle = PALETTE.dash;
    context.lineWidth = 3;
    context.setLineDash([26, 30]);
    for (const line of ROAD_LINES) {
      context.beginPath();
      context.moveTo(0, line);
      context.lineTo(WORLD.width, line);
      context.stroke();
      context.beginPath();
      context.moveTo(line, 0);
      context.lineTo(line, WORLD.height);
      context.stroke();
    }
    context.setLineDash([]);
    // Sidewalks around each block.
    context.strokeStyle = PALETTE.sidewalk;
    context.lineWidth = 10;
    for (let col = 0; col < 7; col += 1) {
      for (let row = 0; row < 5; row += 1) {
        context.strokeRect(ROAD_LINES[col] + ROAD.width / 2 + 5, ROAD_LINES[row] + ROAD.width / 2 + 5, ROAD.spacing - ROAD.width - 10, ROAD.spacing - ROAD.width - 10);
      }
    }
  }

  function drawBuildings(city) {
    for (const b of city.buildings) {
      // Long late-afternoon shadow.
      context.fillStyle = 'rgba(60,30,20,0.25)';
      context.fillRect(b.x + 14, b.y + 18, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x, b.y, b.w, 12);
      context.fillStyle = PALETTE.glass;
      const cols = Math.max(2, Math.floor(b.w / 42));
      const rows = Math.max(1, Math.floor((b.h - 24) / 40));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          context.fillRect(b.x + 12 + c * 42, b.y + 24 + r * 40, 22, 18);
        }
      }
    }
  }

  function drawPalms(city) {
    for (const palm of city.palms) {
      context.strokeStyle = PALETTE.palmTrunk;
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(palm.x, palm.y);
      context.lineTo(palm.x + 4, palm.y - 22);
      context.stroke();
      context.fillStyle = PALETTE.palmLeaf;
      for (let i = 0; i < 5; i += 1) {
        const angle = (i / 5) * Math.PI * 2 + 0.4;
        context.beginPath();
        context.ellipse(palm.x + 4 + Math.cos(angle) * 12, palm.y - 24 + Math.sin(angle) * 10, 13, 5, angle, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawMarker(state) {
    const target = missionTarget(state.missions, state);
    if (!target) return;
    const pulse = 1 + 0.18 * Math.sin(performance.now() / 240);
    context.save();
    context.translate(target.x, target.y);
    context.fillStyle = 'rgba(255,207,61,0.25)';
    context.beginPath();
    context.arc(0, 0, 44 * pulse, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#ffcf3d';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, 30 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = '#ffcf3d';
    context.beginPath();
    context.moveTo(0, -52);
    context.lineTo(10, -34);
    context.lineTo(-10, -34);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawWorld(state, city) {
    drawGround(city);
    drawBuildings(city);
    drawPalms(city);
    drawMarker(state);
    // Cars: parked and traffic first, then police cars, then the player's car.
    for (const car of state.traffic.cars) if (!car.dead && car.kind !== 'police') drawCar(context, car);
    for (const car of state.extraCars) if (!car.dead) drawCar(context, car);
    for (const unit of state.police.units) if (unit.kind === 'car' && !unit.car.dead) drawCar(context, unit.car);
    for (const ped of state.peds.peds) drawPed(context, ped);
    drawPolice(context, state.police.units);
    drawPlayer(context, state.player);
    // Bullets.
    context.fillStyle = '#ffe08a';
    for (const b of state.combat.bullets) {
      context.beginPath();
      context.arc(b.x, b.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#ff8a5a';
    for (const b of state.enemyBullets) {
      context.beginPath();
      context.arc(b.x, b.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    // Particles.
    for (const p of state.particles.list) {
      if (p.text) {
        context.globalAlpha = Math.max(0, p.life / p.maxLife);
        text(p.text, p.x, p.y, p.size, p.color, 'center', true);
        context.globalAlpha = 1;
        continue;
      }
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
  }

  function drawTitle(state) {
    const gradient = context.createLinearGradient(0, 0, 0, VIEW.height);
    gradient.addColorStop(0, '#ff9a5a');
    gradient.addColorStop(0.55, '#c25a7a');
    gradient.addColorStop(1, '#2a1a4a');
    context.fillStyle = gradient;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    context.fillStyle = '#fff3c9';
    context.beginPath();
    context.arc(VIEW.width - 220, 150, 74, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255,243,201,0.25)';
    context.beginPath();
    context.arc(VIEW.width - 220, 150, 110, 0, Math.PI * 2);
    context.fill();
    text('SUNBAY CITY', VIEW.width / 2, 250, 92, '#ffffff', 'center', true);
    text('A sun-soaked open-world crime story', VIEW.width / 2, 300, 26, '#ffe9a8', 'center', false);
    text('You are Rook — new in town, broke, and already on Marta’s list.', VIEW.width / 2, 352, 20, '#f5efe0', 'center', false);
    text('Steal cars. Run packages. Pull the Marina Job. Don’t get busted.', VIEW.width / 2, 382, 20, '#f5efe0', 'center', false);
    text('WASD / arrows — move & drive · E — enter car / talk · F — punch · Mouse — aim & shoot', VIEW.width / 2, 448, 18, '#e8dcc0', 'center', false);
    text('Shift — run · P — pause · M — mute · Progress saves automatically', VIEW.width / 2, 476, 18, '#e8dcc0', 'center', false);
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    if (blink) text(state.hasSave ? 'Press ENTER to play  ·  C to continue your story' : 'Press ENTER to play', VIEW.width / 2, 560, 26, '#ffd34d', 'center', true);
    text('An original game. No real city, no real gangsters, no borrowed anything.', VIEW.width / 2, 668, 14, 'rgba(245,239,224,0.7)', 'center', false);
  }

  function drawPanel(title, lines, prompt, color) {
    context.fillStyle = 'rgba(10, 8, 20, 0.55)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    const width = 640;
    const height = 150 + lines.length * 36 + 70;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(16, 12, 30, 0.92)';
    context.beginPath();
    context.roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = color || '#ffd34d';
    context.lineWidth = 3;
    context.stroke();
    text(title, VIEW.width / 2, y + 78, 52, color || '#ffd34d', 'center', true);
    lines.forEach((line, i) => text(line, VIEW.width / 2, y + 132 + i * 36, 20, '#f5efe0', 'center', false));
    text(prompt, VIEW.width / 2, y + height - 36, 22, '#ffd34d', 'center', true);
  }

  function draw(state, city, screen) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#1a0f1e';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      // The city drifts slowly behind the title.
      camera.x = 1600 + Math.sin(performance.now() / 9000) * 500;
      camera.y = 1200 + Math.cos(performance.now() / 11000) * 300;
      context.save();
      context.translate(VIEW.width / 2 - camera.x, VIEW.height / 2 - camera.y);
      drawWorld(state, city);
      context.restore();
      drawTitle(state);
      return;
    }
    // Smooth camera follow.
    const targetX = state.player.x;
    const targetY = state.player.y;
    camera.x += (targetX - camera.x) * 0.08;
    camera.y += (targetY - camera.y) * 0.08;
    // Clamp the camera to the world itself: never show the void outside the map
    // (the old +80 overshoot left a dark band at the south/east edges).
    const camX = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, camera.x));
    const camY = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, camera.y));
    context.save();
    context.translate(VIEW.width / 2 - camX, VIEW.height / 2 - camY);
    drawWorld(state, city);
    context.restore();
    drawHud(context, state);
    drawMinimap(context, state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['Sunbay waits for no one — except now.', `Cash $${state.player.money.toLocaleString('en-US')} · Missions done ${state.missions.index} of 4`], 'Press P to keep playing');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Sunbay PD caught up with you.', `Fine paid: $${state.bustFine} · The heat is off — for now.`], 'Press ENTER to walk free', '#7ab8ff');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['You woke up at the Sunbay Clinic.', 'The city is still out there. So is Marta.', ''], 'Press ENTER to get back out there', '#ff5a4a');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, camera };
}
