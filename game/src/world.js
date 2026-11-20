// Sunshine City — world simulation: traffic AI, pedestrians, police,
// wanted level, car physics, collisions and shooting.
// Written fresh in this session for the v3 rebuild.
import {
  WORLD_W, WORLD_H, VX, HY, ROAD_HALF, LANE, PLAYER_R, WALK_SPEED, RUN_SPEED,
  CAR_ACCEL, CAR_MAX, CAR_REV, MAX_PEDS, MAX_TRAFFIC, MAX_COPS, START_AMMO,
  START_RESERVE, SHOT_RANGE, WITNESS_RADIUS, ENTER_RADIUS, CAR_COLORS,
  COP_STANDOFF_CAR, COP_STANDOFF_FOOT, COP_SEPARATION, COP_BRAKE_RANGE,
  COP_SIGHT_RANGE, WANTED_DECAY_SECONDS, RAM_MAX_DAMAGE, RAM_MIN_HP,
  ARREST_RANGE, ARREST_SECONDS, STEAL_MAX_SPEED, BUST_BAIL,
  clamp, dist, angleTo, angDiff, mulberry, pick,
} from "./config.js";
import { SPAWN, STARTER_CAR, PARKED_SPOTS, PARKING_LOT, PARKING_EXIT, inExitCorridor, inParkingLot, CITY, collideBuildings, buildingHit } from "./city.js";

const rng = mulberry(77031);
const EXIT_BLOCK = { x: 880, y: 1120, w: 280, h: 130 }; // starter-car exit corridor: keep peds out

function inRect(x, y, r) { return x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h; }
function rand(a, b) { return a + rng() * (b - a); }

// ---------- state ----------
export function newGameState() {
  const S = {
    time: 0, mode: "start",
    player: { x: SPAWN.x, y: SPAWN.y, angle: -Math.PI / 2, hp: 100 },
    inCar: false, car: null,
    cars: [], peds: [], cops: [], roadblocks: [],
    effects: [], claims: {},
    money: 0, wanted: 0, lastCrime: -999, starsFlash: 0, lastHurt: -999,
    // v4: wanted decay + arrest state. decayT counts up while no cop can
    // see the player; decayActive is what the HUD countdown shows.
    // arrestT counts up while a slow cop holds the player on foot.
    decayT: 0, decayActive: false, arrestT: 0, arrestCop: null,
    bustedCount: 0, bailPaid: 0, hintVisible: false, hudBoxes: [],
    missionIndex: 0, stage: 0, foesLeft: 0,
    ammo: START_AMMO, reserve: START_RESERVE, reloadT: 0,
    msg: null, district: "midtown", districtT: 0,
    camera: { x: SPAWN.x, y: SPAWN.y },
    muted: false, stats: { shots: 0, hits: 0 },
    over: null,
  };
  spawnParked(S);
  spawnTraffic(S);
  spawnPeds(S);
  return S;
}

function spawnParked(S) {
  const mk = (p, kind) => ({
    kind, x: p.x, y: p.y, angle: p.angle, speed: 0,
    color: p.color, hp: 100, driven: false, cruise: 0, hitCd: 0,
    road: null, line: 0, dir: 1, next: 0, claim: null, brake: 0,
  });
  S.cars.push(mk(STARTER_CAR, "parked"));
  for (const p of PARKED_SPOTS) S.cars.push(mk(p, "parked"));
}

