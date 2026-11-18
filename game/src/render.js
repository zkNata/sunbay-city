// Drawing only: the city, its people and cars, the effects, then the HUD and the screens.
// The camera is a 1280x720 window clamped exactly to the world's edges, so a frame never
// shows the void outside the city.
import {
  BEACH_Y, FONT, PALETTE, ROADS_H, ROADS_V, ROAD_W, SEA_Y, VIEW, WORLD,
} from './config.js';
import { currentObjective } from './missions.js';
import { drawHud, drawScreen, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_STORY, SCREEN_TITLE, SCREEN_WASTED } from './hud.js';
import { carById, nearestEnterableCar } from './player.js';

export { SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_STORY, SCREEN_TITLE, SCREEN_WASTED };

/** The camera for a player position: centred on them, clamped exactly to the world. */
export function cameraFor(x, y) {
  return {
    x: Math.max(0, Math.min(WORLD.width - VIEW.width, x - VIEW.width / 2)),
    y: Math.max(0, Math.min(WORLD.height - VIEW.height, y - VIEW.height / 2)),
  };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(VIEW.width * ratio);
    canvas.height = Math.round(VIEW.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function drawGround(camera) {
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // City blocks.
    ctx.fillStyle = PALETTE.block;
    for (let bx = 0; bx < ROADS_V.length; bx += 1) {
      const x0 = bx === 0 ? 0 : ROADS_V[bx - 1] + ROAD_W / 2;
      const x1 = bx < ROADS_V.length ? ROADS_V[bx] - ROAD_W / 2 : WORLD.width;
      for (let by = 0; by < ROADS_H.length; by += 1) {
        const y0 = by === 0 ? 0 : ROADS_H[by - 1] + ROAD_W / 2;
        const y1 = by < ROADS_H.length ? ROADS_H[by] - ROAD_W / 2 : BEACH_Y;
        ctx.fillRect(x0 - camera.x, y0 - camera.y, x1 - x0, y1 - y0);
      }
    }
    // Beach, then the sea.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, BEACH_Y - camera.y, VIEW.width, SEA_Y - BEACH_Y);
    const seaGradient = ctx.createLinearGradient(0, SEA_Y - camera.y, 0, VIEW.height);
    seaGradient.addColorStop(0, PALETTE.sea);
    seaGradient.addColorStop(1, PALETTE.seaDeep);
    ctx.fillStyle = seaGradient;
    ctx.fillRect(0, SEA_Y - camera.y, VIEW.width, VIEW.height - (SEA_Y - camera.y));
    // A few waves.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      const wy = SEA_Y + 24 + i * 42 - camera.y;
      if (wy < 0 || wy > VIEW.height) continue;
      ctx.beginPath();
      for (let x = -camera.x % 90; x < VIEW.width + 90; x += 90) {
        ctx.moveTo(x, wy);
        ctx.quadraticCurveTo(x + 22, wy - 6, x + 45, wy);
      }
      ctx.stroke();
    }
  }

  function drawRoads(camera) {
    ctx.fillStyle = PALETTE.road;
    for (const roadX of ROADS_V) ctx.fillRect(roadX - ROAD_W / 2 - camera.x, -camera.y, ROAD_W, WORLD.height);
    for (const roadY of ROADS_H) ctx.fillRect(-camera.x, roadY - ROAD_W / 2 - camera.y, WORLD.width, ROAD_W);
    // Dashed centrelines.
    ctx.strokeStyle = PALETTE.lane;
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 26]);
    ctx.beginPath();
    for (const roadX of ROADS_V) {
      ctx.moveTo(roadX - camera.x, -camera.y);
      ctx.lineTo(roadX - camera.x, WORLD.height - camera.y);
    }
    for (const roadY of ROADS_H) {
      ctx.moveTo(-camera.x, roadY - camera.y);
      ctx.lineTo(WORLD.width - camera.x, roadY - camera.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawCity(state, camera) {
    // Parks and their palms.
    for (const park of state.city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x - camera.x, park.y - camera.y, park.w, park.h);
      for (const palm of park.palms) drawPalm(palm.x - camera.x, palm.y - camera.y);
    }
    // The marina pier: planks over the sand and sea.
    ctx.fillStyle = PALETTE.pier;
    ctx.fillRect(2100 - camera.x, BEACH_Y - camera.y, 60, WORLD.height - BEACH_Y);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 1;
    for (let y = BEACH_Y; y < WORLD.height; y += 18) {
      ctx.beginPath();
      ctx.moveTo(2100 - camera.x, y - camera.y);
      ctx.lineTo(2160 - camera.x, y - camera.y);
      ctx.stroke();
    }
    // Buildings: pastel walls, a darker roof edge, and a grid of windows.
    for (const b of state.city.buildings) {
      const bx = b.x - camera.x;
      const by = b.y - camera.y;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(bx + 6, by + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(bx, by, b.w, b.h);
      ctx.fillStyle = PALETTE.buildingRoof;
      ctx.fillRect(bx, by, b.w, 10);
      ctx.fillStyle = '#bfe3f0';
      const cols = Math.max(1, Math.floor(b.w / 46));
      const rows = Math.max(1, Math.floor((b.h - 18) / 44));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          ctx.fillRect(bx + 14 + c * 46, by + 22 + r * 44, 22, 26);
        }
      }
      if (b.name === 'cafe') {
        ctx.fillStyle = PALETTE.text;
        ctx.font = `700 15px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText("MARTA'S CAFE", bx + b.w / 2, by + b.h / 2 + 5);
      }
      if (b.name === 'garage') {
        ctx.fillStyle = PALETTE.text;
        ctx.font = `700 15px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('GARAGE', bx + b.w / 2, by + b.h / 2 + 5);
      }
      if (b.name === 'bar') {
        ctx.fillStyle = PALETTE.text;
        ctx.font = `700 15px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('PALMA BAR', bx + b.w / 2, by + b.h / 2 + 5);
      }
      if (b.name === 'marina') {
        ctx.fillStyle = PALETTE.text;
        ctx.font = `700 13px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('MARINA OFFICE', bx + b.w / 2, by + b.h / 2 + 5);
      }
    }
  }

  function drawPalm(x, y) {
    ctx.strokeStyle = '#6b4a2f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.lineTo(x, y - 6);
    ctx.stroke();
    ctx.fillStyle = '#4e9b4e';
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(angle) * 9, y - 6 + Math.sin(angle) * 6, 10, 4, angle, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar(car, camera, time) {
    const x = car.x - camera.x;
    const y = car.y - camera.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 25, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-23, -11, 46, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#20242e';
    ctx.beginPath();
    ctx.roundRect(-6, -9, 14, 18, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(191, 227, 240, 0.9)';
    ctx.fillRect(6, -8, 5, 16);
    ctx.fillStyle = '#ffd94d';
    ctx.fillRect(21, -9, 2, 4);
    ctx.fillRect(21, 5, 2, 4);
    if (car.kind === 'police') {
      const flash = Math.floor(time * 4) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#2f7bff';
      ctx.fillRect(-2, -11, 8, 4);
      ctx.fillStyle = flash ? '#2f7bff' : '#ff3b30';
      ctx.fillRect(-2, 7, 8, 4);
      ctx.fillStyle = '#f4f1e8';
      ctx.font = '700 8px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 3);
    }
    ctx.restore();
    if (car.smoke > 0) {
      ctx.fillStyle = 'rgba(139, 147, 163, 0.6)';
      ctx.beginPath();
      ctx.arc(x + Math.sin(time * 5) * 4, y - 8, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPed(ped, camera) {
    const x = ped.x - camera.x;
    const y = ped.y - camera.y;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 7, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(x, y - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(state, camera) {
    const player = state.player;
    if (player.inCar !== null) return;
    const x = player.x - camera.x;
    const y = player.y - camera.y;
    if (player.invulnerable > 0 && Math.floor(state.time * 10) % 2 === 0) return;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242e';
    ctx.beginPath();
    ctx.arc(x + Math.cos(player.angle) * 5, y + Math.sin(player.angle) * 5, 5, 0, Math.PI * 2);
    ctx.fill();
    // The aim line when the pistol is out.
    if (player.pistol) {
      ctx.strokeStyle = 'rgba(244, 241, 232, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(player.aimAngle) * 34, y + Math.sin(player.aimAngle) * 34);
      ctx.stroke();
    }
  }

  function drawObjective(state, camera) {
    const objective = currentObjective(state);
    if (!objective.target) return;
    const tx = objective.target.x - camera.x;
    const ty = objective.target.y - camera.y;
    const pulse = 26 + Math.sin(state.time * 4) * 5;
    ctx.strokeStyle = '#f2c94c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(tx, ty, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(242, 201, 76, 0.2)';
    ctx.beginPath();
    ctx.arc(tx, ty, pulse, 0, Math.PI * 2);
    ctx.fill();
    // A floating marker above the target.
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.moveTo(tx, ty - pulse - 18);
    ctx.lineTo(tx - 8, ty - pulse - 34);
    ctx.lineTo(tx + 8, ty - pulse - 34);
    ctx.closePath();
    ctx.fill();
  }

  function drawParticles(state, camera) {
    for (const p of state.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - camera.x, p.y - camera.y, p.size * (p.kind === 'smoke' ? 1 : alpha), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWorld(state) {
    const camera = state.camera;
    drawGround(camera);
    drawRoads(camera);
    drawCity(state, camera);
    drawObjective(state, camera);
    for (const ped of state.peds) drawPed(ped, camera);
    for (const car of state.cars) {
      if (!car.exploded) drawCar(car, camera, state.time);
      else {
        // A wrecked car: a dark husk.
        ctx.save();
        ctx.translate(car.x - camera.x, car.y - camera.y);
        ctx.rotate(car.angle);
        ctx.fillStyle = '#20242e';
        ctx.beginPath();
        ctx.roundRect(-23, -11, 46, 22, 6);
        ctx.fill();
        ctx.restore();
      }
    }
    for (const cop of state.footCops) {
      const x = cop.x - camera.x;
      const y = cop.y - camera.y;
      ctx.fillStyle = '#3b6fe0';
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4f1e8';
      ctx.beginPath();
      ctx.arc(x, y - 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    drawPlayer(state, camera);
    for (const bullet of state.bullets) {
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(bullet.x - camera.x, bullet.y - camera.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    drawParticles(state, camera);
    // The punch arc, briefly.
    if (state.punch) {
      ctx.strokeStyle = 'rgba(255, 217, 77, 0.8)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(state.punch.x - camera.x, state.punch.y - camera.y, 34, state.punch.angle - 0.8, state.punch.angle + 0.8);
      ctx.stroke();
    }
  }

  /** The one-line hint under the crosshair: what E does right now, if anything. */
  function contextPrompt(state) {
    const player = state.player;
    if (player.dead) return '';
    if (player.inCar !== null) {
      const car = carById(state, player.inCar);
      if (car && car.kind === 'sports' && state.mission.index === 1) return 'E — Get out of the car';
      return 'E — Get out of the car';
    }
    const objective = currentObjective(state);
    if (state.mission.index === 0 && Math.hypot(player.x - 710, player.y - 500) < 64) return 'E — Talk to Marta';
    if (state.mission.index === 3 && state.mission.stage === 'grab' && Math.hypot(player.x - 2130, player.y - 1490) < 64) return 'E — Grab the cash';
    if (nearestEnterableCar(state)) return 'E — Get in the car';
    if (objective.target) return '';
    return '';
  }

  function draw(state, screen, hasSave) {
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    if (screen === SCREEN_TITLE) {
      // A slow pan over the city behind the title.
      const panX = 600 + Math.sin(state.time * 0.05) * 400;
      const panY = 500 + Math.cos(state.time * 0.04) * 200;
      state.camera = cameraFor(panX, panY);
      drawWorld(state);
      drawScreen(ctx, state, screen, hasSave);
      return;
    }
    drawWorld(state);
    if (screen === SCREEN_PLAY) drawHud(ctx, state, contextPrompt(state));
    else drawScreen(ctx, state, screen, hasSave);
  }

  return { draw, resize };
}
