// Sunshine City v3 — the living world: player, cars, traffic AI, pedestrians, police.
// Traffic never piles up: cars brake for the car ahead, yield at intersections,
// and keep a hard minimum separation from each other.
import { WORLD, ROADS_X, ROADS_Y, ROAD_W, SPAWN, STARTER_CAR, PARKED_CARS, START_AMMO, START_RESERVE } from "./config.js";
import { mulberry32, pick, range, clamp, dist, angleLerp } from "./random.js";
import { collideBuildings, pointInBuilding, nearestRoadX, nearestRoadY } from "./city.js";

const TRAFFIC_COLORS = ["#c94f4f", "#3a7bd5", "#4f9d69", "#d5d5d5", "#e8b23a", "#8a5fc0", "#5a6b7a", "#e07840"];
const SHIRTS = ["#e85d75", "#4f9d69", "#3a7bd5", "#f2c14e", "#8a5fc0", "#e07840", "#2fa8a0", "#d5d5d5"];
const DIRS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

export function makeWorld() {
  const rng = mulberry32(777);
  const S = {
    time: 0, mode: "menu",
    player: { x: SPAWN.x, y: SPAWN.y, angle: -Math.PI / 2, hp: 100, speed: 0, inCar: false, car: null, run: false, hurtT: 0 },
    cars: [], peds: [], cops: [], roadblocks: [],
    wanted: 0, wantedFlash: 0, lastCrime: -999, decayT: 0,
    money: 0, ammo: START_AMMO, reserve: START_RESERVE,
    missionIndex: 0, stageIndex: 0, missionTime: 0, foesLeft: 0,
    effects: [], floats: [], banner: null, bannerT: 0,
    shake: 0, carSmoke: 0, muted: false, lastEnemyHit: -9,
    cam: { x: SPAWN.x, y: SPAWN.y },
    stats: { shots: 0, hits: 0, steals: 0 },
  };
  // Starter car + parked cars.
  S.cars.push(makeCar("parked", STARTER_CAR.x, STARTER_CAR.y, STARTER_CAR.angle, STARTER_CAR.color, true));
  for (const p of PARKED_CARS) S.cars.push(makeCar("parked", p.x, p.y, p.angle, p.color, true));
  // Traffic.
  for (let i = 0; i < 22; i++) S.cars.push(spawnTrafficCar(rng, S, true));
  // Pedestrians.
  for (let i = 0; i < 30; i++) S.peds.push(spawnPed(rng, S));
  return S;
}

export function makeCar(kind, x, y, angle, color, unlocked) {
  return {
    id: Math.random().toString(36).slice(2, 8), kind, x, y, angle,
    speed: 0, hp: 100, color: color || "#888888",
    stolen: false, unlocked: !!unlocked, dead: false,
    dir: 0, road: "x", roadVal: x, cruise: 100, targetSpeed: 0,
    lastHitT: -9, stuckT: 0, sirenT: Math.random() * 2,
  };
}

function spawnTrafficCar(rng, S, anywhere) {
  const vertical = rng() > 0.5;
  let x, y, angle;
  if (vertical) {
    const rx = pick(rng, ROADS_X);
    angle = rng() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
    x = rx + (angle === Math.PI / 2 ? -16 : 16);
    y = range(rng, 150, WORLD.h - 150);
  } else {
    const ry = pick(rng, ROADS_Y);
    angle = rng() > 0.5 ? 0 : Math.PI;
    y = ry + (angle === 0 ? 16 : -16);
    x = range(rng, 150, WORLD.w - 150);
  }
  if (!anywhere && dist(x, y, S.player.x, S.player.y) < 500) { x = 300; y = 300; }
  const c = makeCar("traffic", x, y, angle, pick(rng, TRAFFIC_COLORS), false);
  c.dir = angle; c.road = vertical ? "x" : "y"; c.roadVal = vertical ? x - (angle === Math.PI / 2 ? -16 : 16) : y - (angle === 0 ? 16 : -16);
  c.cruise = range(rng, 85, 130);
  return c;
}

