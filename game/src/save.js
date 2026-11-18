// Saving: the mission index, cash, health and position, in this browser's local storage.
// The save is written AFTER the mission index moves (completeMission), never before it.
import { SAVE_KEY } from './config.js';

export function writeSave(state) {
  try {
    const player = state.player;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      missionIndex: state.mission.index,
      money: player.money,
      health: player.health,
      x: player.x,
      y: player.y,
      pistol: player.pistol,
      clockMinutes: state.clockMinutes,
    }));
  } catch {
    // Storage can be off (private windows): the run then lasts this visit only.
  }
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
