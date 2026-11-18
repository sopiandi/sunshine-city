// Sunshine City — every tuning number and colour in one place.
// The world is a fixed 3600x2600 top-down city; the renderer scales a
// 1280x720 camera view of it to the window, so no rule depends on screen size.
export const WORLD = { width: 3600, height: 2600 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'sunshine-city.save.v1';
export const BEST_KEY = 'sunshine-city.best';

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
export const WANTED_DECAY_SECONDS = 18;

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