// ---------- traffic ----------
function intersectionsAlong(road, line) {
  // Intersections on one road line, in travel order.
  return road === "v" ? HY.slice() : VX.slice();
}
function nextCoord(road, line, dir, from) {
  const list = intersectionsAlong(road, line);
  if (dir > 0) { for (const c of list) if (c > from + 5) return c; return null; }
  for (let i = list.length - 1; i >= 0; i--) if (list[i] < from - 5) return list[i];
  return null;
}
function spawnTraffic(S) {
  let placed = 0, guard = 0;
  while (placed < MAX_TRAFFIC && guard++ < 600) {
    const road = rng() < 0.5 ? "v" : "h";
    const line = road === "v" ? pick(rng, VX) : pick(rng, HY);
    const dir = rng() < 0.5 ? 1 : -1;
    const along = rand(120, road === "v" ? WORLD_H - 120 : WORLD_W - 120);
    const x = road === "v" ? line + (dir > 0 ? LANE : -LANE) : along;
    const y = road === "v" ? along : line + (dir > 0 ? LANE : -LANE);
    if (S.cars.some((c) => dist(c.x, c.y, x, y) < 150)) continue;
    const from = road === "v" ? y : x;
    const nx = nextCoord(road, line, dir, from);
    if (nx === null) continue;
    S.cars.push({
      kind: "traffic", x, y, angle: road === "v" ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      speed: rand(90, 150), cruise: rand(125, 175), color: pick(rng, CAR_COLORS),
      hp: 100, driven: false, hitCd: 0, road, line, dir, next: nx, claim: null, brake: 0,
    });
    placed++;
  }
}
function lanePos(c) {
  return c.road === "v"
    ? { x: c.line + (c.dir > 0 ? LANE : -LANE), y: c.y }
    : { x: c.x, y: c.line + (c.dir > 0 ? LANE : -LANE) };
}
// Car directly ahead of `c` in its lane (any car counts, incl. the player's).
function leaderAhead(S, c) {
  let best = null, bestGap = 1e9;
  for (const o of S.cars) {
    if (o === c) continue;
    if (c.road === "v") {
      if (Math.abs(o.x - (c.line + (c.dir > 0 ? LANE : -LANE))) > 26) continue;
      const gap = c.dir > 0 ? o.y - c.y : c.y - o.y;
      if (gap > 4 && gap < bestGap) { best = o; bestGap = gap; }
    } else {
      if (Math.abs(o.y - (c.line + (c.dir > 0 ? LANE : -LANE))) > 26) continue;
      const gap = c.dir > 0 ? o.x - c.x : c.x - o.x;
      if (gap > 4 && gap < bestGap) { best = o; bestGap = gap; }
    }
  }
  return { car: best, gap: bestGap };
}
function updateTrafficCar(S, c, dt) {
  if (c.driven || c.hp <= 0) return;
  const along = c.road === "v" ? c.y : c.x;
  const toNext = c.dir > 0 ? c.next - along : along - c.next;
  let targetSpeed = c.cruise;
  // Stop behind the car ahead (safe gap, no piling up). The gap counts
  // centre to centre and a car is 46 long, so 70 keeps bumpers apart.
  const lead = leaderAhead(S, c);
  if (lead.car) {
    if (lead.gap < 70) targetSpeed = 0;
    else if (lead.gap < 140) targetSpeed = Math.min(targetSpeed, lead.car.speed || 0);
  }
  // Never enter an intersection another car has claimed. The key is the
  // intersection itself, so cars from every direction share one claim.
  const ix = c.road === "v" ? c.line : c.next;
  const iy = c.road === "v" ? c.next : c.line;
  if (toNext < 85 && toNext > -10) {
    const key = ix + ":" + iy;
    const holder = S.claims[key];
    if (holder && holder !== c) targetSpeed = 0;
    else { S.claims[key] = c; c.claim = key; c.claimX = ix; c.claimY = iy; }
  }
  // Release the claim only once the car is well clear of the crossing.
  if (c.claim && dist(c.x, c.y, c.claimX, c.claimY) > 80) {
    delete S.claims[c.claim]; c.claim = null;
  }
  // Brake for a pedestrian on foot right in front of the car.
  if (!S.inCar) {
    const p = S.player;
    const ahead = c.road === "v"
      ? Math.abs(p.x - (c.line + (c.dir > 0 ? LANE : -LANE))) < 30 && (c.dir > 0 ? p.y - c.y : c.y - p.y) > 0 && Math.abs(c.dir > 0 ? p.y - c.y : c.y - p.y) < 75
      : Math.abs(p.y - (c.line + (c.dir > 0 ? LANE : -LANE))) < 30 && (c.dir > 0 ? p.x - c.x : c.x - p.x) > 0 && Math.abs(c.dir > 0 ? p.x - c.x : c.x - p.x) < 75;
    if (ahead) targetSpeed = 0;
  }
  // Slow right down for the intersection itself: a car that turns at full
  // speed swings wide past the centre and into oncoming traffic.
  if (toNext < 70 && toNext > -10) targetSpeed = Math.min(targetSpeed, 60);
  // Separation: only the car with the other car AHEAD of it stops, so two
  // cars that meet never both freeze and wedge together.
  for (const o of S.cars) {
    if (o === c || o.kind !== "traffic" || o.driven) continue;
    const d = dist(c.x, c.y, o.x, o.y);
    if (d < 34) {
      const ahead = (o.x - c.x) * Math.cos(c.angle) + (o.y - c.y) * Math.sin(c.angle);
      if (ahead > 0) { targetSpeed = 0; break; }
    }
  }
  // Steer toward the lane, then along it. While the nose is still swinging
  // onto the new heading, stay slow — a fast turn swings wide off-lane.
  const lp = lanePos(c);
  const wantAngle = Math.atan2(lp.y + (c.road === "v" ? c.dir * 40 : 0) - c.y, lp.x + (c.road === "h" ? c.dir * 40 : 0) - c.x);
  if (Math.abs(angDiff(c.angle, wantAngle)) > 0.35) targetSpeed = Math.min(targetSpeed, 55);
  // Ease speed toward target — brakes are far stronger than the engine,
  // so a car asked to stop actually stops before it reaches the car ahead.
  c.speed += clamp(targetSpeed - c.speed, -700 * dt, 200 * dt);
  if (c.speed < 0) c.speed = 0;
  c.angle += clamp(angDiff(c.angle, wantAngle), -3.2 * dt, 3.2 * dt);
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
  c.x = clamp(c.x, 60, WORLD_W - 60);
  c.y = clamp(c.y, 60, WORLD_H - 60);
  if (c.hitCd > 0) c.hitCd -= dt;
  if (c.bumpCd > 0) c.bumpCd -= dt;
  // Reached the intersection: choose straight / left / right (never reverse).
  if (toNext < 10 && toNext > -12) {
    const straight = nextCoord(c.road, c.line, c.dir, c.next);
    const r = rng();
    if (straight !== null && r < 0.55) {
      c.next = straight;
    } else {
      // Turn onto the crossing road.
      const nRoad = c.road === "v" ? "h" : "v";
      const nLine = c.next;
      const nDir = rng() < 0.5 ? 1 : -1;
      const from = nRoad === "v" ? c.y : c.x;
      const nx = nextCoord(nRoad, nLine, nDir, from);
      if (nx !== null) {
        c.road = nRoad; c.line = nLine; c.dir = nDir; c.next = nx;
      } else if (straight !== null) {
        c.next = straight;
      } else {
        // Dead end: U-turn.
        c.dir = -c.dir;
        const back = nextCoord(c.road, c.line, c.dir, c.road === "v" ? c.y : c.x);
        if (back !== null) c.next = back;
      }
    }
  }
}