function spawnPed(rng, S) {
  const x = range(rng, 100, WORLD.w - 100), y = range(rng, 100, WORLD.h - 100);
  return {
    x, y, angle: range(rng, 0, Math.PI * 2),
    walkSpeed: range(rng, 26, 58), speed: 0,
    tx: x, ty: y, pause: range(rng, 0, 2),
    down: 0, dead: false, panic: 0, hitCount: 0, foe: false,
    shirt: pick(rng, SHIRTS), shootT: range(rng, 0.5, 1.5),
  };
}

export function nearestCar(S, x, y, maxD, kinds) {
  let best = null, bd = maxD;
  for (const c of S.cars) {
    if (c.dead) continue;
    if (kinds && !kinds.includes(c.kind)) continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// ---- player on foot ----
export function updatePlayer(S, dt, inp, city, hooks) {
  const p = S.player;
  if (p.inCar) return;
  p.hurtT = Math.max(0, p.hurtT - dt);
  let mx = 0, my = 0;
  if (inp.up) my -= 1;
  if (inp.down) my += 1;
  if (inp.left) mx -= 1;
  if (inp.right) mx += 1;
  if (inp.joyActive) { mx = inp.joyX; my = inp.joyY; }
  const len = Math.hypot(mx, my);
  if (len > 0.01) {
    const run = inp.run || (inp.joyActive && len > 0.92);
    const sp = run ? 235 : 150;
    p.angle = Math.atan2(my, mx);
    const nx = p.x + (mx / Math.max(1, len)) * sp * dt;
    const ny = p.y + (my / Math.max(1, len)) * sp * dt;
    const r = collideBuildings(city, nx, ny, 12);
    p.x = r.x; p.y = r.y;
    // Push out of cars.
    for (const c of S.cars) {
      if (c.dead) continue;
      const d = dist(p.x, p.y, c.x, c.y);
      if (d < 26 && d > 0.01) { p.x += (p.x - c.x) / d * (26 - d); p.y += (p.y - c.y) / d * (26 - d); }
    }
    const b = { x: Math.max(16, Math.min(WORLD.w - 16, p.x)), y: Math.max(16, Math.min(WORLD.h - 16, p.y)) };
    p.x = b.x; p.y = b.y;
    p.speed = sp;
  } else p.speed = 0;
}

// ---- player driving ----
export function updateDriving(S, dt, inp, city, hooks) {
  const p = S.player;
  const car = p.car;
  if (!p.inCar || !car) return;
  const stalled = car.hp <= 0;
  let accel = 0;
  if (inp.up || (inp.joyActive && inp.joyY < -0.25)) accel = 1;
  if (inp.down || (inp.joyActive && inp.joyY > 0.25)) accel = -1;
  if (!stalled) {
    if (accel > 0) car.speed = Math.min(380, car.speed + 300 * dt);
    else if (accel < 0) car.speed = Math.max(-90, car.speed - 260 * dt);
    else car.speed *= Math.max(0, 1 - 1.4 * dt);
  } else car.speed *= Math.max(0, 1 - 3 * dt);
  let steer = 0;
  if (inp.left || (inp.joyActive && inp.joyX < -0.25)) steer = -1;
  if (inp.right || (inp.joyActive && inp.joyX > 0.25)) steer = 1;
  const dirSign = car.speed >= 0 ? 1 : -1;
  car.angle += steer * 1.9 * dt * clamp(Math.abs(car.speed) / 120, 0.25, 1) * dirSign;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const before = Math.abs(car.speed);
  const r = collideBuildings(city, nx, ny, 16);
  if (r.hit && before > 60) {
    const dmg = Math.min(28, before * 0.08);
    car.hp = Math.max(0, car.hp - dmg);
    hooks.onCrash(dmg, car.x, car.y);
    car.speed *= -0.25;
  } else if (r.hit) car.speed *= 0.5;
  car.x = r.x; car.y = r.y;
  // Car vs car: push apart, small damage at speed.
  for (const o of S.cars) {
    if (o === car || o.dead) continue;
    const d = dist(car.x, car.y, o.x, o.y);
    if (d < 30 && d > 0.01) {
      const push = (30 - d) / 2;
      const ux = (car.x - o.x) / d, uy = (car.y - o.y) / d;
      car.x += ux * push; car.y += uy * push;
      if (o.kind === "traffic" || o.kind === "parked") { o.x -= ux * push; o.y -= uy * push; }
      if (Math.abs(car.speed) > 150) { car.hp = Math.max(0, car.hp - 4); hooks.onCrash(4, car.x, car.y); }
    }
  }
  // Run over peds: slow hit knocks down, second fast hit kills.
  for (const ped of S.peds) {
    if (ped.dead || ped.down > 0 && ped.hitCount >= 2) continue;
    const d = dist(car.x, car.y, ped.x, ped.y);
    if (d < 24 && Math.abs(car.speed) > 30) {
      if (ped.down > 0) {
        if (Math.abs(car.speed) > 200) { ped.dead = true; hooks.onPedKilled(ped); }
      } else {
        ped.down = 3.5; ped.hitCount++;
        if (ped.hitCount >= 2 && Math.abs(car.speed) > 200) { ped.dead = true; hooks.onPedKilled(ped); }
        else hooks.onPedKnocked(ped);
      }
    }
  }
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  const b = { x: Math.max(20, Math.min(WORLD.w - 20, car.x)), y: Math.max(20, Math.min(WORLD.h - 20, car.y)) };
  car.x = b.x; car.y = b.y; p.x = car.x; p.y = car.y;
}

// ---- traffic ----
export function updateTraffic(S, dt, city, hooks) {
  const p = S.player;
  for (const c of S.cars) {
    if (c.kind !== "traffic" || c.dead) continue;
    // Car ahead on the same lane: brake to keep a safe gap.
    let target = c.cruise;
    let aheadGap = 1e9, aheadSpeed = 0;
    for (const o of S.cars) {
      if (o === c || o.dead) continue;
      const dx = o.x - c.x, dy = o.y - c.y;
      const forward = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
      const side = Math.abs(-dx * Math.sin(c.angle) + dy * Math.cos(c.angle));
      if (forward > 0 && forward < 95 && side < 22) {
        if (forward < aheadGap) { aheadGap = forward; aheadSpeed = o.speed || 0; }
      }
    }
    if (aheadGap < 58) target = 0;
    else if (aheadGap < 95) target = Math.min(target, Math.max(0, aheadSpeed));
    // Player on foot ahead: brake if there is time.
    if (!p.inCar) {
      const dx = p.x - c.x, dy = p.y - c.y;
      const forward = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
      const side = Math.abs(-dx * Math.sin(c.angle) + dy * Math.cos(c.angle));
      if (forward > 0 && forward < 70 && side < 20) target = 0;
    }
    // Yield at intersections: another car inside the crossing goes first.
    const ix = nearestRoadX(c.x), iy = nearestRoadY(c.y);
    const nearCross = Math.abs(c.x - ix) < 70 && Math.abs(c.y - iy) < 70;
    if (nearCross) {
      for (const o of S.cars) {
        if (o === c || o.dead || o.kind !== "traffic") continue;
        const inCross = Math.abs(o.x - ix) < 46 && Math.abs(o.y - iy) < 46;
        const crossing = Math.abs(Math.sin(o.angle - c.angle)) > 0.5;
        if (inCross && crossing) { target = 0; break; }
      }
    }
    c.targetSpeed = target;
    const accel = target > c.speed ? 160 : 420;
    if (c.speed < target) c.speed = Math.min(target, c.speed + accel * dt);
    else c.speed = Math.max(target, c.speed - accel * dt);
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    c.x = nx; c.y = ny;
    // At an intersection, sometimes turn onto the crossing road — but never
    // turn onto a spot another car already occupies.
    const cx = nearestRoadX(c.x), cy = nearestRoadY(c.y);
    if (Math.abs(c.x - cx) < 14 && Math.abs(c.y - cy) < 14 && c.speed > 5) {
      const r = Math.random();
      const vertical = Math.abs(Math.sin(c.angle)) > 0.5;
      if (r < 0.15) {
        const turn = r < 0.075 ? Math.PI / 2 : -Math.PI / 2;
        const na = c.angle + turn;
        const nx = vertical ? cx : c.x;
        const ny = vertical ? c.y : cy;
        let blocked = false;
        for (const o of S.cars) {
          if (o === c || o.dead || o.kind !== "traffic") continue;
          if (dist(nx, ny, o.x, o.y) < 42) { blocked = true; break; }
        }
        if (!blocked) {
          if (vertical) { c.road = "y"; c.roadVal = cy; c.angle = na; }
          else { c.road = "x"; c.roadVal = cx; c.angle = na; }
        }
      }
      // Snap back onto the lane centreline after a turn.
      if (Math.abs(Math.sin(c.angle)) > 0.5) c.x = c.roadVal + (c.angle === Math.PI / 2 ? -16 : 16);
      else c.y = c.roadVal + (c.angle === 0 ? 16 : -16);
    }
    // Hit the player on foot: at most 25 HP per hit, with a cooldown.
    if (!p.inCar && p.hurtT <= 0 && S.time - c.lastHitT > 1.0) {
      const d = dist(c.x, c.y, p.x, p.y);
      if (d < 26 && Math.abs(c.speed) > 25) {
        const dmg = Math.min(25, 8 + Math.abs(c.speed) * 0.09);
        c.lastHitT = S.time;
        hooks.onPlayerHitByTraffic(dmg, c);
        c.speed *= 0.4;
      }
    }
    // Keep far cars near the action.
    if (dist(c.x, c.y, p.x, p.y) > 1400) {
      const nc = spawnTrafficCar(mulberry32((Math.random() * 1e9) | 0), S, false);
      c.x = nc.x; c.y = nc.y; c.angle = nc.angle; c.dir = nc.angle; c.road = nc.road; c.roadVal = nc.roadVal; c.speed = 0;
    }
  }
  // Hard separation: traffic cars never overlap each other (two passes so a
  // chain of queued cars settles in one frame).
  const tr = S.cars.filter((c) => c.kind === "traffic" && !c.dead);
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < tr.length; a++) {
      for (let b = a + 1; b < tr.length; b++) {
        const dx = tr[b].x - tr[a].x, dy = tr[b].y - tr[a].y;
        const d = Math.hypot(dx, dy);
        if (d < 30 && d > 0.01) {
          const push = (30 - d) / 2;
          const ux = dx / d, uy = dy / d;
          tr[a].x -= ux * push; tr[a].y -= uy * push;
          tr[b].x += ux * push; tr[b].y += uy * push;
        } else if (d <= 0.01) {
          tr[b].x += 16;
        }
      }
    }
  }
}

