// Keyboard and mouse input for Sunshine City, plus v2 (B1) touch controls.
// Held keys give movement and driving; one-shot presses (enter a car,
// reload, pause, confirm) are queued as flags and taken once by the loop,
// so a press between frames is never lost and never counted twice. The
// mouse position is kept in 1280x720 view coordinates; the caller turns it
// into a world aim point.
//
// Touch: on a touch device the overlay (#touch) appears — a virtual
// joystick bottom-left (8-way; pushed far = run / full gas) and SHOOT /
// CAR / R / pause buttons bottom-right. SHOOT fires toward where the
// player faces; tapping the canvas itself aims + shoots at that point.
// Desktop is untouched: the overlay stays hidden and the mouse rules v1.
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

  // --- touch state -------------------------------------------------------
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  let stickX = 0;
  let stickY = 0;
  let stickMag = 0;
  let touchShoot = false;
  let tapAim = null;
  let tapAimTimer = 0;

  function toView(event) {
    const rect = target.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * VIEW.width;
    mouseY = ((event.clientY - rect.top) / rect.height) * VIEW.height;
  }

  function bindButton(id, press, release) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      press();
    });
    el.addEventListener('pointerup', (event) => {
      event.preventDefault();
      if (release) release();
    });
    el.addEventListener('pointercancel', () => { if (release) release(); });
    el.addEventListener('pointerleave', () => { if (release) release(); });
  }

  function setupTouch() {
    const overlay = document.getElementById('touch');
    if (!overlay) return;
    overlay.classList.add('on');
    const stick = document.getElementById('stick');
    const knob = document.getElementById('knob');
    let stickId = null;
    function stickMove(event) {
      const rect = stick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = (event.clientX - cx) / (rect.width / 2);
      let dy = (event.clientY - cy) / (rect.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      stickX = dx;
      stickY = dy;
      stickMag = Math.min(1, len);
      knob.style.left = `${38 + dx * 34}px`;
      knob.style.top = `${38 + dy * 34}px`;
    }
    function stickEnd() {
      stickId = null;
      stickX = 0; stickY = 0; stickMag = 0;
      knob.style.left = '38px';
      knob.style.top = '38px';
    }
    stick.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      stickId = event.pointerId;
      stick.setPointerCapture(event.pointerId);
      stickMove(event);
    });
    stick.addEventListener('pointermove', (event) => {
      if (event.pointerId === stickId) stickMove(event);
    });
    stick.addEventListener('pointerup', stickEnd);
    stick.addEventListener('pointercancel', stickEnd);
    bindButton('btn-shoot', () => { touchShoot = true; }, () => { touchShoot = false; });
    bindButton('btn-car', () => { actions |= ACTION_ENTER; });
    bindButton('btn-reload', () => { actions |= ACTION_RELOAD; });
    bindButton('btn-pause', () => { actions |= ACTION_PAUSE; });
  }
  if (isTouch) setupTouch();

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
    touchShoot = false; stickX = 0; stickY = 0; stickMag = 0;
  });
  target.addEventListener('pointermove', toView);
  target.addEventListener('pointerdown', (event) => {
    toView(event);
    mouseDown = true;
    if (event.pointerType === 'touch') {
      // Tap on the world: aim + shoot at that point for a short burst.
      tapAim = { x: mouseX, y: mouseY };
      tapAimTimer = 0.6;
    }
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });

  return {
    isTouch,
    snapshot() {
      // Joystick overrides the keys while it is pushed.
      const jUp = stickMag > 0.25 && stickY < -0.3;
      const jDown = stickMag > 0.25 && stickY > 0.3;
      const jLeft = stickMag > 0.25 && stickX < -0.3;
      const jRight = stickMag > 0.25 && stickX > 0.3;
      if (tapAimTimer > 0) tapAimTimer -= 1 / 60;
      else tapAim = null;
      return {
        up: up || jUp, down: down || jDown, left: left || jLeft, right: right || jRight,
        run: run || stickMag > 0.85,
        shooting: mouseDown || spaceHeld || touchShoot || tapAim !== null,
        touchFire: touchShoot,
        mouseX, mouseY, tapAim,
      };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
