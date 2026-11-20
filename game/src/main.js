// Sunshine City — game loop, screens and the debug API.
// Written fresh in this session for the v3 rebuild.
import { WORLD_W, WORLD_H, START_AMMO, START_RESERVE, clamp } from "./config.js";
import { SPAWN, STARTER_CAR } from "./city.js";
import { SoundEngine } from "./audio.js";
import { Input } from "./input.js";
import { readSave, writeSave, saveSummary } from "./save.js";
import {
  newGameState, updateWorld, shoot, enterCar, damagePlayer,
  wantedCopCount, addWanted,
} from "./world.js";
import { drawWorld, drawHUD } from "./render.js";
import { missionTarget, MISSIONS, enterStage, updateMissions } from "./missions.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const sound = new SoundEngine();
const input = new Input(canvas);

let S = newGameState();
let last = performance.now();

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

function show(id) {
  for (const el of document.querySelectorAll(".screen")) el.classList.remove("show");
  const el = document.getElementById(id);
  if (el) el.classList.add("show");
}
function refreshStartScreen() {
  const sum = saveSummary();
  const cont = document.getElementById("btn-continue");
  const info = document.getElementById("save-info");
  if (sum && cont && info) {
    cont.style.display = "block";
    info.textContent = `Continue — Mission ${sum.mission} of 5 · $${sum.money} · saved ${sum.time}`;
  } else if (cont && info) {
    cont.style.display = "none";
    info.textContent = "No save yet — start a new story.";
  }
}

function startGame(fresh) {
  if (fresh) {
    S = newGameState();
  } else {
    const save = readSave();
    if (!save) { S = newGameState(); }
    else {
      S = newGameState();
      S.player.x = save.x; S.player.y = save.y; S.player.hp = save.hp;
      S.money = save.money; S.missionIndex = save.missionIndex; S.stage = save.stage;
      S.ammo = save.ammo; S.reserve = save.reserve; S.wanted = save.wanted;
      S.lastCrime = S.time - 40; // the trail is already cold-ish on load
      if (save.inCar && save.car) {
        const car = {
          kind: "stolen", x: save.car.x, y: save.car.y, angle: save.car.angle,
          speed: 0, color: save.car.color, hp: save.car.hp, driven: true,
          cruise: 0, hitCd: 0, road: null, line: 0, dir: 1, next: 0, claim: null, brake: 0,
        };
        S.cars.push(car);
        S.car = car;
        S.inCar = true;
        S.player.x = car.x; S.player.y = car.y; S.player.angle = car.angle;
      }
      S.camera.x = S.player.x; S.camera.y = S.player.y;
    }
  }
  S.mode = "play";
  show("");
  sound.ensure();
  sound.startMusic();
  sound.startEngine();
}

function pauseGame() {
  if (S.mode !== "play") return;
  S.mode = "pause";
  writeSave(S);
  document.getElementById("pause-info").textContent =
    `Mission ${Math.min(S.missionIndex + 1, 5)} of 5 · $${S.money} · saved just now`;
  show("screen-pause");
}
function resumeGame() {
  if (S.mode !== "pause") return;
  S.mode = "play";
  show("");
}
function quitToMenu() {
  if (S.mode === "play") writeSave(S);
  S.mode = "start";
  refreshStartScreen();
  show("screen-start");
}

// ---- input wiring ----
input.onShoot = (sx, sy) => {
  if (S.mode === "dead") { respawn(); return; }
  if (S.mode === "done") { S.mode = "play"; show(""); return; }
  if (S.mode !== "play") return;
  sound.ensure();
  if (sx === null || sx === undefined) {
    shoot(S, null, null, sound); // touch button: fire along facing
  } else {
    const wx = S.camera.x + (sx - window.innerWidth / 2);
    const wy = S.camera.y + (sy - window.innerHeight / 2);
    shoot(S, wx, wy, sound);
  }
};
input.onEnterCar = () => {
  if (S.mode !== "play") return;
  enterCar(S, sound);
};
input.onReload = () => {
  if (S.mode !== "play") return;
  if (S.ammo < START_AMMO && S.reserve > 0 && S.reloadT <= 0) S.reloadT = 0.9;
};
input.onPause = () => {
  if (S.mode === "play") pauseGame();
  else if (S.mode === "pause") resumeGame();
};
input.onMute = () => {
  S.muted = !S.muted;
  sound.setMuted(S.muted);
};
input.onNewGame = () => {
  if (S.mode === "pause" || S.mode === "dead" || S.mode === "start") startGame(true);
};
input.onQuit = () => {
  if (S.mode === "play" || S.mode === "pause") quitToMenu();
};