// ---- pedestrians ----
export function updatePeds(S, dt, hooks) {
  const p = S.player;
  for (const ped of S.peds) {
    if (ped.dead) continue;
    if (ped.down > 0) { ped.down -= dt; continue; }
    if (ped.panic > 0) {
      ped.panic -= dt;
      const a = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.x += Math.cos(a) * 150 * dt;
      ped.y += Math.sin(a) * 150 * dt;
      ped.angle = a;
      continue;
    }
    if (ped.foe) {
      // Dock crew: hold ground and shoot at the player when close.
      ped.shootT -= dt;
      const d = dist(ped.x, ped.y, p.x, p.y);
      if (d < 420 && ped.shootT <= 0) {
        ped.shootT = 1.4;
        ped.angle = Math.atan2(p.y - ped.x, p.x - ped.x);
        hooks.onFoeShot(ped);
      }
      continue;
    }
    if (ped.pause > 0) { ped.pause -= dt; continue; }
    const d = dist(ped.x, ped.y, ped.tx, ped.ty);
    if (d < 12) {
      ped.pause = Math.random() * 2.5;
      // New waypoint: along a sidewalk, sometimes across the street.
      const rx = pick(Math.random, ROADS_X);
      const ry = pick(Math.random, ROADS_Y);
      if (Math.random() > 0.5) { ped.tx = rx + (Math.random() > 0.5 ? 55 : -55); ped.ty = ped.y + (Math.random() - 0.5) * 300; }
      else { ped.ty = ry + (Math.random() > 0.5 ? 55 : -55); ped.tx = ped.x + (Math.random() - 0.5) * 300; }
      ped.tx = clamp(ped.tx, 60, WORLD.w - 60);
      ped.ty = clamp(ped.ty, 60, WORLD.h - 60);
    } else {
      const a = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
      ped.angle = a;
      const nx = ped.x + Math.cos(a) * ped.walkSpeed * dt;
      const ny = ped.y + Math.sin(a) * ped.walkSpeed * dt;
      const r = collideBuildings({ buildings: hooks.cityBuildings }, nx, ny, 8);
      ped.x = r.x; ped.y = r.y;
    }
  }
  // Dead / down peds never block the street forever: respawn far ones.
  for (let i = 0; i < S.peds.length; i++) {
    const ped = S.peds[i];
    if (ped.dead && dist(ped.x, ped.y, p.x, p.y) > 900) {
      S.peds[i] = spawnPed(mulberry32((Math.random() * 1e9) | 0), S);
    }
  }
}

