// Saving: the player's cash, health, mission progress, position and clock, kept in this
// browser's localStorage. Nothing leaves the machine; a failed write just means this visit
// only (private windows can refuse storage).
import { SAVE_KEY } from './config.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    const data = {
      money: state.player.money,
      health: state.player.health,
      missionIndex: state.missions.index,
      missionStep: state.missions.step,
      hasPistol: state.player.hasPistol,
      x: state.player.x,
      y: state.player.y,
      clockMinutes: state.clockMinutes,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
