// Sunshine City v2 — changelog (brief A–B; C not attempted, see report):
// A1 save v2: full state (pos/health/cash/ammo/reserve/mission stage/
//   checkpoint/package/timer/wanted/cars stolen/in-car), v1 save migrates.
// A2 Space = shoot/confirm listed; "E — steal car" hint above nearest car.
// A3 mission banner shows live distance in metres + off-screen edge arrow.
// A4 shooting a ped: nearby peds flee 4 s, "!" panic marks, wanted stars flash.
// A5 peds walk 95–165 px/s, varied, some pause, some cross roads.
// A6 wanted decay 18 s -> 30 s/star; roadblocks at wanted 4–5.
// A7 Marina Bay + Old Docks get own roof palettes, piers, boats, containers.
// A8 traffic creeps (never 0 behind a queue unless bumper-to-bumper);
//   police blocked >2 s reverse and turn away instead of sitting stuck.
// A9 car cannot turn at a standstill; off-road (grass/park) caps speed at
//   ~50%; steering more responsive at low speed.
// B1 full touch controls: virtual joystick + SHOOT / CAR / RELOAD / PAUSE
//   buttons, shown only on touch devices; tap aims + shoots.
// B2 crash effects: car health shown as smoke when low, crash thud, screen
//   shake scaled to impact; a car at 0 health stalls (no explosion).
// B3 procedural WebAudio music loop (quiet, under SFX); M mutes music too;
//   siren + engine volumes raised (they existed in v1, just too quiet).
// v1 rules kept (section D): desktop controls, collision, HUD, 5 missions
// and payouts, wanted both ways, procedural siren/engine, M mute.
export const WORLD = { width: 3600, height: 2600 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'sunshine-city.save.v2';
export const SAVE_KEY_V1 = 'sunshine-city.save.v1';
export const BEST_KEY = 'sunshine-city.best';
export const VERSION_LABEL = 'v2';

export const PLAYER = {
  radius: 14,
  walkSpeed: 270,
  runSpeed: 400,
  health: 100,
  ammoMax: 12,
  reserveMax: 60,
  shootCooldown: 0.22,
  reloadTime: 1.1,
  bulletSpeed: 1100,
  bulletRange: 620,
  bulletDamage: 34,
};

export const CAR = {
  width: 46,
  length: 84,
  accel: 520,
  brake: 900,
  reverseAccel: 300,
  maxSpeed: 640,
  maxReverse: 220,
  turnRate: 2.6,
  drag: 0.55,
};

export const POLICE = { maxChase: 6, ramDamage: 3, shootRange: 420, shootCooldown: 2.8 };
export const TRAFFIC_COUNT = 22;
export const PED_COUNT = 30;
export const WANTED_DECAY_SECONDS = 30;
export const PED_FLEE_SECONDS = 4;
export const PED_FLEE_SPEED = 220;

export const PALETTE = {
  sea: '#1d7fa8',
  seaDeep: '#14658c',
  sand: '#e8d29a',
  grass: '#7fb069',
  park: '#5da24f',
  sidewalk: '#c9c2b4',
  road: '#3a3f47',
  roadEdge: '#2c3038',
  lane: '#e8d44d',
  buildingRoof: '#b08968',
  text: '#f4f1e8',
  muted: '#c9c2b4',
  panel: 'rgba(12,18,28,0.82)',
  accent: '#ffb703',
  danger: '#e63946',
  police: '#2b6cb0',
  player: '#ffb703',
  health: '#43aa5b',
  cash: '#2ec4b6',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const CAR_COLORS = ['#e63946', '#2a9d8f', '#f4a261', '#8e6cc8', '#e9c46a', '#457b9d', '#f1faee', '#6d6875'];
export const BUILDING_COLORS = ['#d9a05b', '#c77d5a', '#a8b8c4', '#e0b089', '#9db4a0', '#c9a227', '#b5838d', '#8ecae6'];
// v2 (A7): Marina Bay (east, y < 900) and Old Docks (east, y > 2000) read as
// different districts — own roof palettes, piers + boats at the marina,
// shipping containers at the docks. Buildings stay plain top-down boxes.
export const MARINA_COLORS = ['#4fb3d9', '#2a9d8f', '#7fd1e8', '#e9f5f7', '#5bc0be'];
export const DOCKS_COLORS = ['#8a5a33', '#6b4a2f', '#a4713b', '#7a6a55', '#946b2d'];
export const CONTAINER_COLORS = ['#c0392b', '#2471a3', '#229954', '#d4ac0d', '#7d3c98'];