// ---------- pedestrians ----------
function sidewalkTarget(S) {
  for (let tries = 0; tries < 12; tries++) {
    const road = rng() < 0.5 ? "v" : "h";
    const line = road === "v" ? pick(rng, VX) : pick(rng, HY);
    const along = rand(150, (road === "v" ? WORLD_H : WORLD_W) - 150);
    const side = rng() < 0.5 ? -1 : 1;
    const off = ROAD_HALF + 16;
    const x = road === "v" ? line + side * off : along;
    const y = road === "v" ? along : line + side * off;
    if (inRect(x, y, EXIT_BLOCK)) continue;
    if (buildingHit(x, y, 10)) continue;
    return { x, y };
  }
  return { x: SPAWN.x + rand(-200, 200), y: SPAWN.y + rand(-200, 200) };
}
function spawnPeds(S) {
  const shirts = ["#e86ba8", "#37b24d", "#f2b705", "#2f7fe3", "#e33f2f", "#8a5cf6", "#12a5a0", "#f07b1d"];
  for (let i = 0; i < MAX_PEDS; i++) {
    const t = sidewalkTarget(S);
    S.peds.push({
      x: t.x, y: t.y, angle: rand(0, Math.PI * 2), speed: rand(22, 55),
      tx: t.x, ty: t.y, pause: rand(0, 3), panic: 0, down: 0, dead: false,
      foe: false, hp: 1, color: pick(rng, shirts), hitCd: 0,
    });
  }
}
function updatePed(S, p, dt) {
  if (p.dead) return;
  if (p.down > 0) { p.down -= dt; return; }
  if (p.panic > 0) {
    p.panic -= dt;
    const a = angleTo(S.player.x, S.player.y, p.x, p.y);
    p.angle = a;
    p.x += Math.cos(a) * 130 * dt;
    p.y += Math.sin(a) * 130 * dt;
    p.x = clamp(p.x, 40, WORLD_W - 40);
    p.y = clamp(p.y, 40, WORLD_H - 40);
    return;
  }
  if (p.foe) return; // foes are handled by updateFoes
  if (p.pause > 0) { p.pause -= dt; return; }
  const d = dist(p.x, p.y, p.tx, p.ty);
  if (d < 10) {
    p.pause = rand(1, 4);
    const t = sidewalkTarget(S);
    p.tx = t.x; p.ty = t.y;
    return;
  }
  const a = angleTo(p.x, p.y, p.tx, p.ty);
  p.angle = a;
  const nx = p.x + Math.cos(a) * p.speed * dt;
  const ny = p.y + Math.sin(a) * p.speed * dt;
  if (!buildingHit(nx, ny, 10)) { p.x = nx; p.y = ny; }
  else { p.pause = 0.5; const t = sidewalkTarget(S); p.tx = t.x; p.ty = t.y; }
}

// ---------- police ----------
export function wantedCopCount(w) { return [0, 1, 2, 3, 4, 6][w] || 0; }