// ---- police ----
export function updatePolice(S, dt, hooks) {
  const p = S.player;
  // Cops who lost the trail break off instead of respawning forever.
  const want = S.wanted > 0 && (S.evadeT || 0) <= 8 ? Math.min(6, S.wanted + 1) : 0;
  // Spawn police cars near (but not on top of) the player.
  while (S.cops.length < want) {
    const a = Math.random() * Math.PI * 2;
    const rx = p.x + Math.cos(a) * 720, ry = p.y + Math.sin(a) * 720;
    const c = makeCar("police", clamp(rx, 60, WORLD.w - 60), clamp(ry, 60, WORLD.h - 60), a, "#1c2733", false);
    c.speed = 120;
    S.cars.push(c);
    S.cops.push(c);
  }
  while (S.cops.length > want) {
    const c = S.cops.pop();
    c.dead = true;
    S.cars = S.cars.filter((x) => x !== c);
  }
  for (const c of S.cops) {
    if (c.dead) continue;
    const d = dist(c.x, c.y, p.x, p.y);
    const wantAngle = Math.atan2(p.y - c.y, p.x - c.x);
    c.angle = angleLerp(c.angle, wantAngle, Math.min(1, 2.2 * dt));
    const targetSpeed = d > 90 ? 330 : 200;
    c.speed = Math.min(targetSpeed, c.speed + 240 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    const r = collideBuildings({ buildings: hooks.cityBuildings }, c.x, c.y, 15);
    c.x = r.x; c.y = r.y;
    c.sirenT -= dt;
    if (c.sirenT <= 0) { c.sirenT = 2.2; hooks.onSiren(); }
    // Cops shoot when close and wanted is 2+.
    if (S.wanted >= 2 && d < 460 && S.time - (c.lastShot || 0) > 1.6) {
      c.lastShot = S.time;
      hooks.onCopShot(c);
    }
    // Cop rams the player on foot: hurts, but never more than 25.
    if (!p.inCar && d < 26 && S.time - c.lastHitT > 1.2) {
      c.lastHitT = S.time;
      hooks.onPlayerHitByTraffic(Math.min(25, 15), c);
    }
  }
  // Roadblocks at wanted 4-5: two police cars across the road ahead.
  if (S.wanted >= 4) {
    if (S.roadblocks.length === 0 || S.time - S.roadblockT > 18) {
      S.roadblocks = [];
      S.roadblockT = S.time;
      const fx = p.x + Math.cos(p.angle) * 420, fy = p.y + Math.sin(p.angle) * 420;
      const perp = p.angle + Math.PI / 2;
      for (const off of [-34, 34]) {
        const c = makeCar("police", fx + Math.cos(perp) * off, fy + Math.sin(perp) * off, perp, "#1c2733", false);
        S.cars.push(c);
        S.roadblocks.push(c);
      }
      hooks.onRoadblock();
    }
  } else if (S.roadblocks.length) {
    for (const c of S.roadblocks) { c.dead = true; S.cars = S.cars.filter((x) => x !== c); }
    S.roadblocks = [];
  }
}
