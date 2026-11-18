// The HUD: health, cash, wanted stars and the clock up top, the mission objective under it,
// context prompts at the bottom, and the transient messages that tell the story. All of it is
// drawn on the canvas in screen space, on top of the world.
import { PALETTE, FONT, VIEW } from './config.js';
import { currentMission, currentStep, missionObjectiveText, missionTarget } from './missions.js';

export function formatClock(minutes) {
  const total = Math.floor(minutes);
  const hour = Math.floor(total / 60) % 24;
  const minute = total % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function drawHud(context, state) {
  const player = state.player;
  context.textBaseline = 'alphabetic';
  // Top-left: health bar and cash.
  context.fillStyle = PALETTE.hudPanel;
  context.beginPath();
  context.roundRect(16, 14, 250, 64, 10);
  context.fill();
  context.fillStyle = '#e8e8e8';
  context.font = `bold 15px ${FONT}`;
  context.textAlign = 'left';
  context.fillText('ROOK', 28, 34);
  context.fillStyle = '#222';
  context.beginPath();
  context.roundRect(28, 42, 150, 14, 7);
  context.fill();
  context.fillStyle = player.health > 35 ? '#5ad86a' : '#ff5a4a';
  context.beginPath();
  context.roundRect(28, 42, 150 * Math.max(0, player.health / 100), 14, 7);
  context.fill();
  context.fillStyle = PALETTE.hudGold;
  context.font = `bold 20px ${FONT}`;
  context.fillText(`$${player.money.toLocaleString('en-US')}`, 188, 57);
  // Top-right: wanted stars and the clock.
  context.fillStyle = PALETTE.hudPanel;
  context.beginPath();
  context.roundRect(VIEW.width - 236, 14, 220, 64, 10);
  context.fill();
  for (let i = 0; i < 5; i += 1) {
    context.fillStyle = i < state.wanted ? '#ffd34d' : 'rgba(255,255,255,0.22)';
    context.font = '26px sans-serif';
    context.textAlign = 'center';
    context.fillText('★', VIEW.width - 206 + i * 34, 52);
  }
  context.fillStyle = PALETTE.hudText;
  context.font = `bold 20px ${FONT}`;
  context.textAlign = 'right';
  context.fillText(formatClock(state.clockMinutes), VIEW.width - 28, 57);
  // Mission objective, top centre.
  const mission = currentMission(state.missions);
  const step = currentStep(state.missions);
  if (mission && step) {
    const text = missionObjectiveText(state.missions);
    context.font = `bold 17px ${FONT}`;
    const width = context.measureText(text).width + 36;
    context.fillStyle = PALETTE.hudPanel;
    context.beginPath();
    context.roundRect((VIEW.width - width) / 2, 14, width, 40, 10);
    context.fill();
    context.fillStyle = PALETTE.objective;
    context.textAlign = 'center';
    context.fillText(text, VIEW.width / 2, 40);
    const target = missionTarget(state.missions, state);
    if (target) {
      const dist = Math.round(Math.hypot(player.x - target.x, player.y - target.y));
      const lines = [`${dist}m`];
      if (state.missions.timer > 0) lines.push(`TIME ${Math.ceil(state.missions.timer)}s`);
      context.font = `15px ${FONT}`;
      const lineWidth = Math.max(...lines.map((line) => context.measureText(line).width));
      context.fillStyle = PALETTE.hudPanel;
      context.beginPath();
      context.roundRect(VIEW.width / 2 - lineWidth / 2 - 16, 58, lineWidth + 32, 22 + (lines.length - 1) * 22, 9);
      context.fill();
      context.textAlign = 'center';
      lines.forEach((line, i) => {
        context.fillStyle = i === 1 && state.missions.timer < 20 ? '#ff5a4a' : PALETTE.hudText;
        context.fillText(line, VIEW.width / 2, 74 + i * 22);
      });
    }
  }
  // Transient message, centre.
  if (state.messageTimer > 0 && state.message) {
    context.globalAlpha = Math.min(1, state.messageTimer);
    context.font = `bold 19px ${FONT}`;
    const width = context.measureText(state.message).width + 40;
    context.fillStyle = PALETTE.hudPanel;
    context.beginPath();
    context.roundRect((VIEW.width - width) / 2, 108, width, 42, 10);
    context.fill();
    context.fillStyle = PALETTE.hudText;
    context.textAlign = 'center';
    context.fillText(state.message, VIEW.width / 2, 136);
    context.globalAlpha = 1;
  }
  // Context prompt, bottom centre.
  if (state.prompt) {
    context.font = `bold 17px ${FONT}`;
    const width = context.measureText(state.prompt).width + 36;
    context.fillStyle = PALETTE.hudPanel;
    context.beginPath();
    context.roundRect((VIEW.width - width) / 2, VIEW.height - 52, width, 36, 10);
    context.fill();
    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.fillText(state.prompt, VIEW.width / 2, VIEW.height - 28);
  }
  // Controls reminder, bottom-right, small.
  context.fillStyle = 'rgba(245,239,224,0.75)';
  context.font = `13px ${FONT}`;
  context.textAlign = 'right';
  context.fillText('WASD move/drive · E enter car · F punch · Click shoot · P pause · M mute', VIEW.width - 16, VIEW.height - 14);
}