document.getElementById("btn-new").addEventListener("click", () => startGame(true));
document.getElementById("btn-continue").addEventListener("click", () => startGame(false));
document.getElementById("btn-resume").addEventListener("click", resumeGame);
document.getElementById("btn-restart").addEventListener("click", () => startGame(true));
document.getElementById("btn-quit").addEventListener("click", quitToMenu);
document.getElementById("btn-respawn").addEventListener("click", respawn);
document.getElementById("btn-roam").addEventListener("click", () => { S.mode = "play"; show(""); });

function respawn() {
  S.player.x = SPAWN.x; S.player.y = SPAWN.y;
  S.player.hp = 100;
  S.wanted = 0;
  S.lastCrime = S.time;
  if (S.inCar && S.car) { S.car.driven = false; S.car = null; S.inCar = false; }
  S.camera.x = SPAWN.x; S.camera.y = SPAWN.y;
  S.mode = "play";
  show("");
}

// ---- main loop ----
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (S.mode === "play") {
    if (input.consume("KeyE")) enterCar(S, sound);
    if (input.consume("KeyR")) input.onReload();
    if (input.consume("Space")) input.onShoot(null, null);
    if (input.consume("KeyP") || input.consume("Escape")) pauseGame();
    if (input.consume("KeyM")) input.onMute();
    if (input.consume("KeyN")) input.onNewGame();
    if (input.consume("KeyQ")) input.onQuit();
    updateWorld(S, dt, input, sound);
    updateMissions(S, sound);
    if (S.mode === "dead") {
      document.getElementById("dead-info").textContent =
        `You went down in ${MISSIONS[Math.min(S.missionIndex, 4)].name}. The clinic patched you up.`;
      show("screen-dead");
    }
    if (S.missionIndex >= MISSIONS.length && S.mode === "play" && !S.storyShown) {
      // Story finished once: show the wrap screen, then free roam.
      S.storyShown = true;
      S.mode = "done";
      show("screen-done");
    }
  } else if (S.mode === "pause") {
    if (input.consume("KeyP") || input.consume("Escape")) resumeGame();
    if (input.consume("KeyM")) input.onMute();
    if (input.consume("KeyN")) input.onNewGame();
    if (input.consume("KeyQ")) input.onQuit();
  } else if (S.mode === "dead") {
    if (input.consume("Space")) respawn();
    if (input.consume("KeyN")) input.onNewGame();
  } else if (S.mode === "done") {
    if (input.consume("Space")) { S.mode = "play"; show(""); }
    if (input.consume("KeyN")) input.onNewGame();
    if (input.consume("KeyQ")) input.onQuit();
  }
  input.clearPressed();
  render();
}

