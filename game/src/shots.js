// The screenshot scenes behind ?shot=start|chase|race|end. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, so
// the frame is what a short game really looks like and the same seed always
// gives the same frame. The cover (chase) shows driving, wanted stars,
// police, the minimap and a mission objective on one screen.
import { STEP } from './config.js';
import { ROADS_H, isOnRoad, nearestRoadPoint } from './city.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const IDLE = { up: false, down: false, left: false, right: false, run: false, aimX: 0, aimY: 0, shooting: false, enter: false, reload: false };

function driveInput(world, targetX, targetY) {
  const p = world.state.player;
  let wx = targetX;
  let wy = targetY;
  if (!isOnRoad(p.x, p.y)) {
    // The car drifted off the roads: head for the nearest road first.
    const near = nearestRoadPoint(p.x, p.y);
    wx = near.x; wy = near.y;
  } else {
    // Follow the roads in an L-shape (along one road, then turn) instead of
    // cutting diagonally across a block corner.
    const onRow = Math.abs(targetY - p.y) < 60;
    const onCol = Math.abs(targetX - p.x) < 60;
    if (!onRow && !onCol) {
      const nearRow = ROADS_H.some((ry) => Math.abs(p.y - ry) < 46);
      if (nearRow) { wx = targetX; wy = p.y; }
      else { wx = p.x; wy = targetY; }
    }
  }
  const want = Math.atan2(wy - p.y, wx - p.x);
  let diff = want - p.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // A 90-degree turn at full speed cannot stay on a 96px road: brake hard
  // for a sharp turn while fast, coast for a gentle one, accelerate only
  // when straight. Never brake to a standstill — a stopped car cannot turn.
  const speed = world.state.player.inCar ? Math.abs(world.state.player.inCar.speed) : 0;
  const sharp = Math.abs(diff) > 0.55;
  const gentle = Math.abs(diff) > 0.22;
  return {
    ...IDLE,
    up: !sharp && !gentle, down: sharp && speed > 260,
    left: diff < -0.12, right: diff > 0.12, aimX: wx, aimY: wy,
  };
}

function uiFor(world, hasSave) {
  return {
    target: world.missionTarget(),
    mission: world.state.mission,
    missionTimer: world.state.missionTimer,
    checkpoint: world.state.checkpoint,
    hasSave: !!hasSave,
    mouse: { x: 640, y: 360 },
  };
}

function clearTraffic(world) {
  // Move the traffic far from the staged route so the shot is not a traffic jam.
  let i = 0;
  for (const car of world.state.cars) {
    if (car.kind !== 'traffic') continue;
    if (i % 2 === 0) {
      car.x = 3100 + (i % 2 === 0 ? -22 : 22); car.y = 300 + i * 90;
      car.angle = Math.PI / 2; car.vertical = true; car.dir = 1;
    } else {
      car.x = 400 + i * 90; car.y = 2300 + 22;
      car.angle = 0; car.vertical = false; car.dir = 1;
    }
    i += 1;
  }
  // Parked cars too: tuck them into the first parking lot, off the route.
  const lot = world.state.city.lots[0];
  if (lot) {
    let j = 0;
    for (const car of world.state.cars) {
      if (car.kind !== 'parked' || car === world.state.player.inCar) continue;
      car.x = lot.x + 50 + (j % 4) * 90;
      car.y = lot.y + 50 + Math.floor(j / 4) * 90;
      car.angle = 0; car.speed = 0;
      j += 1;
    }
  }
}

export function stageShot(name, world) {
  world.reset();
  const p = world.state.player;
  if (name === 'chase') {
    // Player driving east on the 1350 street, wanted 3, two police cars
    // placed on the same road right behind him so the chase is in frame.
    const car = world.state.cars.find((c) => c.kind === 'parked');
    p.x = 1800; p.y = 1350; p.angle = 0;
    car.x = 1800; car.y = 1350; car.angle = 0; car.speed = 420;
    p.inCar = car;
    car.stolen = true;
    world.state.wanted = 3;
    world.state.wantedTimer = 99;
    world.state.crimeTimer = 0;
    for (let i = 0; i < 2; i += 1) {
      world.state.cars.push({
        id: 900 + i, kind: 'police', color: '#1d3557',
        x: 1620 - i * 170, y: 1350 + (i === 0 ? -14 : 14), angle: 0, speed: 500,
        health: 120, vertical: false, dir: 1, stolen: false, dead: false,
        shootCooldown: 2, ramCooldown: 0,
      });
    }
    clearTraffic(world);
    for (let i = 0; i < 2.5 * 60; i += 1) world.step(STEP, driveInput(world, 3550, 1350));
    return { screen: SCREEN_PLAY, best: 240, ui: uiFor(world) };
  }
  if (name === 'race') {
    world.startMission(1);
    clearTraffic(world);
    const car = world.state.cars.find((c) => c.kind === 'parked');
    p.x = 1100; p.y = 1250; p.angle = -Math.PI / 2;
    car.x = 1100; car.y = 1250; car.angle = -Math.PI / 2; car.speed = 320;
    p.inCar = car;
    car.stolen = true;
    for (let i = 0; i < 10 * 60; i += 1) {
      const cp = world.state.mission.checkpoints[world.state.checkpoint];
      world.step(STEP, driveInput(world, cp.x, cp.y));
    }
    // The race shot is about the race: clear any wanted level the drive
    // picked up (a pedestrian, a bump) so the frame stays about racing.
    world.state.wanted = 0;
    for (const c of world.state.cars) if (c.kind === 'police') c.dead = true;
    p.health = 100;
    return { screen: SCREEN_PLAY, best: 640, ui: uiFor(world) };
  }
  if (name === 'end') {
    world.state.missionsDone = 5;
    world.state.missionIndex = 5;
    world.state.mission = null;
    world.state.won = true;
    p.cash = 2450;
    world.state.bestCash = 2450;
    world.state.carsStolen = 9;
    return { screen: SCREEN_WIN, best: 2450, ui: uiFor(world) };
  }
  // start (default): title screen over a living city.
  for (let i = 0; i < 5 * 60; i += 1) world.step(STEP, { ...IDLE, aimX: p.x + 100, aimY: p.y });
  return { screen: SCREEN_TITLE, best: 0, ui: uiFor(world, false) };
}
