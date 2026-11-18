// Keyboard and mouse. takeActions() is called exactly once per frame by the loop and returns
// the action bits pressed since the last call; reading it twice would swallow presses.
import { VIEW } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_MUTE = 32;

export function createInput(canvas) {
  const keys = new Set();
  let pending = 0;
  const mouse = { x: VIEW.width / 2, y: VIEW.height / 2, down: false };

  function keyDown(event) {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(key);
    if (key === 'enter' || key === ' ') pending |= ACTION_CONFIRM;
    if (key === 'p' || key === 'escape') pending |= ACTION_PAUSE;
    if (key === 'e') pending |= ACTION_INTERACT;
    if (key === 'f') pending |= ACTION_PUNCH;
    if (key === 'm') pending |= ACTION_MUTE;
  }

  function keyUp(event) {
    keys.delete(event.key.toLowerCase());
  }

  function mouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * VIEW.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * VIEW.height;
  }

  function mouseDown(event) {
    mouseMove(event);
    mouse.down = true;
    if (event.button === 0) pending |= ACTION_SHOOT;
  }

  function mouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mousedown', mouseDown);
  window.addEventListener('mouseup', mouseUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function held(...names) {
    return names.some((name) => keys.has(name));
  }

  return {
    /** WASD/arrows as a unit vector; empty when no movement key is held. */
    direction() {
      const x = (held('d', 'arrowright') ? 1 : 0) - (held('a', 'arrowleft') ? 1 : 0);
      const y = (held('s', 'arrowdown') ? 1 : 0) - (held('w', 'arrowup') ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    throttle() {
      return (held('w', 'arrowup') ? 1 : 0) - (held('s', 'arrowdown') ? 1 : 0);
    },
    steer() {
      return (held('a', 'arrowleft') ? 1 : 0) - (held('d', 'arrowright') ? 1 : 0);
    },
    run() {
      return held('shift');
    },
    mouse: () => mouse,
    takeActions() {
      const actions = pending;
      pending = 0;
      return actions;
    },
  };
}
