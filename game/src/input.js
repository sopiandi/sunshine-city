// Sunshine City — keyboard, mouse and touch input.
// Desktop: WASD/arrows, Shift run, E car, R reload, Space shoot,
// P/Esc pause, M mute, N new game, Q quit. Touch: virtual joystick on
// the left, SHOOT / CAR / RELOAD / PAUSE buttons (>=44px) on the right,
// shown on any touch screen — detected several ways, with a first-touch
// fallback (v4). Written fresh in this session (v3, touch reworked v4).
import { clamp } from "./config.js";

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.mouseX = 0; this.mouseY = 0; this.mouseDown = false; this.mouseSeen = false;
    this.joy = { active: false, x: 0, y: 0, id: null };
    // v4: detect touch several ways, not just one flag at load — and
    // switch the controls on at the first real touch even if detection
    // missed (some in-app browsers report no touch points until used).
    this.touch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0
      || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches)
      || new URLSearchParams(location.search).get("touch") === "1";
    this.touchUIOn = false;
    this.onShoot = null;      // fn(worldX, worldY)
    this.onEnterCar = null;   // fn()
    this.onReload = null;     // fn()
    this.onPause = null;      // fn()
    this.onConfirm = null;    // fn() Space/Enter on menus
    this.onNewGame = null;
    this.onQuit = null;
    this.onMute = null;
    this.pressed = {};        // edge-triggered keys, consumed by main
    window.addEventListener("keydown", (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.pressed[e.code] = true;
      }
      this.keys[e.code] = true;
    });
    window.addEventListener("keyup", (e) => { this.keys[e.code] = false; });
    window.addEventListener("blur", () => { this.keys = {}; this.mouseDown = false; });
    canvas.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left; this.mouseY = e.clientY - r.top;
      this.mouseSeen = true;
    });
    canvas.addEventListener("mousedown", (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left; this.mouseY = e.clientY - r.top;
      this.mouseDown = true;
      if (this.onShoot) this.onShoot(this.mouseX, this.mouseY);
    });
    window.addEventListener("mouseup", () => { this.mouseDown = false; });
    this.bindTouch();
  }
  // Show the touch controls (idempotent). Called at load when touch is
  // detected, and again on the first real touch anywhere on the page.
  showTouchUI() {
    if (this.touchUIOn) return;
    const ui = document.getElementById("touch-ui");
    if (!ui) return;
    ui.classList.add("on");
    this.touchUIOn = true;
    this.touch = true;
  }
  bindTouch() {
    const ui = document.getElementById("touch-ui");
    if (!ui) return;
    if (this.touch) this.showTouchUI();
    // First-touch fallback: a touch screen that reported no touch
    // points at load still gets its controls the moment it is used.
    window.addEventListener("touchstart", () => this.showTouchUI(), { passive: true });
    const joyZone = document.getElementById("joy-zone");
    const knob = document.getElementById("joy-knob");
    if (!joyZone || !knob) return;
    const setKnob = (dx, dy) => {
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    joyZone.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.showTouchUI();
      const t = e.changedTouches[0];
      this.joy.active = true; this.joy.id = t.identifier;
      this.joy.cx = t.clientX; this.joy.cy = t.clientY;
      this.joy.x = 0; this.joy.y = 0;
    }, { passive: false });
    joyZone.addEventListener("touchmove", (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this.joy.id) continue;
        let dx = (t.clientX - this.joy.cx) / 45;
        let dy = (t.clientY - this.joy.cy) / 45;
        const len = Math.hypot(dx, dy);
        if (len > 1) { dx /= len; dy /= len; }
        this.joy.x = dx; this.joy.y = dy;
        setKnob(dx * 34, dy * 34);
      }
    }, { passive: false });
    const endJoy = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) {
          this.joy.active = false; this.joy.id = null;
          this.joy.x = 0; this.joy.y = 0; setKnob(0, 0);
        }
      }
    };
    joyZone.addEventListener("touchend", endJoy);
    joyZone.addEventListener("touchcancel", endJoy);
    const tap = (id, fn) => {
      const el = document.getElementById(id);
      if (!el) return;
      // touchstart fires the action; the click is swallowed so a tap
      // never double-fires, and a mouse click still works on desktop.
      el.addEventListener("touchstart", (e) => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false });
      el.addEventListener("click", (e) => { e.preventDefault(); });
    };
    tap("btn-shoot", () => { if (this.onShoot) this.onShoot(null, null); });
    tap("btn-car", () => { if (this.onEnterCar) this.onEnterCar(); });
    tap("btn-reload", () => { if (this.onReload) this.onReload(); });
    tap("btn-pause", () => { if (this.onPause) this.onPause(); });
    // Tap on the canvas (not on a button) shoots toward that point.
    this.canvas.addEventListener("touchstart", (e) => {
      const t = e.changedTouches[0];
      const r = this.canvas.getBoundingClientRect();
      if (this.onShoot) this.onShoot(t.clientX - r.left, t.clientY - r.top);
    }, { passive: true });
  }
  // Movement vector: {x, y} in screen space (y down). Keyboard or joystick.
  moveVec() {
    if (this.joy.active && (this.joy.x !== 0 || this.joy.y !== 0)) {
      return { x: this.joy.x, y: this.joy.y };
    }
    let x = 0, y = 0;
    if (this.keys.KeyA || this.keys.ArrowLeft) x -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) x += 1;
    if (this.keys.KeyW || this.keys.ArrowUp) y -= 1;
    if (this.keys.KeyS || this.keys.ArrowDown) y += 1;
    const len = Math.hypot(x, y);
    if (len > 0) { x /= len; y /= len; }
    return { x, y };
  }
  running() { return !!(this.keys.ShiftLeft || this.keys.ShiftRight); }
  consume(code) {
    if (this.pressed[code]) { this.pressed[code] = false; return true; }
    return false;
  }
  clearPressed() { this.pressed = {}; }
}