// ---------- v4 police behaviour ----------
// Line of sight between two points: blocked when a building crosses the
// segment. Sampled, not exact — cheap enough to run every frame.
function hasLineOfSight(ax, ay, bx, by) {
  for (let i = 1; i < 10; i++) {
    const t = i / 10;
    if (buildingHit(ax + (bx - ax) * t, ay + (by - ay) * t, 6)) return false;
  }
  return true;
}
// Does any cop currently see the player? Seeing needs closeness AND a
// clear line of sight — ducking behind a block breaks it. This is what
// gates wanted decay, so hiding behind buildings actually works.
export function copSeesPlayer(S) {
  const p = S.player;
  for (const c of S.cops) {
    const d = dist(c.x, c.y, p.x, p.y);
    if (d < COP_SIGHT_RANGE && hasLineOfSight(c.x, c.y, p.x, p.y)) return true;
  }
  return false;
}
// Push two police cars apart so they never overlap or stack at a crossing.
function separateCops(S) {
  const cops = S.cops;
  for (let a = 0; a < cops.length; a++) {
    for (let b = a + 1; b < cops.length; b++) {
      const ca = cops[a], cb = cops[b];
      const dx = cb.x - ca.x, dy = cb.y - ca.y;
      const d = Math.hypot(dx, dy);
      if (d < COP_SEPARATION && d > 0.01) {
        const push = (COP_SEPARATION - d) / 2;
        const nx = dx / d, ny = dy / d;
        ca.x -= nx * push; ca.y -= ny * push;
        cb.x += nx * push; cb.y += ny * push;
      } else if (d <= 0.01) {
        cb.x += COP_SEPARATION / 2;
        cb.y += 8;
      }
    }
  }
}
// Each cop holds its own slot on a ring around the player — never on top
// of the player, never on top of another cop, and never in the parking
// lot's exit corridor, so a stolen car can always drive out.
function copSlot(S, index, count) {
  const p = S.player;
  const ring = S.inCar ? COP_STANDOFF_CAR : (S.wanted >= 3 ? 110 : COP_STANDOFF_FOOT);
  const ang = (index / Math.max(1, count)) * Math.PI * 2;
  let sx = p.x + Math.cos(ang) * ring;
  let sy = p.y + Math.sin(ang) * ring;
  // Keep the slot out of the parking lot itself.
  if (inParkingLot(sx, sy, 28)) {
    const left = sx - (PARKING_LOT.x - 28);
    const right = PARKING_LOT.x + PARKING_LOT.w + 28 - sx;
    const top = sy - (PARKING_LOT.y - 28);
    const bottom = PARKING_LOT.y + PARKING_LOT.h + 28 - sy;
    const m = Math.min(left, right, top, bottom);
    if (m === left) sx = PARKING_LOT.x - 28;
    else if (m === right) sx = PARKING_LOT.x + PARKING_LOT.w + 28;
    else if (m === top) sy = PARKING_LOT.y - 28;
    else sy = PARKING_LOT.y + PARKING_LOT.h + 28;
  }
  // Never block the lot's exit lane: flip to the far side of the ring.
  if (inExitCorridor(sx, sy)) {
    sx = p.x - Math.cos(ang) * ring;
    sy = p.y - Math.sin(ang) * ring;
  }
  return { x: sx, y: sy };
}
// Arrested on foot at low wanted: bail, wanted cleared, BUSTED screen.
function bustPlayer(S, sound) {
  if (S.mode !== "play") return;
  S.bustedCount++;
  const bail = Math.min(BUST_BAIL, S.money);
  S.money -= bail;
  S.bailPaid = bail;
  S.wanted = 0;
  S.decayT = 0;
  S.arrestT = 0;
  S.arrestCop = null;
  S.lastCrime = S.time;
  S.mode = "busted";
  S.over = "busted";
  S.msg = { text: "BUSTED", sub: "Bail paid: $" + bail, t: 0 };
  if (sound) sound.busted();
}
// A police touch on a pedestrian: at most RAM_MAX_DAMAGE, and never
// lethal — the floor keeps at least RAM_MIN_HP. The player is shoved
// clear instead of being ground under the bumper.
function policeTouchPlayer(S, cop) {
  const p = S.player;
  if (cop.hitCd > 0) return;
  cop.hitCd = 2.0;
  const dmg = Math.min(RAM_MAX_DAMAGE, Math.max(0, S.player.hp - RAM_MIN_HP));
  if (dmg > 0) damagePlayer(S, dmg);
  const a = angleTo(cop.x, cop.y, p.x, p.y);
  p.x = clamp(p.x + Math.cos(a) * 26, 30, WORLD_W - 30);
  p.y = clamp(p.y + Math.sin(a) * 26, 30, WORLD_H - 30);
}
function spawnCop(S) {
  // Spawn on a road intersection 450–650 px from the player.
  for (let tries = 0; tries < 20; tries++) {
    const x = pick(rng, VX), y = pick(rng, HY);
    if (dist(x, y, S.player.x, S.player.y) < 450) continue;
    if (dist(x, y, S.player.x, S.player.y) > 700) continue;
    const cop = {
      kind: "cop", x, y, angle: angleTo(x, y, S.player.x, S.player.y),
      speed: 0, cruise: 300, color: "#23272e", hp: 100, driven: false,
      hitCd: 0, shootCd: rand(0.5, 1.5), road: null, line: 0, dir: 1, next: 0, claim: null, brake: 0,
    };
    S.cars.push(cop);
    S.cops.push(cop);
    return;
  }
}
function updateCops(S, dt, sound) {
  const want = wantedCopCount(S.wanted);
  let guard = 0;
  while (S.cops.length < want && guard++ < 8) spawnCop(S);
  if (S.wanted === 0) {
    for (const c of S.cops) { const i = S.cars.indexOf(c); if (i >= 0) S.cars.splice(i, 1); }
    S.cops = [];
    S.arrestT = 0;
    S.arrestCop = null;
    return;
  }
  S.cops = S.cops.filter((c) => c.hp > 0 && S.cars.includes(c));
  const p = S.player;
  let arresting = null;
  for (let ci = 0; ci < S.cops.length; ci++) {
    const c = S.cops[ci];
    if (c.bumpCd > 0) c.bumpCd -= dt;
    if (c.hitCd > 0) c.hitCd -= dt;
    const d = dist(c.x, c.y, p.x, p.y);
    // Drive to this cop's ring slot, never straight at the player.
    const slot = copSlot(S, ci, S.cops.length);
    const sd = dist(c.x, c.y, slot.x, slot.y);
    const noseX = c.x + Math.cos(c.angle) * 40, noseY = c.y + Math.sin(c.angle) * 40;
    let steer = angleTo(c.x, c.y, slot.x, slot.y);
    if (buildingHit(noseX, noseY, 12)) steer = c.angle + 0.9;
    c.angle += clamp(angDiff(c.angle, steer), -3.0 * dt, 3.0 * dt);
    let target = c.cruise;
    if (sd < 45) target = 0;                    // hold the slot
    else if (sd < 160) target = Math.min(target, 110);
    for (const o of S.cars) {
      if (o === c || o.kind !== "traffic") continue;
      if (dist(c.x, c.y, o.x, o.y) < 55) { target = Math.min(target, 60); break; }
    }
    // Brake hard when the player is right in front of the car.
    const fx = Math.cos(c.angle), fy = Math.sin(c.angle);
    const relX = p.x - c.x, relY = p.y - c.y;
    const fwd = relX * fx + relY * fy;
    const lat = Math.abs(relX * -fy + relY * fx);
    if (fwd > 0 && fwd < COP_BRAKE_RANGE && lat < 34) target = 0;
    if (!S.inCar && d < COP_STANDOFF_FOOT + 18) target = 0;
    const braking = target < c.speed;
    c.speed += clamp(target - c.speed, (braking ? -800 : -400) * dt, 320 * dt);
    if (c.speed < 0) c.speed = 0;
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    c.x = clamp(c.x, 60, WORLD_W - 60);
    c.y = clamp(c.y, 60, WORLD_H - 60);
    // Never touch or overlap the player's car: hold the ring, shove out.
    if (S.inCar && S.car) {
      const cd = dist(c.x, c.y, S.car.x, S.car.y);
      if (cd < 64 && cd > 0.01) {
        const nx = (c.x - S.car.x) / cd, ny = (c.y - S.car.y) / cd;
        c.x = S.car.x + nx * 64;
        c.y = S.car.y + ny * 64;
        c.speed *= 0.5;
      }
    }
    // Shoot at wanted 3+ when close enough — guns, not bumpers.
    c.shootCd -= dt;
    if (S.wanted >= 3 && d < 430 && c.shootCd <= 0) {
      c.shootCd = rand(1.1, 1.8);
      S.effects.push({ kind: "tracer", x1: c.x, y1: c.y, x2: p.x + rand(-30, 30), y2: p.y + rand(-30, 30), t: 0, life: 0.18 });
      if (rng() < 0.15) {
        // Rounds mostly go for the driver; half chip the car when he's in one.
        if (S.inCar && S.car && rng() < 0.5) { S.car.hp = Math.max(0, S.car.hp - 3); }
        else damagePlayer(S, 3);
      }
      if (sound) sound.shoot();
    }
    // On foot: a touch is a glancing hit (capped, never lethal), and a
    // slow cop holding the player at low wanted makes an arrest, not a kill.
    if (!S.inCar && d < 26) {
      policeTouchPlayer(S, c);
      if (S.wanted <= 2 && Math.abs(c.speed) < 60 && d < ARREST_RANGE) arresting = c;
    }
    if (rng() < dt * 0.25 && sound) sound.siren();
  }
  // Cops keep their distance from each other — no stacking, ever.
  separateCops(S);
  // Arrest clock: only a cop holding the player still runs it down.
  if (arresting) {
    S.arrestT += dt;
    S.arrestCop = arresting;
    if (S.arrestT >= ARREST_SECONDS) bustPlayer(S, sound);
  } else {
    S.arrestT = Math.max(0, S.arrestT - dt * 2);
    if (S.arrestT === 0) S.arrestCop = null;
  }
}
function updateRoadblocks(S) {
  if (S.wanted < 4) { S.roadblocks = []; return; }
  while (S.roadblocks.length < 2) {
    const a = angleTo(S.player.x, S.player.y, S.player.x + rand(-1, 1), S.player.y + rand(-1, 1));
    const bx = clamp(S.player.x + Math.cos(a) * 380, 200, WORLD_W - 200);
    const by = clamp(S.player.y + Math.sin(a) * 380, 200, WORLD_H - 200);
    // Snap onto the nearest road so the block sits across a street.
    let best = null, bd = 1e9;
    for (const vx of VX) for (const hy of HY) {
      const dd = dist(bx, by, vx, hy);
      if (dd < bd) { bd = dd; best = { x: vx, y: hy }; }
    }
    const px = best ? best.x : bx, py = best ? best.y : by;
    if (S.roadblocks.some((r) => dist(r.x, r.y, px, py) < 200)) break;
    S.roadblocks.push({ x: px, y: py, angle: rand(0, Math.PI) });
  }
}
export function updateWanted(S, dt, sound) {
  if (S.wanted <= 0) { S.decayT = 0; S.decayActive = false; return; }
  // A fresh crime buys the heat 30 seconds of attention; after that the
  // clock runs only while no cop can actually see the player — outrun
  // them, or break line of sight behind a block, and the stars fade one
  // per 30 seconds. Hiding in plain sight in front of a cop never counts.
  if (S.time - S.lastCrime < 2) { S.decayActive = false; return; }
  if (copSeesPlayer(S)) {
    S.decayT = 0;
    S.decayActive = false;
    return;
  }
  S.decayActive = true;
  S.decayT += dt;
  if (S.decayT >= WANTED_DECAY_SECONDS) {
    S.decayT = 0;
    S.wanted--;
    S.starsFlash = 1.0;
    if (sound) sound.decay();
    if (S.wanted === 0) {
      S.msg = { text: "You lost them.", sub: "Wanted level clear", t: 0 };
    } else {
      S.msg = { text: "Heat cooling off", sub: "Wanted level " + S.wanted, t: 0 };
    }
  }
}
export function addWanted(S, n, reason, sound) {
  S.wanted = Math.min(5, S.wanted + n);
  S.lastCrime = S.time;
  S.decayT = 0;
  S.decayActive = false;
  S.arrestT = 0;
  S.arrestCop = null;
  S.starsFlash = 1.4;
  S.msg = { text: "WANTED", sub: reason, t: 0 };
  if (sound) sound.siren();
}

