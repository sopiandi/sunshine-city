// Sunshine City — the map: roads, blocks, buildings, districts, clear zones.
// Written fresh in this session for the v3 rebuild.
import { WORLD_W, WORLD_H, VX, HY, ROAD_HALF, mulberry, pick } from "./config.js";

export const SPAWN = { x: 1330, y: 1125 };
export const CLINIC = { x: 1380, y: 900, w: 160, h: 120 };
export const STARTER_CAR = { x: 980, y: 1180, angle: 0, color: "#e33f2f" };
export const PARKING_LOT = { x: 900, y: 1150, w: 150, h: 140 };
export const PARKED_SPOTS = [
  { x: 620, y: 780, angle: 0, color: "#12a5a0" },
  { x: 1500, y: 420, angle: Math.PI / 2, color: "#f2b705" },
  { x: 2100, y: 1000, angle: 0, color: "#8a5cf6" },
  { x: 400, y: 1500, angle: Math.PI / 2, color: "#37b24d" },
  { x: 1700, y: 2100, angle: 0, color: "#c9ced6" },
  { x: 2300, y: 500, angle: Math.PI / 2, color: "#f07b1d" },
];

// Rects that must stay free of buildings (parking, clinic, parked cars, targets).
const CLEAR = [
  PARKING_LOT,
  { x: CLINIC.x - 20, y: CLINIC.y - 20, w: CLINIC.w + 40, h: CLINIC.h + 40 },
  { x: SPAWN.x - 110, y: SPAWN.y - 110, w: 220, h: 220 },
  { x: 700 - 90, y: 1880 - 90, w: 180, h: 180 },   // Marina Bay mission target
  { x: 2150 - 90, y: 1650 - 90, w: 180, h: 180 }, // Docks warehouse pickup
  { x: 500 - 90, y: 1900 - 90, w: 180, h: 180 },  // Marina delivery point
  { x: 400 - 90, y: 400 - 90, w: 180, h: 180 },   // hideout
  { x: 2100 - 110, y: 1800 - 110, w: 220, h: 220 }, // shootout yard
  ...PARKED_SPOTS.map((p) => ({ x: p.x - 45, y: p.y - 45, w: 90, h: 90 })),
];

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function districtAt(x, y) {
  if (x < 1150 && y > 1550) return "marina";
  if (x > 1850 && y > 1450) return "docks";
  if (x > 1050 && x < 1950 && y > 650 && y < 1550) return "downtown";
  if (y < 650) return "north";
  return "midtown";
}

export const DISTRICTS = {
  marina:   { name: "Marina Bay",  ground: "#8fb8a4", roof: ["#2f8f9d", "#e8a13c", "#f2ede4"], sign: "#0e6b7a" },
  docks:    { name: "Old Docks",   ground: "#9a8d7a", roof: ["#7a6a58", "#5d6b73", "#8a5a3c"], sign: "#5a3a22" },
  downtown: { name: "Downtown",    ground: "#8f9a8f", roof: ["#3d5a80", "#5b7fa6", "#2c3e50"], sign: "#22384f" },
  north:    { name: "Northside",   ground: "#a8b89a", roof: ["#c96f4a", "#d9a441", "#7d9b6a"], sign: "#4a6b3a" },
  midtown:  { name: "Midtown",     ground: "#96a08b", roof: ["#8d7d6b", "#6b8e7e", "#a08a5a"], sign: "#5a5245" },
};

function buildCity() {
  const rng = mulberry(20261120);
  const buildings = [];
  const trees = [];
  const xs = [0, ...VX, WORLD_W];
  const ys = [0, ...HY, WORLD_H];
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const bx0 = xs[bi] + ROAD_HALF + 14;
      const by0 = ys[bj] + ROAD_HALF + 14;
      const bx1 = xs[bi + 1] - ROAD_HALF - 14;
      const by1 = ys[bj + 1] - ROAD_HALF - 14;
      const bw = bx1 - bx0, bh = by1 - by0;
      if (bw < 90 || bh < 90) continue;
      const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
      const d = districtAt(cx, cy);
      // 1–3 buildings per block, placed on a small grid inside the block.
      const cols = bw > 260 ? 2 : 1;
      const rows = bh > 260 ? 2 : 1;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if (rng() < 0.22) continue; // some empty lots / plazas
          const w = Math.min(120 + rng() * 70, bw / cols - 24);
          const h = Math.min(90 + rng() * 60, bh / rows - 24);
          const x = bx0 + (i * bw) / cols + 12 + rng() * 10;
          const y = by0 + (j * bh) / rows + 12 + rng() * 10;
          const r = { x, y, w, h };
          if (CLEAR.some((c) => rectsOverlap(r, c))) continue;
          buildings.push({
            x, y, w, h, district: d,
            color: pick(rng, DISTRICTS[d].roof),
            tall: d === "downtown" && rng() < 0.6,
          });
        }
      }
      // A few trees around the block edges.
      for (let t = 0; t < 3; t++) {
        const tx = bx0 + 20 + rng() * (bw - 40);
        const ty = by0 + 20 + rng() * (bh - 40);
        if (CLEAR.some((c) => tx > c.x - 10 && tx < c.x + c.w + 10 && ty > c.y - 10 && ty < c.y + c.h + 10)) continue;
        if (buildings.some((b) => tx > b.x - 14 && tx < b.x + b.w + 14 && ty > b.y - 14 && ty < b.y + b.h + 14)) continue;
        trees.push({ x: tx, y: ty, palm: d === "marina" });
      }
    }
  }
  // Clinic building (special, always present).
  buildings.push({ x: CLINIC.x, y: CLINIC.y, w: CLINIC.w, h: CLINIC.h, district: "midtown", color: "#f2f2ee", clinic: true, tall: false });
  return { buildings, trees };
}

export const CITY = buildCity();

// Circle (x,y,r) vs any building. Returns the building hit or null.
export function buildingHit(x, y, r) {
  for (const b of CITY.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}
// Push a circle out of buildings; returns true if it touched one.
export function collideBuildings(o, r) {
  let hit = false;
  for (const b of CITY.buildings) {
    const nx = Math.max(b.x, Math.min(o.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(o.y, b.y + b.h));
    const dx = o.x - nx, dy = o.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        o.x = nx + (dx / d) * r;
        o.y = ny + (dy / d) * r;
      } else {
        o.y = b.y - r; // centre inside: shove out the top
      }
    }
  }
  return hit;
}
export function onRoad(x, y) {
  return VX.some((vx) => Math.abs(x - vx) < ROAD_HALF) || HY.some((hy) => Math.abs(y - hy) < ROAD_HALF);
}
