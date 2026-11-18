// Boot and the one loop for Sunshine City. Input is read every frame, the
// world advances in fixed 1/60 s steps, and the renderer paints what is
// there. Screens: title, play, paused, busted (game over) and win.
// Progress saves to localStorage on mission completion and on pause.
//
// ?seed=N fixes the city and traffic. ?shot=chase|start|race|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP, VIEW, WORLD } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_ENEMY_SHOOT, EVENT_HURT, EVENT_MISSION, EVENT_PICKUP, EVENT_SHOOT, EVENT_WANTED, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_NEW, ACTION_PAUSE, ACTION_QUIT, ACTION_RELOAD, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* storage can be off */ }
}
function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeSave() {
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.saveData())); } catch { /* storage can be off */ }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, scene.ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let hasSave = readSave() !== null;
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;

  function announce(message) { status.textContent = message; }

  function startGame(fresh) {
    if (fresh) {
      try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
      world.reset();
      hasSave = false;
    } else {
      const save = readSave();
      if (save) world.loadData(save);
      else world.reset();
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing Sunshine City.');
  }

  function endGameBusted() {
    screen = SCREEN_OVER;
    audio.busted();
    audio.stopSiren();
    audio.stopEngine();
    announce('Busted. You woke up at Sunshine Clinic.');
  }

  function winGame() {
    screen = SCREEN_WIN;
    audio.mission();
    writeSave();
    if (world.state.bestCash > best) { best = world.state.bestCash; saveBest(best); }
    announce('King of Sunshine City!');
  }

  function camFor() {
    const p = world.state.player;
    return {
      x: Math.max(0, Math.min(WORLD.width - VIEW.width, p.x - VIEW.width / 2)),
      y: Math.max(0, Math.min(WORLD.height - VIEW.height, p.y - VIEW.height / 2)),
    };
  }

  function handleEvents(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_ENEMY_SHOOT) audio.enemyShoot();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_CASH) audio.cash();
    if (events & EVENT_HURT) audio.hurt();
    if (events & EVENT_MISSION) { audio.mission(); writeSave(); }
    if (events & EVENT_WANTED) audio.startSiren();
    if (events & EVENT_WIN) winGame();
    if (events & EVENT_BUSTED) endGameBusted();
    if (world.state.bestCash > best) { best = world.state.bestCash; saveBest(best); }
  }

  function step() {
    const snap = input.snapshot();
    const cam = camFor();
    const aimX = cam.x + snap.mouseX;
    const aimY = cam.y + snap.mouseY;
    const worldInput = {
      up: snap.up, down: snap.down, left: snap.left, right: snap.right, run: snap.run,
      aimX, aimY, shooting: snap.shooting, enter: false, reload: false,
    };
    const actions = input.takeActions();
    if (actions & ACTION_ENTER) worldInput.enter = true;
    if (actions & ACTION_RELOAD) worldInput.reload = true;
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        writeSave();
        audio.stopSiren();
        audio.stopEngine();
        announce('Paused. Progress saved.');
        return;
      }
      if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
    }
    if (actions & ACTION_QUIT && screen === SCREEN_PAUSED) {
      screen = SCREEN_TITLE;
      hasSave = readSave() !== null;
      return;
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(false);
      else if (actions & ACTION_NEW) startGame(true);
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) { world.respawnAfterBusted(); screen = SCREEN_PLAY; }
      return;
    }
    if (screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) screen = SCREEN_PLAY;
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, worldInput);
    handleEvents(events);
    // Siren follows the wanted level; engine hum follows driving speed.
    if (world.state.wanted > 0) audio.startSiren();
    else audio.stopSiren();
    if (world.state.player.inCar) {
      audio.startEngine();
      audio.setEngine(Math.abs(world.state.player.inCar.speed) / 640);
    } else audio.stopEngine();
    saveTimer += STEP;
    if (saveTimer > 10) { saveTimer = 0; writeSave(); }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      step();
      accumulator = 0;
    }
    const snap = input.snapshot();
    const ui = {
      target: world.missionTarget(),
      mission: world.state.mission,
      missionTimer: world.state.missionTimer,
      checkpoint: world.state.checkpoint,
      hasSave,
      mouse: { x: snap.mouseX, y: snap.mouseY },
    };
    renderer.draw(world.state, screen, best, ui);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      writeSave();
      announce('Paused.');
    }
  });

  announce('Sunshine City. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
