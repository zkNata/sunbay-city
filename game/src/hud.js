// The HUD and the screens: name, health and cash; the mission title, objective, distance and
// timer; wanted stars and the clock; the context prompt and the controls hint; and the title,
// pause, busted, wasted and story-complete screens. The clock sits well inside its pill so it
// is never clipped, and distance and timer ride on dark pills so they read over bright roofs.
import { FONT, PALETTE, VIEW } from './config.js';
import { currentObjective, objectiveDistance } from './missions.js';
import { drawMinimap } from './minimap.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_STORY = 'story';

function pill(ctx, x, y, w, h, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = 'rgba(16, 19, 26, 0.72)';
  ctx.fill();
}

function formatClock(minutes) {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = Math.floor(minutes) % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function drawStars(ctx, x, y, wanted) {
  for (let i = 0; i < 5; i += 1) {
    const cx = x + i * 22;
    ctx.fillStyle = i < wanted ? PALETTE.gold : 'rgba(244, 241, 232, 0.25)';
    ctx.beginPath();
    for (let k = 0; k < 5; k += 1) {
      const angle = -Math.PI / 2 + (k * Math.PI * 2) / 5;
      const outer = 10;
      const inner = 4.5;
      const px = cx + Math.cos(angle) * outer;
      const py = y + Math.sin(angle) * outer;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
      const mid = angle + Math.PI / 5;
      ctx.lineTo(cx + Math.cos(mid) * inner, y + Math.sin(mid) * inner);
    }
    ctx.closePath();
    ctx.fill();
  }
}

export function drawHud(ctx, state, prompt) {
  const player = state.player;
  ctx.save();
  ctx.textBaseline = 'middle';

  // Top left: name, health bar, cash.
  pill(ctx, 14, 12, 216, 62, 10);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 17px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('ROOK', 28, 30);
  ctx.fillStyle = '#20242e';
  ctx.beginPath();
  ctx.roundRect(28, 44, 128, 12, 6);
  ctx.fill();
  ctx.fillStyle = player.health > 30 ? PALETTE.health : PALETTE.danger;
  ctx.beginPath();
  ctx.roundRect(28, 44, Math.max(0, 128 * (player.health / 100)), 12, 6);
  ctx.fill();
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `700 19px ${FONT}`;
  ctx.fillText(`$${player.money}`, 168, 50);

  // Top centre: mission title, then the objective with its distance, then the timer.
  const objective = currentObjective(state);
  ctx.font = `700 18px ${FONT}`;
  const titleWidth = ctx.measureText(objective.title).width;
  pill(ctx, (VIEW.width - titleWidth) / 2 - 40, 12, titleWidth + 80, 34, 10);
  ctx.fillStyle = PALETTE.gold;
  ctx.textAlign = 'center';
  ctx.fillText(objective.title, VIEW.width / 2, 30);
  ctx.font = `600 15px ${FONT}`;
  const objectiveText = objective.text;
  const objectiveWidth = ctx.measureText(objectiveText).width;
  pill(ctx, (VIEW.width - objectiveWidth) / 2 - 14, 52, objectiveWidth + 28, 30, 9);
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(objectiveText, VIEW.width / 2, 68);
  const distance = objectiveDistance(state);
  if (objective.target && distance > 0) {
    const distanceText = `${distance}m`;
    ctx.font = `700 14px ${FONT}`;
    const distanceWidth = ctx.measureText(distanceText).width;
    pill(ctx, (VIEW.width - distanceWidth) / 2 - 10, 88, distanceWidth + 20, 24, 8);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(distanceText, VIEW.width / 2, 101);
  }
  if (objective.timer > 0) {
    const timerText = `TIME ${Math.ceil(objective.timer)}s`;
    ctx.font = `700 15px ${FONT}`;
    const timerWidth = ctx.measureText(timerText).width;
    pill(ctx, (VIEW.width - timerWidth) / 2 - 10, 118, timerWidth + 20, 26, 8);
    ctx.fillStyle = objective.timer < 15 ? PALETTE.danger : PALETTE.text;
    ctx.fillText(timerText, VIEW.width / 2, 132);
  }

  // Top right: wanted stars and the clock.
  pill(ctx, VIEW.width - 216, 12, 202, 62, 10);
  drawStars(ctx, VIEW.width - 198, 42, state.wanted);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 19px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(formatClock(state.clockMinutes), VIEW.width - 30, 42);

  // Bottom left: the minimap.
  ctx.fillStyle = 'rgba(244, 241, 232, 0.85)';
  ctx.font = `600 11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('SUNBAY CITY', 16, VIEW.height - 158);
  drawMinimap(ctx, state, 14, VIEW.height - 152, 200, 138);

  // Bottom centre: the context prompt.
  if (prompt) {
    ctx.font = `700 16px ${FONT}`;
    const promptWidth = ctx.measureText(prompt).width;
    pill(ctx, (VIEW.width - promptWidth) / 2 - 16, VIEW.height - 52, promptWidth + 32, 34, 10);
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'center';
    ctx.fillText(prompt, VIEW.width / 2, VIEW.height - 34);
  }

  // Bottom right: the controls hint, right-aligned with a clear margin so it never
  // touches an edge. It stays right-aligned (not centred) because the context prompt
  // pill sits bottom-centre and a centred hint would run straight through it.
  ctx.font = `500 12px ${FONT}`;
  ctx.fillStyle = 'rgba(244, 241, 232, 0.75)';
  ctx.textAlign = 'right';
  ctx.fillText('WASD move · E enter car · F punch · Click shoot · P pause · M mute', VIEW.width - 14, VIEW.height - 14);

  // The mission toast, centre screen, fading.
  if (state.mission.toastTime > 0 && state.mission.toast) {
    ctx.globalAlpha = Math.min(1, state.mission.toastTime);
    ctx.font = `700 22px ${FONT}`;
    const toastWidth = ctx.measureText(state.mission.toast).width;
    pill(ctx, (VIEW.width - toastWidth) / 2 - 18, 200, toastWidth + 36, 44, 11);
    ctx.fillStyle = PALETTE.gold;
    ctx.textAlign = 'center';
    ctx.fillText(state.mission.toast, VIEW.width / 2, 223);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function overlay(ctx, title, lines, prompt) {
  ctx.save();
  ctx.fillStyle = 'rgba(10, 12, 18, 0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText(title, VIEW.width / 2, 240);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `500 20px ${FONT}`;
  lines.forEach((line, index) => {
    ctx.fillText(line, VIEW.width / 2, 300 + index * 32);
  });
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 17px ${FONT}`;
  ctx.fillText(prompt, VIEW.width / 2, 300 + lines.length * 32 + 30);
  ctx.restore();
}

export function drawScreen(ctx, state, screen, hasSave) {
  if (screen === SCREEN_TITLE) {
    overlay(ctx, 'SUNBAY CITY', [
      'A sun-soaked open-world crime story.',
      'Meet Marta. Steal the sports car. Run the package. Rob the marina.',
      'On foot and by car — the Sunbay PD is always watching.',
    ], hasSave ? 'ENTER — Continue your story' : 'ENTER or click — Start');
    return;
  }
  if (screen === SCREEN_PAUSED) {
    overlay(ctx, 'PAUSED', ['Take a breath. Sunbay waits.'], 'P or ENTER — Resume');
    return;
  }
  if (screen === SCREEN_BUSTED) {
    overlay(ctx, 'BUSTED', ['The Sunbay PD caught you.', 'Fine: $50. The story continues.'], 'ENTER — Back on the streets');
    return;
  }
  if (screen === SCREEN_WASTED) {
    overlay(ctx, 'WASTED', ['Sunbay is not kind to the careless.', 'Fine: $100. The story continues.'], 'ENTER — Back on the streets');
    return;
  }
  if (screen === SCREEN_STORY) {
    overlay(ctx, 'SUNBAY CITY', [
      'All four missions done. Rook owns these streets now.',
      `Cash: $${state.player.money} · Cars stolen: ${state.stats.stolen} · Times busted: ${state.stats.busted}`,
    ], 'ENTER — Keep roaming free');
  }
}
