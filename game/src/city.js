// Sunshine City v3 — city layout: road grid, blocks, buildings, districts.
// Marina Bay (south-west) and Old Docks (north-east) get their own palettes,
// signs and street dressing so they read differently in a screenshot.
import { WORLD, ROADS_X, ROADS_Y, ROAD_W, CLINIC, districtAt } from "./config.js";
import { mulberry32, range, pick } from "./random.js";

export function buildCity() {
  const rng = mulberry32(20261119);
  const buildings = [];
  const trees = [];
  const signs = [
    { x: 350, y: 1520, text: "MARINA BAY" },
    { x: 2100, y: 350, text: "OLD DOCKS" },
    { x: 1350, y: 650, text: "DOWNTOWN" },
    { x: 700, y: 1850, text: "MARINA BAY" },
  ];
  // One building (or two) per block between roads.
  for (let ix = 0; ix < ROADS_X.length - 1; ix++) {
    for (let iy = 0; iy < ROADS_Y.length - 1; iy++) {
      const x0 = ROADS_X[ix] + ROAD_W / 2 + 14;
      const x1 = ROADS_X[ix + 1] - ROAD_W / 2 - 14;
      const y0 = ROADS_Y[iy] + ROAD_W / 2 + 14;
      const y1 = ROADS_Y[iy + 1] - ROAD_W / 2 - 14;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const d = districtAt(cx, cy);
      // Parking lots stay open: west of clinic + the north-west lot.
      if (ix === 1 && iy === 2) continue; // starter lot (x 650-1000, y 1000-1350)
      if (ix === 0 && iy === 1) continue; // north-west lot (x 300-650, y 650-1000)
      const bw = x1 - x0, bh = y1 - y0;
      const big = rng() > 0.45;
      if (big) {
        buildings.push(makeBuilding(cx - bw * 0.22, cy - bh * 0.22, bw * 0.4, bh * 0.4, d, rng));
        buildings.push(makeBuilding(cx + bw * 0.22, cy + bh * 0.22, bw * 0.36, bh * 0.36, d, rng));
      } else {
        buildings.push(makeBuilding(cx, cy, bw * 0.62, bh * 0.62, d, rng));
      }
      // Street trees along block edges, denser in Marina Bay.
      const nTree = d.name === "Marina Bay" ? 4 : d.name === "Old Docks" ? 1 : 2;
      for (let t = 0; t < nTree; t++) {
        trees.push({
          x: range(rng, x0 + 8, x1 - 8), y: range(rng, y0 + 8, y1 - 8),
          palm: d.name === "Marina Bay", r: range(rng, 7, 11),
        });
      }
    }
  }
  // The clinic itself, east side of the starter block.
  buildings.push({
    x: CLINIC.x + CLINIC.w / 2, y: CLINIC.y + CLINIC.h / 2,
    w: CLINIC.w, h: CLINIC.h, color: "#ffffff", roof: "#d94f4f",
    label: "CLINIC", cross: true,
  });
  // Dock cranes in Old Docks (visual only).
  const cranes = [{ x: 2250, y: 420 }, { x: 2450, y: 620 }];
  return { buildings, trees, signs, cranes };
}

function makeBuilding(x, y, w, h, d, rng) {
  const palette = {
    "Marina Bay": ["#f2e3c6", "#ffe9b8", "#e8d5a8"],
    "Old Docks": ["#a9805a", "#96684a", "#b08a62"],
    "Downtown": ["#cfd6e4", "#b9c4d6", "#dde3ee"],
  }[d.name] || ["#cfd6e4"];
  return {
    x, y, w, h,
    color: pick(rng, palette),
    roof: d.accent,
    label: rng() > 0.7 ? pick(rng, ["HOTEL", "MARKET", "CAFE", "GARAGE", "OFFICE", "BAR"]) : "",
    cross: false,
  };
}

// Circle (px,py,r) vs building rectangles: push the circle out, return hit info.
export function collideBuildings(city, px, py, r) {
  let hit = null;
  for (const b of city.buildings) {
    const nx = Math.max(b.x - b.w / 2, Math.min(px, b.x + b.w / 2));
    const ny = Math.max(b.y - b.h / 2, Math.min(py, b.y + b.h / 2));
    const dx = px - nx, dy = py - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.001;
      hit = { nx: px + (dx / d) * (r - d), ny: py + (dy / d) * (r - d), bx: b.x, by: b.y };
      px = hit.nx; py = hit.ny;
    }
  }
  return hit ? { x: px, y: py, hit: true } : { x: px, y: py, hit: false };
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (Math.abs(x - b.x) < b.w / 2 && Math.abs(y - b.y) < b.h / 2) return true;
  }
  return false;
}

export function nearestRoadX(x) {
  let best = ROADS_X[0], bd = 1e9;
  for (const rx of ROADS_X) { const d = Math.abs(rx - x); if (d < bd) { bd = d; best = rx; } }
  return best;
}
export function nearestRoadY(y) {
  let best = ROADS_Y[0], bd = 1e9;
  for (const ry of ROADS_Y) { const d = Math.abs(ry - y); if (d < bd) { bd = d; best = ry; } }
  return best;
}
export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}
export function worldBounds(x, y) {
  return {
    x: Math.max(20, Math.min(WORLD.w - 20, x)),
    y: Math.max(20, Math.min(WORLD.h - 20, y)),
  };
}