// ---------- player ----------
export function damagePlayer(S, dmg) {
  if (S.mode !== "play") return;
  S.player.hp -= dmg;
  S.lastHurt = S.time;
  if (S.player.hp <= 0) {
    S.player.hp = 0;
    S.mode = "dead";
    S.over = "dead";
  }
}
export function nearestCar(S, x, y, maxD) {
  let best = null, bd = maxD;
  for (const c of S.cars) {
    if (c.driven) continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  // Prefer a civilian car: grabbing a cop car while its mates watch is
  // suicide, and a nearby cop car should never shadow a civilian one.
  if (best && best.kind === "cop") {
    let civ = null, cd = maxD;
    for (const c of S.cars) {
      if (c.driven || c.kind === "cop") continue;
      const d = dist(x, y, c.x, c.y);
      if (d < cd) { cd = d; civ = c; }
    }
    if (civ) return civ;
  }
  return best;
}
// v4: the one car the E key can actually take right now — the same
// predicate the HUD hint uses, so the hint never lies. A car is
// stealable when it is in E range AND slow enough to climb into: a
// traffic car flashing past at speed is not. Parked cars always qualify.
export function stealableCar(S) {
  const c = nearestCar(S, S.player.x, S.player.y, ENTER_RADIUS);
  if (!c) return null;
  if (Math.abs(c.speed || 0) > STEAL_MAX_SPEED) return null;
  return c;
}
export function enterCar(S, sound) {
  if (S.inCar) { exitCar(S); return true; }
  const c = stealableCar(S);
  if (!c) return false;
  const wasTraffic = c.kind === "traffic";
  const wasCop = c.kind === "cop";
  c.driven = true;
  c.speed = 0;
  if (c.kind === "traffic") {
    // A stolen traffic car leaves the traffic flow.
    c.kind = "stolen";
  }
  S.inCar = true;
  S.car = c;
  S.player.x = c.x; S.player.y = c.y; S.player.angle = c.angle;
  addWanted(S, wasCop ? 2 : 1, "Car taken", sound);
  if (sound) sound.pickup();
  return true;
}
export function exitCar(S) {
  if (!S.inCar || !S.car) return;
  const c = S.car;
  c.driven = false;
  c.speed = 0;
  S.player.x = c.x + Math.cos(c.angle + Math.PI / 2) * 34;
  S.player.y = c.y + Math.sin(c.angle + Math.PI / 2) * 34;
  S.player.angle = c.angle;
  S.inCar = false;
  S.car = null;
}

function carVsBuildings(S, car, sound) {
  const fx = car.x + Math.cos(car.angle) * 18, fy = car.y + Math.sin(car.angle) * 18;
  const bx = car.x - Math.cos(car.angle) * 18, by = car.y - Math.sin(car.angle) * 18;
  const hitF = buildingHit(fx, fy, 13), hitB = buildingHit(bx, by, 13);
  if (!hitF && !hitB) return;
  const impact = Math.abs(car.speed);
  // One damaging hit per crash, not one per frame while wedged in.
  if (impact > 220 && !(car.crashCd > 0)) {
    const dmg = Math.min(34, (impact - 220) / 14);
    car.hp = Math.max(0, car.hp - dmg);
    car.crashCd = 0.6;
    S.effects.push({ kind: "smoke", x: fx, y: fy, t: 0, life: 1.2 });
    if (sound) sound.crash(impact);
  }
  // Push out along the nose.
  const push = { x: car.x, y: car.y };
  if (collideBuildings(push, 20)) { car.x = push.x; car.y = push.y; }
  car.speed *= -0.28;
}
function carVsCars(S, car) {
  for (const o of S.cars) {
    if (o === car) continue;
    const d = dist(car.x, car.y, o.x, o.y);
    if (d < 40 && d > 0.01) {
      const push = (40 - d) / 2;
      const nx = (car.x - o.x) / d, ny = (car.y - o.y) / d;
      if (o.kind === "cop") {
        // A cop car yields to the player's car — shove it aside, don't stall on it.
        o.x -= nx * (40 - d); o.y -= ny * (40 - d);
      } else {
        car.x += nx * push; car.y += ny * push;
        if (!o.driven && o.kind === "traffic") { o.x -= nx * push; o.y -= ny * push; }
      }
      const rel = Math.abs(car.speed - (o.speed || 0));
      // v4: a stationary car takes NO damage, and a police car never
      // damages the player's car — it holds a ring and yields instead.
      // Only a real moving crash chips the paint, once per scrape.
      const parked = Math.abs(car.speed) < 40;
      if (!parked && o.kind !== "cop" && rel > 200 && !(car.bumpCd > 0) && !(o.bumpCd > 0)) {
        car.hp = Math.max(0, car.hp - Math.min(12, rel / 30));
        if (o.kind !== "traffic") o.hp = Math.max(0, (o.hp || 100) - 8);
        car.bumpCd = 0.8; o.bumpCd = 0.8;
      }
      car.speed *= 0.6;
    }
  }
}
function carVsPeds(S, car, sound) {
  for (const p of S.peds) {
    if (p.dead) continue;
    if (dist(car.x, car.y, p.x, p.y) < 26) {
      const fast = Math.abs(car.speed) > 380;
      if (p.down > 0 && fast) { p.dead = true; }
      else if (p.down <= 0) {
        p.down = 4.5;
        p.panic = 0;
        // Witnesses to a hit-and-run call it in.
        const witness = S.peds.some((q) => q !== p && !q.dead && dist(q.x, q.y, p.x, p.y) < WITNESS_RADIUS);
        if (witness) {
          for (const q of S.peds) if (q !== p && !q.dead && dist(q.x, q.y, p.x, p.y) < WITNESS_RADIUS) q.panic = 4;
          addWanted(S, 1, "Hit and run", sound);
        }
      }
      car.speed *= 0.7;
    }
  }
}
function carVsRoadblocks(S, car, sound) {
  for (const r of S.roadblocks) {
    const d = dist(car.x, car.y, r.x, r.y);
    if (d < 34 && d > 0.01) {
      if (Math.abs(car.speed) > 200) {
        car.hp -= 14;
        if (car.hp < 0) car.hp = 0;
        S.effects.push({ kind: "smoke", x: car.x, y: car.y, t: 0, life: 1 });
        if (sound) sound.crash(300);
      }
      const nx = (car.x - r.x) / d, ny = (car.y - r.y) / d;
      car.x = r.x + nx * 34; car.y = r.y + ny * 34;
      car.speed *= -0.2;
    }
  }
}

export function updatePlayer(S, mv, running, dt, sound) {
  const p = S.player;
  if (S.inCar && S.car) {
    const car = S.car;
    if (car.crashCd > 0) car.crashCd -= dt;
    if (car.bumpCd > 0) car.bumpCd -= dt;
    if (car.hp > 0) {
      if (mv.y < -0.2) car.speed += CAR_ACCEL * dt * Math.min(1, -mv.y);
      else if (mv.y > 0.2) {
        if (car.speed > 30) car.speed -= CAR_ACCEL * 1.1 * dt * mv.y; // brake
        else car.speed -= CAR_REV * dt * mv.y; // reverse
      } else {
        car.speed -= Math.sign(car.speed) * 140 * dt;
        if (Math.abs(car.speed) < 8) car.speed = 0;
      }
      car.speed = clamp(car.speed, -CAR_REV, CAR_MAX);
      const sf = clamp(Math.abs(car.speed) / 240, 0, 1) * Math.sign(car.speed || 1);
      car.angle += mv.x * 2.5 * sf * dt;
    } else {
      car.speed *= 0.9;
      if (Math.abs(car.speed) < 2) car.speed = 0;
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 40, WORLD_W - 40);
    car.y = clamp(car.y, 40, WORLD_H - 40);
    carVsBuildings(S, car, sound);
    carVsCars(S, car);
    carVsPeds(S, car, sound);
    carVsRoadblocks(S, car, sound);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    if (sound) sound.engine(Math.abs(car.speed) / CAR_MAX);
    return;
  }
  // On foot.
  const sp = running ? RUN_SPEED : WALK_SPEED;
  const nx = p.x + mv.x * sp * dt;
  const ny = p.y + mv.y * sp * dt;
  if (mv.x !== 0 || mv.y !== 0) p.angle = Math.atan2(mv.y, mv.x);
  if (!buildingHit(nx, p.y, PLAYER_R)) p.x = nx;
  if (!buildingHit(p.x, ny, PLAYER_R)) p.y = ny;
  p.x = clamp(p.x, 30, WORLD_W - 30);
  p.y = clamp(p.y, 30, WORLD_H - 30);
  if (sound) sound.engine(0);
  // Traffic cars hitting the player on foot: at most 25 HP per hit.
  for (const c of S.cars) {
    if (c.kind !== "traffic" || c.driven) continue;
    if (dist(p.x, p.y, c.x, c.y) < 24 && c.hitCd <= 0 && Math.abs(c.speed) > 30) {
      c.hitCd = 1.2;
      const dmg = Math.min(25, 6 + Math.abs(c.speed) * 0.03);
      damagePlayer(S, dmg);
      c.speed *= 0.3;
      p.x += Math.cos(angleTo(c.x, c.y, p.x, p.y)) * 22;
      p.y += Math.sin(angleTo(c.x, c.y, p.x, p.y)) * 22;
    }
  }
}

// ---------- shooting ----------
export function shoot(S, wx, wy, sound) {
  if (S.mode !== "play") return false;
  if (S.reloadT > 0) return false;
  if (S.ammo <= 0) { if (sound) sound.blip(140, 0.06, "square", 0.08); return false; }
  S.ammo--;
  S.stats.shots++;
  const p = S.player;
  const ox = p.x + Math.cos(p.angle) * 16, oy = p.y + Math.sin(p.angle) * 16;
  let ang = p.angle;
  if (wx !== null && wx !== undefined && wy !== null && wy !== undefined) {
    ang = angleTo(ox, oy, wx, wy);
    p.angle = ang;
  }
  const dx = Math.cos(ang), dy = Math.sin(ang);
  let bestT = SHOT_RANGE, hit = null;
  const consider = (x, y, r, obj) => {
    const tx = x - ox, ty = y - oy;
    const t = tx * dx + ty * dy;
    if (t < 0 || t > bestT) return;
    const perp = Math.abs(tx * dy - ty * dx);
    if (perp < r) { bestT = t; hit = obj; }
  };
  for (const pd of S.peds) if (!pd.dead) consider(pd.x, pd.y, 15, { type: "ped", ped: pd });
  for (const c of S.cars) {
    if (c.driven) continue;
    consider(c.x, c.y, 22, { type: "car", car: c });
  }
  const ex = ox + dx * bestT, ey = oy + dy * bestT;
  S.effects.push({ kind: "tracer", x1: ox, y1: oy, x2: ex, y2: ey, t: 0, life: 0.22 });
  S.effects.push({ kind: "muzzle", x: ox, y: oy, t: 0, life: 0.09 });
  if (sound) sound.shoot();
  if (!hit) return true;
  S.stats.hits++;
  S.effects.push({ kind: "hitmark", x: ex, y: ey, t: 0, life: 0.55 });
  if (sound) sound.hit();
  if (hit.type === "ped") {
    const pd = hit.ped;
    if (pd.foe) {
      pd.hp -= 1;
      if (pd.hp <= 0) { pd.dead = true; S.foesLeft = Math.max(0, S.foesLeft - 1); }
      else pd.down = 1.2;
    } else if (pd.down > 0) {
      pd.dead = true;
    } else {
      pd.down = 4.5;
    }
    // Witnesses within 320 px panic for 4 s; a witnessed shooting is +1 wanted.
    let saw = false;
    for (const q of S.peds) {
      if (q === pd || q.dead) continue;
      if (dist(q.x, q.y, pd.x, pd.y) < WITNESS_RADIUS) { q.panic = 4; saw = true; }
    }
    if (saw && !pd.foe) addWanted(S, 1, "Shot in front of a witness", sound);
  } else if (hit.type === "car") {
    const c = hit.car;
    c.hp -= 25;
    if (c.hp < 0) c.hp = 0;
    if (c.kind === "cop") addWanted(S, 2, "Shot a police car", sound);
  }
  return true;
}

export function updateFoes(S, dt, sound) {
  for (const p of S.peds) {
    if (!p.foe || p.dead || p.down > 0) continue;
    const d = dist(p.x, p.y, S.player.x, S.player.y);
    if (d > 260 && d < 700) {
      const a = angleTo(p.x, p.y, S.player.x, S.player.y);
      p.angle = a;
      const nx = p.x + Math.cos(a) * 70 * dt, ny = p.y + Math.sin(a) * 70 * dt;
      if (!buildingHit(nx, ny, 10)) { p.x = nx; p.y = ny; }
    }
    p.shootCd = (p.shootCd || 1) - dt;
    if (d < 380 && p.shootCd <= 0) {
      p.shootCd = rand(1.0, 1.7);
      S.effects.push({ kind: "tracer", x1: p.x, y1: p.y, x2: S.player.x + rand(-40, 40), y2: S.player.y + rand(-40, 40), t: 0, life: 0.16 });
      if (rng() < 0.28) damagePlayer(S, 6);
      if (sound) sound.shoot();
    }
  }
}

// ---------- per-frame ----------
export function updateWorld(S, dt, input, sound) {
  S.time += dt;
  if (S.starsFlash > 0) S.starsFlash -= dt;
  if (S.msg) { S.msg.t += dt; if (S.msg.t > 3.2) S.msg = null; }
  // Reload timer.
  if (S.reloadT > 0) {
    S.reloadT -= dt;
    if (S.reloadT <= 0) {
      const need = START_AMMO - S.ammo;
      const take = Math.min(need, S.reserve);
      S.ammo += take; S.reserve -= take;
    }
  }
  const mv = input.moveVec();
  updatePlayer(S, mv, input.running(), dt, sound);
  // Health slowly recovers to 50 once the player has been safe for a while.
  if (S.player.hp > 0 && S.player.hp < 50 && S.time - (S.lastHurt ?? -999) > 8) {
    S.player.hp = Math.min(50, S.player.hp + 6 * dt);
  }
  for (const c of S.cars) if (c.kind === "traffic") updateTrafficCar(S, c, dt);
  // Safety net: traffic cars physically never rest overlapped, whatever
  // the AI did — push a too-close pair apart along their centre line.
  const tr = S.cars.filter((c) => c.kind === "traffic");
  for (let a = 0; a < tr.length; a++) for (let b = a + 1; b < tr.length; b++) {
    const dx = tr[b].x - tr[a].x, dy = tr[b].y - tr[a].y;
    const d = Math.hypot(dx, dy);
    if (d < 30 && d > 0.01) {
      const push = (30 - d) / 2;
      const nx = dx / d, ny = dy / d;
      tr[a].x -= nx * push; tr[a].y -= ny * push;
      tr[b].x += nx * push; tr[b].y += ny * push;
    }
  }
  for (const p of S.peds) updatePed(S, p, dt);
  updateFoes(S, dt, sound);
  updateCops(S, dt, sound);
  updateRoadblocks(S);
  updateWanted(S, dt, sound);
  // v4 safety net: police cars physically never rest overlapped either,
  // whatever the pursuit AI did — same push-apart as traffic gets.
  for (let a = 0; a < S.cops.length; a++) for (let b = a + 1; b < S.cops.length; b++) {
    const ca = S.cops[a], cb = S.cops[b];
    const dx = cb.x - ca.x, dy = cb.y - ca.y;
    const d = Math.hypot(dx, dy);
    if (d < COP_SEPARATION && d > 0.01) {
      const push = (COP_SEPARATION - d) / 2;
      const nx = dx / d, ny = dy / d;
      ca.x -= nx * push; ca.y -= ny * push;
      cb.x += nx * push; cb.y += ny * push;
    }
  }
  // Effects age out.
  for (const e of S.effects) e.t += dt;
  S.effects = S.effects.filter((e) => e.t < e.life);
  // District label.
  const d = (function () {
    const x = S.player.x, y = S.player.y;
    if (x < 1150 && y > 1550) return "marina";
    if (x > 1850 && y > 1450) return "docks";
    if (x > 1050 && x < 1950 && y > 650 && y < 1550) return "downtown";
    if (y < 650) return "north";
    return "midtown";
  })();
  if (d !== S.district) { S.district = d; S.districtT = 0; }
  S.districtT += dt;
  // Camera follows the player.
  S.camera.x = clamp(S.player.x, 0, WORLD_W);
  S.camera.y = clamp(S.player.y, 0, WORLD_H);
}
