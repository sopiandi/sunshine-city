// Keyboard and mouse input for Sunshine City. Held keys give movement and
// driving; one-shot presses (enter a car, reload, pause, confirm) are queued
// as flags and taken once by the loop, so a press between frames is never
// lost and never counted twice. The mouse position is kept in 1280x720
// view coordinates; the caller turns it into a world aim point.
import { VIEW } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_RELOAD = 8;
export const ACTION_MUTE = 16;
export const ACTION_NEW = 32;
export const ACTION_QUIT = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter', 'Space']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let run = false;
  let spaceHeld = false;
  let mouseDown = false;
  let mouseX = VIEW.width / 2;
  let mouseY = VIEW.height / 2;
  let actions = 0;

  function toView(event) {
    const rect = target.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * VIEW.width;
    mouseY = ((event.clientY - rect.top) / rect.height) * VIEW.height;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') run = true;
    else if (CONFIRM.has(event.code)) {
      spaceHeld = event.code === 'Space';
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyE') {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (event.code === 'KeyR') {
      if (!event.repeat) actions |= ACTION_RELOAD;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (event.code === 'KeyN') {
      if (!event.repeat) actions |= ACTION_NEW;
    } else if (event.code === 'KeyQ') {
      if (!event.repeat) actions |= ACTION_QUIT;
    } else return;
    if (event.code !== 'F5') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') run = false;
    else if (event.code === 'Space') spaceHeld = false;
  });
  window.addEventListener('blur', () => {
    up = false; down = false; left = false; right = false; run = false; spaceHeld = false; mouseDown = false;
  });
  target.addEventListener('pointermove', toView);
  target.addEventListener('pointerdown', (event) => {
    toView(event);
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });

  return {
    snapshot() {
      return { up, down, left, right, run, shooting: mouseDown || spaceHeld, mouseX, mouseY };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
