// Sunshine City v3 — game loop, shooting, wanted, save/load, screens.
// Debug API for the local acceptance harness: window.SUNSHINE.
import { WORLD, SPAWN, SAVE_KEY, START_AMMO, START_RESERVE, MISSIONS } from "./config.js";
import { clamp, dist, fmtMoney, fmtClock } from "./random.js";
import { buildCity, pointInBuilding } from "./city.js";
import { SoundBank } from "./audio.js";
import { makeInput, consumePress } from "./input.js";
import { makeWorld, makeCar, nearestCar, updatePlayer, updateDriving, updateTraffic, updatePeds, updatePolice } from "./world.js";
import { missionTarget, missionDistance, updateMissions, setupMission, missionDef } from "./missions.js";
import { drawWorld } from "./render.js";
import { poseChase, poseStreet, poseMarina, poseDocks } from "./shots.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const city = buildCity();
const sound = new SoundBank();
const input = makeInput(canvas);

let S = makeWorld();
let view = { w: 1280, h: 800 };
let lastT = 0;
let shootCooldown = 0;
let musicStarted = false;

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  view.w = window.innerWidth; view.h = window.innerHeight;
  canvas.width = Math.floor(view.w * dpr);
  canvas.height = Math.floor(view.h * dpr);
  canvas.style.width = view.w + "px";
  canvas.style.height = view.h + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

function show(id, on) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("hidden", !on);
}

function banner(text, dur) {
  S.banner = text; S.bannerT = dur || 3;
}
function floatText(text, x, y, color) {
  S.floats.push({ text, x, y, color: color || "#ffffff", t: 1.6 });
}
function witnessNear(x, y, radius, exclude) {
  let saw = false;
  for (const ped of S.peds) {
    if (ped.dead || ped.down > 0 || ped.foe || ped === exclude) continue;
    if (dist(ped.x, ped.y, x, y) < radius) { ped.panic = 4; saw = true; }
  }
  return saw;
}

function addWanted(n, text) {
  if (n <= 0) return;
  S.wanted = Math.min(5, S.wanted + n);
  S.wantedFlash = 2.5;
  S.lastCrime = S.time;
  if (text) floatText(text, S.player.x, S.player.y - 30, "#ffd23a");
}

const hooks = {
  cityBuildings: city.buildings,
  onCrash(dmg, x, y) {
    sound.crash();
    S.shake = Math.min(0.6, S.shake + 0.35);
    floatText("-" + Math.round(dmg) + " car", x, y - 24, "#ff8a5a");
  },
  onPlayerHitByTraffic(dmg, car) {
    const p = S.player;
    p.hp = Math.max(0, p.hp - dmg);
    p.hurtT = 1;
    sound.hit();
    S.shake = Math.min(0.6, S.shake + 0.3);
    floatText("-" + Math.round(dmg) + " HP", p.x, p.y - 26, "#ff5a5a");
    if (p.hp <= 0) die();
  },
  onPedKnocked(ped) {
    if (witnessNear(ped.x, ped.y, 320, ped)) addWanted(1, "Witness!");
  },
  onPedKilled(ped) {
    if (ped.foe) { S.foesLeft = Math.max(0, S.foesLeft - 1); }
    if (witnessNear(ped.x, ped.y, 320, ped)) addWanted(1, "Witness!");
  },
  onFoeShot(ped) {
    const p = S.player;
    const d = dist(ped.x, ped.y, p.x, p.y);
    const a = Math.atan2(p.y - ped.y, p.x - ped.x);
    const mx = ped.x + Math.cos(a) * 20, my = ped.y + Math.sin(a) * 20;
    S.effects.push({ kind: "tracer", x0: mx, y0: my, x1: p.x, y1: p.y, t: 0.12 });
    sound.shoot();
    // Enemy fire as a whole can only land one hit per 1.5 s: five shooters
    // must not melt the player in seconds.
    if (d < 380 && S.time - S.lastEnemyHit > 1.5 && Math.random() < (p.inCar ? 0.3 : 0.55)) {
      S.lastEnemyHit = S.time;
      p.hp = Math.max(0, p.hp - (p.inCar ? 2 : 4));
      p.hurtT = 0.6;
      floatText(p.inCar ? "-2 HP" : "-4 HP", p.x, p.y - 26, "#ff5a5a");
      if (p.hp <= 0) die();
    }
  },
  onCopShot(car) {
    const p = S.player;
    const a = Math.atan2(p.y - car.y, p.x - car.x);
    const mx = car.x + Math.cos(a) * 20, my = car.y + Math.sin(a) * 20;
    S.effects.push({ kind: "tracer", x0: mx, y0: my, x1: p.x, y1: p.y, t: 0.12 });
    sound.shoot();
    if (S.time - S.lastEnemyHit > 1.5 && Math.random() < (p.inCar ? 0.25 : 0.6)) {
      S.lastEnemyHit = S.time;
      p.hp = Math.max(0, p.hp - (p.inCar ? 2 : 4));
      p.hurtT = 0.6;
      floatText(p.inCar ? "-2 HP" : "-4 HP", p.x, p.y - 26, "#ff5a5a");
      if (p.hp <= 0) die();
    }
  },
  onSiren() { sound.siren(); },
  onRoadblock() { banner("ROADBLOCK AHEAD", 3); },
  onMissionComplete(m) {
    sound.mission();
    banner("Mission complete! +" + fmtMoney(m.pay), 3.5);
    saveGame();
  },
  onMissionStart(m) { banner("Mission " + (S.missionIndex + 1) + ": " + m.name, 3.5); sound.mission(); },
  onStageAdvance(st) { if (st) banner(st.label, 2.5); },
  onMissionFailed(text) { banner(text, 3.5); },
  onStoryComplete() { banner("Story complete! Sunshine City is yours.", 5); sound.mission(); saveGame(); },
};

