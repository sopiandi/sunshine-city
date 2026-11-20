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