function render() {
  const W = window.innerWidth, H = window.innerHeight;
  ctx.clearRect(0, 0, W, H);
  // Camera: keep the player centred, clamped to the world.
  const camX = clamp(S.camera.x, W / 2, WORLD_W - W / 2);
  const camY = clamp(S.camera.y, H / 2, WORLD_H - H / 2);
  const view = {
    x0: camX - W / 2, y0: camY - H / 2,
    x1: camX + W / 2, y1: camY + H / 2,
  };
  ctx.save();
  ctx.translate(W / 2 - camX, H / 2 - camY);
  drawWorld(ctx, S, view);
  ctx.restore();
  if (S.mode === "play" || S.mode === "pause" || S.mode === "dead" || S.mode === "done") {
    drawHUD(ctx, S, W, H, input);
  }
  // Aim line from the player toward the mouse (desktop only, once the
  // mouse has actually moved — never a stray line to the corner).
  if (S.mode === "play" && !input.touch && !S.inCar && input.mouseSeen) {
    const wx = camX + (input.mouseX - W / 2);
    const wy = camY + (input.mouseY - H / 2);
    if (dist2(input.mouseX - W / 2, input.mouseY - H / 2) > 30) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(S.player.x - (camX - W / 2), S.player.y - (camY - H / 2));
      ctx.lineTo(wx - (camX - W / 2), wy - (camY - H / 2));
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = "#fff";
      ctx.beginPath();
      ctx.arc(wx - (camX - W / 2), wy - (camY - H / 2), 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
function dist2(x, y) { return Math.hypot(x, y); }

// ---- debug / test API (used by the local harness and screenshots) ----
function snapshot() {
  const tgt = missionTarget(S);
  return {
    mode: S.mode,
    x: Math.round(S.player.x), y: Math.round(S.player.y),
    traffic: S.cars.filter((c) => c.kind === "traffic").length,
    peds: S.peds.filter((p) => !p.dead).length,
    inCar: S.inCar,
    carColor: S.inCar && S.car ? S.car.color : null,
    wanted: S.wanted,
    missionIndex: S.missionIndex,
    money: S.money,
    ammo: S.ammo,
    hp: Math.round(S.player.hp),
    carHp: S.inCar && S.car ? Math.round(S.car.hp) : null,
    cops: S.cops.length,
    distance: tgt ? Math.round(Math.hypot(S.player.x - tgt.x, S.player.y - tgt.y)) : 0,
  };
}
function teleport(x, y) {
  S.player.x = x; S.player.y = y;
  if (S.inCar && S.car) {
    S.car.x = x; S.car.y = y; S.car.speed = 0;
    S.player.angle = S.car.angle;
  }
  S.camera.x = x; S.camera.y = y;
}
function setWanted(n) {
  S.wanted = n;
  S.lastCrime = S.time;
  S.starsFlash = 1.4;
  // Force cop + roadblock maintenance right away.
  while (S.cops.length < wantedCopCount(n)) {
    const before = S.cops.length;
    // Reuse the world's spawn by bumping the count through updateCops.
    S.cops.push({ kind: "cop", x: S.player.x + 500, y: S.player.y, angle: 0, speed: 0, cruise: 300, color: "#23272e", hp: 100, driven: false, hitCd: 0, shootCd: 1, road: null, line: 0, dir: 1, next: 0, claim: null, brake: 0 });
    S.cars.push(S.cops[S.cops.length - 1]);
    if (S.cops.length === before) break;
  }
  if (n >= 4) {
    S.roadblocks = [];
    const spots = [
      { x: S.player.x + 380, y: S.player.y - 120 },
      { x: S.player.x - 320, y: S.player.y + 200 },
      { x: S.player.x + 100, y: S.player.y + 380 },
    ];
    for (const s of spots) {
      S.roadblocks.push({ x: clamp(s.x, 200, WORLD_W - 200), y: clamp(s.y, 200, WORLD_H - 200), angle: 0.6 });
    }
  } else {
    S.roadblocks = [];
  }
}
function pose(name) {
  const fresh = newGameState();
  fresh.mode = "play";
  show("");
  S = fresh;
  if (name === "street") {
    // On foot by the clinic: traffic, peds, district sign.
    teleport(SPAWN.x, SPAWN.y);
  } else if (name === "marina") {
    // In the car at the Marina Bay mission target, mission 1 already banked.
    S.missionIndex = 1; S.stage = 0; S.money = 200;
    const car = S.cars[0];
    car.x = 760; car.y = 1840; car.angle = -Math.PI / 2;
    S.inCar = true; S.car = car; car.driven = true;
    S.player.x = car.x; S.player.y = car.y; S.player.angle = car.angle;
    teleport(760, 1840);
  } else if (name === "chase") {
    // Police chase, wanted 3, mission running.
    const car = S.cars[0];
    car.x = 1200; car.y = 1400; car.angle = Math.PI / 2;
    S.inCar = true; S.car = car; car.driven = true;
    S.player.x = car.x; S.player.y = car.y; S.player.angle = car.angle;
    S.missionIndex = 0; S.stage = 1;
    setWanted(3);
    for (const c of S.cops) { c.x = S.player.x + 260; c.y = S.player.y - 180; }
    teleport(1200, 1400);
  } else if (name === "docks") {
    // Old Docks at wanted 2, on foot near the warehouse.
    teleport(2050, 1650);
    setWanted(2);
    for (const c of S.cops) { c.x = S.player.x + 300; c.y = S.player.y + 120; }
  }
  S.camera.x = S.player.x; S.camera.y = S.player.y;
  S.msg = null; // clean frame for the shot — no toast over the scene
}

window.SUNSHINE = {
  state: null, // replaced below with a live getter
  snapshot, teleport, start: startGame, setWanted, target: () => missionTarget(S), pose,
};
Object.defineProperty(window.SUNSHINE, "state", { get: () => S });

// ---- boot ----
refreshStartScreen();
if (new URLSearchParams(location.search).get("autostart") === "1") {
  startGame(true);
} else {
  show("screen-start");
}
requestAnimationFrame(frame);
