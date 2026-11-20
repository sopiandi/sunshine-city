// Sunshine City — shared tuning constants and tiny helpers.
// Written fresh in this session for the v3 rebuild. No outside code.
export const WORLD_W = 2800;
export const WORLD_H = 2400;

export const VX = [300, 700, 1100, 1500, 1900, 2300]; // vertical road centres
export const HY = [300, 700, 1100, 1500, 1900];       // horizontal road centres
export const ROAD_HALF = 45;                          // half road width
export const LANE = 17;                               // lane offset from centre

export const PLAYER_R = 13;
export const CAR_W = 46;
export const CAR_L = 26;
export const WALK_SPEED = 155;
export const RUN_SPEED = 245;
export const CAR_ACCEL = 520;
export const CAR_MAX = 540;
export const CAR_REV = 220;

export const MAX_PEDS = 30;
export const MAX_TRAFFIC = 20;
export const MAX_COPS = 6;

export const START_AMMO = 12;
export const START_RESERVE = 48;
export const SHOT_RANGE = 540;
export const WITNESS_RADIUS = 320;
export const ENTER_RADIUS = 80; // E radius — hint uses this exact radius
export const MISSION_RADIUS = 100;

export const SAVE_KEY = "sunshine-city-v3";

// --- v4: police, wanted and HUD tuning (fix build on top of v3) ---
export const GAME_VERSION = "v4";
// Police hold a ring around the player instead of driving into them.
export const COP_STANDOFF_CAR = 112;   // px from the player's car centre
export const COP_STANDOFF_FOOT = 72;   // px from the player on foot
export const COP_SEPARATION = 66;      // px minimum between two police cars
export const COP_BRAKE_RANGE = 135;    // px: brake when the player is ahead
export const COP_SIGHT_RANGE = 500;    // px: a cop with line of sight blocks decay
export const WANTED_DECAY_SECONDS = 30; // seconds hidden per star lost
export const RAM_MAX_DAMAGE = 10;      // px: most HP one police touch can take
export const RAM_MIN_HP = 1;           // a police ram can never kill
export const ARREST_RANGE = 30;        // px: cop close + slow starts an arrest
export const ARREST_SECONDS = 2.0;     // seconds held to be BUSTED
export const STEAL_MAX_SPEED = 60;     // a car faster than this cannot be taken
export const BUST_BAIL = 50;           // dollars lost when BUSTED


export const CAR_COLORS = [
  "#e33f2f", "#2f7fe3", "#f2b705", "#37b24d", "#8a5cf6",
  "#e86ba8", "#12a5a0", "#f07b1d", "#c9ced6", "#3a3f4a",
];

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
// Deterministic small RNG so the city layout is stable between loads.
export function mulberry(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
