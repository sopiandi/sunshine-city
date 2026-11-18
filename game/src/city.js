// Sunshine City's map: one fixed coastal city, built once from the seed.
// Roads are a grid of avenues (vertical) and streets (horizontal); the
// blocks between them hold buildings, parks and parking lots. The beach
// and sea run down the whole west edge. Nothing here names a real place.
import { BUILDING_COLORS, WORLD } from './config.js';

export const ROADS_V = [600, 1100, 1600, 2100, 2600, 3100];
export const ROADS_H = [350, 850, 1350, 1850, 2300];
export const ROAD_W = 96;
export const BEACH_X = 380;

export const DISTRICTS = [
  { name: 'Palm Plaza', x: 700, y: 1050 },
  { name: 'Marina Bay', x: 3150, y: 500 },
  { name: 'Neon Row', x: 1600, y: 1350 },
  { name: 'Old Docks', x: 3300, y: 2300 },
  { name: 'Sunset Heights', x: 700, y: 2300 },
  { name: 'Coral Market', x: 2100, y: 850 },
];

export const PLACES = {
  playerSpawn: { x: 320, y: 1000 },
  marina: { x: 3150, y: 500, label: 'Marina Bay' },
  marketPickup: { x: 2100, y: 850, label: 'Coral Market' },
  marketDrop: { x: 3100, y: 400, label: 'Marina Drop' },
  hideout: { x: 650, y: 500, label: 'Hideout' },
  docks: { x: 3300, y: 2300, label: 'Old Docks' },
  penthouse: { x: 1600, y: 350, label: 'Palm Tower' },
  hospital: { x: 1100, y: 1850, label: 'Sunshine Clinic' },
};

export const RACE_CHECKPOINTS = [
  { x: 1100, y: 350 },
  { x: 2100, y: 850 },
  { x: 3100, y: 1350 },
  { x: 1600, y: 1850 },
  { x: 700, y: 2300 },
];

export function buildCity(random) {
  const buildings = [];
  const parks = [];
  const palms = [];
  const lots = [];
  const roadSetV = new Set(ROADS_V);
  const roadSetH = new Set(ROADS_H);
  void roadSetV;
  void roadSetH;
  // Blocks are the rectangles between neighbouring roads (plus the beach strip).
  const xs = [BEACH_X + 60, ...ROADS_V, WORLD.width - 60];
  const ys = [60, ...ROADS_H, WORLD.height - 60];
  for (let bx = 0; bx < xs.length - 1; bx += 1) {
    for (let by = 0; by < ys.length - 1; by += 1) {
      const x0 = xs[bx] + ROAD_W / 2 + 24;
      const x1 = xs[bx + 1] - ROAD_W / 2 - 24;
      const y0 = ys[by] + ROAD_W / 2 + 24;
      const y1 = ys[by + 1] - ROAD_W / 2 - 24;
      if (x1 - x0 < 120 || y1 - y0 < 120) continue;
      const roll = random();
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let p = 0; p < 5; p += 1) {
          palms.push({ x: x0 + 30 + random() * (x1 - x0 - 60), y: y0 + 30 + random() * (y1 - y0 - 60) });
        }
        continue;
      }
      if (roll < 0.28) {
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      // Two buildings per block, side by side or stacked.
      const horizontal = (x1 - x0) > (y1 - y0);
      const mid = horizontal ? (x0 + x1) / 2 : (y0 + y1) / 2;
      const first = horizontal
        ? { x: x0 + 8, y: y0 + 8, w: mid - x0 - 24, h: y1 - y0 - 16 }
        : { x: x0 + 8, y: y0 + 8, w: x1 - x0 - 16, h: mid - y0 - 24 };
      const second = horizontal
        ? { x: mid + 8, y: y0 + 8, w: x1 - mid - 16, h: y1 - y0 - 16 }
        : { x: x0 + 8, y: mid + 8, w: x1 - x0 - 16, h: y1 - mid - 16 };
      for (const b of [first, second]) {
        if (b.w < 60 || b.h < 60) continue;
        buildings.push({ ...b, color: BUILDING_COLORS[Math.floor(random() * BUILDING_COLORS.length)] });
      }
      if (random() < 0.6) {
        palms.push({ x: x0 + 14, y: y0 + 14 });
        palms.push({ x: x1 - 14, y: y1 - 14 });
      }
    }
  }
  // Palm-lined beach.
  for (let y = 120; y < WORLD.height; y += 180) palms.push({ x: 320 + random() * 40, y });
  return { buildings, parks, palms, lots };
}

export function isOnRoad(x, y) {
  for (const rx of ROADS_V) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS_V) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of ROADS_H) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}

export function buildingAt(buildings, x, y, pad) {
  for (const b of buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}
