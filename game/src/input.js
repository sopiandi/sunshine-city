// Sunshine City v3 — keyboard, mouse and touch input.
// Touch: virtual joystick (left) + big buttons (right), shown only on
// touch devices. Tap the screen to shoot.
export function makeInput(canvas) {
  const inp = {
    up: false, down: false, left: false, right: false, run: false,
    joyActive: false, joyX: 0, joyY: 0,
    mouseX: 0, mouseY: 0, mouseDown: false,
    pressed: {}, // edge-triggered keys, consumed by the game loop
    isTouch: false,
  };
  const keyMap = {
    KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down",
    KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right",
    ShiftLeft: "run", ShiftRight: "run",
  };
  window.addEventListener("keydown", (e) => {
    if (keyMap[e.code] !== undefined) { inp[keyMap[e.code]] = true; e.preventDefault(); }
    if (!e.repeat) inp.pressed[e.code] = true;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    if (keyMap[e.code] !== undefined) inp[keyMap[e.code]] = false;
  });
  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    inp.mouseX = e.clientX - r.left; inp.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener("mousedown", (e) => {
    inp.mouseDown = true;
    const r = canvas.getBoundingClientRect();
    inp.mouseX = e.clientX - r.left; inp.mouseY = e.clientY - r.top;
    inp.pressed["Mouse"] = true;
  });
  window.addEventListener("mouseup", () => { inp.mouseDown = false; });

  // ---- touch joystick + buttons ----
  const joy = document.getElementById("joy");
  const knob = document.getElementById("joy-knob");
  const touchUI = document.getElementById("touch-ui");
  let joyId = null, joyCX = 0, joyCY = 0;
  function showTouch() {
    if (inp.isTouch) return;
    inp.isTouch = true;
    if (touchUI) touchUI.classList.add("on");
  }
  window.addEventListener("touchstart", showTouch, { passive: true });
  if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) showTouch();

  function joyMove(t) {
    const dx = t.clientX - joyCX, dy = t.clientY - joyCY;
    const len = Math.hypot(dx, dy) || 1;
    const cl = Math.min(len, 52);
    inp.joyX = (dx / len) * (cl / 52);
    inp.joyY = (dy / len) * (cl / 52);
    if (knob) knob.style.transform = "translate(" + inp.joyX * 52 + "px," + inp.joyY * 52 + "px)";
  }
  if (joy) {
    joy.addEventListener("touchstart", (e) => {
      e.preventDefault();
      showTouch();
      const t = e.changedTouches[0];
      joyId = t.identifier;
      const r = joy.getBoundingClientRect();
      joyCX = r.left + r.width / 2; joyCY = r.top + r.height / 2;
      inp.joyActive = true;
      joyMove(t);
    }, { passive: false });
  }
  window.addEventListener("touchmove", (e) => {
    if (joyId === null) return;
    for (const t of e.changedTouches) if (t.identifier === joyId) { joyMove(t); e.preventDefault(); }
  }, { passive: false });
  window.addEventListener("touchend", (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        joyId = null; inp.joyActive = false; inp.joyX = 0; inp.joyY = 0;
        if (knob) knob.style.transform = "translate(0px,0px)";
      }
    }
  });
  // Tap on the canvas (not on a button) shoots.
  canvas.addEventListener("touchstart", (e) => {
    showTouch();
    const t = e.changedTouches[0];
    const r = canvas.getBoundingClientRect();
    inp.mouseX = t.clientX - r.left; inp.mouseY = t.clientY - r.top;
    inp.pressed["Mouse"] = true;
  }, { passive: true });

  // Touch buttons: data-key maps to a pressed code.
  document.querySelectorAll("#touch-ui [data-key]").forEach((btn) => {
    btn.addEventListener("touchstart", (e) => {
      e.preventDefault(); e.stopPropagation();
      showTouch();
      inp.pressed[btn.getAttribute("data-key")] = true;
    }, { passive: false });
  });
  return inp;
}

export function consumePress(inp, code) {
  if (inp.pressed[code]) { delete inp.pressed[code]; return true; }
  return false;
}
export function clearPresses(inp) { inp.pressed = {}; }