function die() {
  if (S.mode !== "play") return;
  S.mode = "dead";
  S.money = Math.max(0, S.money - 100);
  show("dead-screen", true);
  saveGame();
}

function enterCar() {
  const p = S.player;
  if (p.inCar) {
    // Exit the car.
    const car = p.car;
    car.speed = 0;
    p.inCar = false; p.car = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    return;
  }
  const car = nearestCar(S, p.x, p.y, 70, ["parked", "traffic"]);
  if (!car) return;
  if (car.kind === "police") return;
  p.inCar = true; p.car = car;
  car.speed = 0;
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  if (!car.stolen) {
    car.stolen = true;
    S.stats.steals++;
    addWanted(1, "Car taken");
    sound.pickup();
  }
}

function aimAngle() {
  const p = S.player;
  const sx = p.x - (S.cam.x - view.w / 2), sy = p.y - (S.cam.y - view.h / 2);
  const dx = input.mouseX - sx, dy = input.mouseY - sy;
  if (Math.hypot(dx, dy) > 8) return Math.atan2(dy, dx);
  return p.angle;
}

function fireShot() {
  const p = S.player;
  if (p.inCar) return;
  if (shootCooldown > 0) return;
  if (S.ammo <= 0) {
    reload();
    return;
  }
  shootCooldown = 0.22;
  S.ammo--;
  S.stats.shots++;
  sound.shoot();
  const a = aimAngle();
  p.angle = a;
  const mx = p.x + Math.cos(a) * 18, my = p.y + Math.sin(a) * 18;
  const range = 520;
  let hx = p.x + Math.cos(a) * range, hy = p.y + Math.sin(a) * range;
  let hitPed = null, hitCar = null, hitWall = false;
  for (let d = 10; d <= range; d += 8) {
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    if (pointInBuilding(city, x, y)) { hx = x; hy = y; hitWall = true; break; }
    for (const ped of S.peds) {
      if (ped.dead) continue;
      if (dist(x, y, ped.x, ped.y) < 13) { hx = x; hy = y; hitPed = ped; break; }
    }
    if (hitPed) break;
    for (const c of S.cars) {
      if (c.dead || c === p.car) continue;
      if (dist(x, y, c.x, c.y) < 19) { hx = x; hy = y; hitCar = c; break; }
    }
    if (hitCar) break;
  }
  S.effects.push({ kind: "tracer", x0: mx, y0: my, x1: hx, y1: hy, t: 0.12 });
  S.effects.push({ kind: "flash", x: mx, y: my, t: 0.07 });
  if (hitPed) {
    S.stats.hits++;
    sound.hit();
    S.effects.push({ kind: "hitmark", x: hx, y: hy, t: 0.4 });
    if (hitPed.down > 0) { hitPed.dead = true; hooks.onPedKilled(hitPed); }
    else {
      hitPed.down = 3.5; hitPed.hitCount++;
      if (witnessNear(hitPed.x, hitPed.y, 320, hitPed)) addWanted(1, "Witness!");
    }
  } else if (hitCar) {
    S.stats.hits++;
    sound.hit();
    S.effects.push({ kind: "hitmark", x: hx, y: hy, t: 0.4 });
    hitCar.hp = Math.max(0, hitCar.hp - 12);
    if (hitCar.kind === "police") addWanted(2, "Cop car hit!");
  } else if (hitWall) {
    S.effects.push({ kind: "hitmark", x: hx, y: hy, t: 0.25 });
  }
  // Any shot nearby panics witnesses.
  witnessNear(p.x, p.y, 320, null);
}

function reload() {
  if (S.ammo >= START_AMMO || S.reserve <= 0) return;
  const need = START_AMMO - S.ammo;
  const take = Math.min(need, S.reserve);
  S.ammo += take; S.reserve -= take;
  sound.reload();
}

function saveGame() {
  try {
    const p = S.player;
    const save = {
      v: 3, x: Math.round(p.x), y: Math.round(p.y), hp: Math.round(p.hp),
      money: S.money, mission: S.missionIndex, stage: S.stageIndex,
      ammo: S.ammo, reserve: S.reserve, wanted: S.wanted,
      car: p.inCar && p.car ? { color: p.car.color, x: Math.round(p.car.x), y: Math.round(p.car.y), hp: Math.round(p.car.hp), angle: p.car.angle } : null,
      time: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (e) { /* storage unavailable */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.v === 3 ? s : null;
  } catch (e) { return null; }
}

function applySave(sv) {
  const p = S.player;
  p.x = sv.x; p.y = sv.y; p.hp = sv.hp;
  S.money = sv.money; S.missionIndex = sv.mission; S.stageIndex = sv.stage;
  S.ammo = sv.ammo; S.reserve = sv.reserve; S.wanted = sv.wanted;
  S.lastCrime = S.time;
  if (sv.car) {
    const car = makeCar("parked", sv.car.x, sv.car.y, sv.car.angle, sv.car.color, true);
    car.stolen = true; car.hp = sv.car.hp;
    S.cars.push(car);
    p.inCar = true; p.car = car;
    p.angle = sv.car.angle;
  }
  setupMission(S);
  S.cam.x = p.x; S.cam.y = p.y;
}

function startGame(newGame) {
  S = makeWorld();
  sound.ensure();
  if (!musicStarted) { sound.startMusic(); musicStarted = true; }
  show("start-screen", false);
  show("pause-screen", false);
  show("dead-screen", false);
  if (!newGame) {
    const sv = loadSave();
    if (sv) applySave(sv);
  }
  S.mode = "play";
  S.cam.x = S.player.x; S.cam.y = S.player.y;
  if (missionDef(S)) banner("Mission " + (S.missionIndex + 1) + ": " + missionDef(S).name, 3.5);
}

function pauseGame() {
  if (S.mode !== "play") return;
  S.mode = "paused";
  saveGame();
  show("pause-screen", true);
}
function resumeGame() {
  if (S.mode !== "paused") return;
  S.mode = "play";
  show("pause-screen", false);
}
function quitToMenu() {
  S.mode = "menu";
  show("pause-screen", false);
  show("dead-screen", false);
  refreshStartScreen();
  show("start-screen", true);
}

function refreshStartScreen() {
  const sv = loadSave();
  const cont = document.getElementById("btn-continue");
  const sum = document.getElementById("save-summary");
  if (sv && cont && sum) {
    cont.classList.remove("hidden");
    sum.textContent = "Mission " + (sv.mission + 1) + " of 5, " + fmtMoney(sv.money) + ", saved " + fmtClock(sv.time);
    sum.classList.remove("hidden");
  } else if (cont && sum) {
    cont.classList.add("hidden");
    sum.classList.add("hidden");
  }
}

function update(dt) {
  if (S.mode !== "play") return;
  S.time += dt;
  shootCooldown = Math.max(0, shootCooldown - dt);
  S.wantedFlash = Math.max(0, S.wantedFlash - dt);
  S.bannerT = Math.max(0, S.bannerT - dt);
  if (S.bannerT <= 0) S.banner = null;
  S.shake = Math.max(0, S.shake - dt * 1.5);
  for (const e of S.effects) e.t -= dt;
  S.effects = S.effects.filter((e) => e.t > 0);
  for (const f of S.floats) f.t -= dt;
  S.floats = S.floats.filter((f) => f.t > 0);

  // Wanted decay: one star per 30 s while no cop is close. Cops also break
  // off the chase if the player stays far away for 8 s, so escape is real.
  if (S.wanted > 0) {
    const far = S.cops.length === 0 || S.cops.every((c) => dist(c.x, c.y, S.player.x, S.player.y) > 650);
    S.evadeT = far ? (S.evadeT || 0) + dt : 0;
  } else S.evadeT = 0;
  if (S.wanted > 0 && S.time - S.lastCrime > 30) {
    let copNear = false;
    for (const c of S.cops) if (dist(c.x, c.y, S.player.x, S.player.y) < 450) { copNear = true; break; }
    if (!copNear) {
      S.decayT += dt;
      if (S.decayT >= 30) { S.wanted--; S.decayT = 0; S.lastCrime = S.time; }
    } else S.decayT = 0;
  } else S.decayT = 0;

  // Keys.
  if (consumePress(input, "KeyE")) enterCar();
  if (consumePress(input, "KeyR")) reload();
  if (consumePress(input, "KeyM")) { S.muted = sound.toggleMute(); }
  if (consumePress(input, "KeyP") || consumePress(input, "Escape")) pauseGame();
  if (consumePress(input, "KeyN")) startGame(true);
  if (consumePress(input, "KeyQ")) quitToMenu();
  if (consumePress(input, "Space") || consumePress(input, "Mouse") || input.mouseDown) fireShot();

  if (S.player.inCar) updateDriving(S, dt, input, city, hooks);
  else updatePlayer(S, dt, input, city, hooks);
  updateTraffic(S, dt, city, hooks);
  updatePeds(S, dt, hooks);
  updatePolice(S, dt, hooks);
  updateMissions(S, dt, hooks);

  // Camera follows the player.
  const p = S.player;
  const tx = clamp(p.x, view.w / 2, Math.max(view.w / 2, WORLD.w - view.w / 2));
  const ty = clamp(p.y, view.h / 2, Math.max(view.h / 2, WORLD.h - view.h / 2));
  S.cam.x += (tx - S.cam.x) * Math.min(1, 6 * dt);
  S.cam.y += (ty - S.cam.y) * Math.min(1, 6 * dt);
  S.isTouch = input.isTouch;
}

function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  update(dt);
  if (S.mode === "play" || S.mode === "paused") {
    ctx.save();
    if (S.shake > 0) ctx.translate((Math.random() - 0.5) * S.shake * 14, (Math.random() - 0.5) * S.shake * 14);
    drawWorld(ctx, S, city, view);
    ctx.restore();
  }
}

// ---- screens ----
document.getElementById("btn-new").addEventListener("click", () => startGame(true));
document.getElementById("btn-continue").addEventListener("click", () => startGame(false));
document.getElementById("btn-resume").addEventListener("click", resumeGame);
document.getElementById("btn-quit").addEventListener("click", quitToMenu);
document.getElementById("btn-respawn").addEventListener("click", () => {
  const p = S.player;
  p.hp = 100; p.x = SPAWN.x; p.y = SPAWN.y;
  p.inCar = false; p.car = null;
  S.wanted = 0; S.cops = [];
  S.cam.x = p.x; S.cam.y = p.y;
  show("dead-screen", false);
  S.mode = "play";
});
document.getElementById("btn-mute").addEventListener("click", () => { S.muted = sound.toggleMute(); });

refreshStartScreen();
show("start-screen", true);
if (new URLSearchParams(location.search).get("autostart") === "1") startGame(true);
requestAnimationFrame(frame);

// ---- debug API for local acceptance tests ----
window.SUNSHINE = {
  get state() { return S; },
  snapshot() {
    return {
      mode: S.mode, x: Math.round(S.player.x), y: Math.round(S.player.y),
      traffic: S.cars.filter((c) => c.kind === "traffic" && !c.dead).length,
      peds: S.peds.filter((p) => !p.dead).length,
      inCar: S.player.inCar, carColor: S.player.car ? S.player.car.color : null,
      wanted: S.wanted, missionIndex: S.missionIndex, money: S.money,
      ammo: S.ammo, hp: Math.round(S.player.hp),
      carHp: S.player.car ? Math.round(S.player.car.hp) : 100,
      cops: S.cops.length, distance: missionDistance(S),
    };
  },
  teleport(x, y) {
    const p = S.player;
    p.x = x; p.y = y;
    if (p.inCar && p.car) { p.car.x = x; p.car.y = y; p.car.speed = 0; }
    S.cam.x = x; S.cam.y = y;
  },
  start(newGame) { startGame(!!newGame); },
  setWanted(n) { S.wanted = n; S.lastCrime = S.time; S.wantedFlash = 2.5; },
  target() {
    const t = missionTarget(S);
    return t ? { x: t.x, y: t.y } : { x: 0, y: 0 };
  },
  pose(name) {
    const poses = { chase: poseChase, street: poseStreet, marina: poseMarina, docks: poseDocks };
    const fn = poses[name];
    return fn ? fn(window.SUNSHINE) : "unknown pose";
  },
};
