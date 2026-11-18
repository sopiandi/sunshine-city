// Sunshine City — the simulation. No drawing and no browser in here: the
// player on foot and in cars, traffic, pedestrians, police, wanted level,
// combat, pickups and the five story missions. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react
// (sound, save, announcements) without the world knowing about screens.
import { CAR, CAR_COLORS, PED_COUNT, PLAYER, POLICE, STEP, TRAFFIC_COUNT, WANTED_DECAY_SECONDS, WORLD } from './config.js';
import { ROADS_H, ROADS_V, ROAD_W, buildCity, buildingAt, isOnRoad, nearestRoadPoint } from './city.js';
import { MISSIONS } from './missions.js';

export const EVENT_SHOOT = 1;
export const EVENT_ENEMY_SHOOT = 2;
export const EVENT_PICKUP = 4;
export const EVENT_CASH = 8;
export const EVENT_MISSION = 16;
export const EVENT_HURT = 32;
export const EVENT_BUSTED = 64;
export const EVENT_WANTED = 128;
export const EVENT_WIN = 256;

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

export function createWorld(random) {
  const city = buildCity(random);
  const player = {
    x: 320, y: 1000, angle: -Math.PI / 2, health: PLAYER.health,
    cash: 40, ammo: PLAYER.ammoMax, reserve: PLAYER.reserveMax,
    reload: 0, cooldown: 0, inCar: null, aimAngle: 0,
  };
  const cars = [];
  const peds = [];
  const enemies = [];
  const bullets = [];
  const pickups = [];
  const state = {
    player, cars, peds, enemies, bullets, pickups, city,
    wanted: 0, wantedTimer: 0, crimeTimer: 0,
    missionIndex: 0, mission: null, missionTimer: 0, missionStage: 0,
    checkpoint: 0, hasPackage: false, enemiesLeft: 0,
    elapsed: 0, message: '', messageTimer: 0, won: false, busted: false,
    bestCash: 40, carsStolen: 0, missionsDone: 0,
  };

  function say(text, seconds) {
    state.message = text;
    state.messageTimer = seconds || 4;
  }

  function addWanted(n) {
    const before = state.wanted;
    state.wanted = clamp(state.wanted + n, 0, 5);
    state.crimeTimer = 0;
    if (state.wanted > before) return EVENT_WANTED;
    return 0;
  }

  function spawnPickups() {
    pickups.length = 0;
    const spots = [
      { x: 650, y: 600, kind: 'cash', amount: 50 }, { x: 1800, y: 850, kind: 'health', amount: 40 },
      { x: 2600, y: 1600, kind: 'ammo', amount: 24 }, { x: 1100, y: 2100, kind: 'cash', amount: 80 },
      { x: 3100, y: 700, kind: 'health', amount: 40 }, { x: 500, y: 1600, kind: 'cash', amount: 60 },
      { x: 2600, y: 2100, kind: 'ammo', amount: 24 }, { x: 2100, y: 500, kind: 'cash', amount: 50 },
    ];
    for (const s of spots) pickups.push({ ...s, active: true });
  }

  function spawnTraffic() {
    cars.length = 0;
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
      const vertical = random() < 0.5;
      const road = vertical ? ROADS_V[Math.floor(random() * ROADS_V.length)] : ROADS_H[Math.floor(random() * ROADS_H.length)];
      const along = 200 + random() * (WORLD.height - 400);
      cars.push({
        id: i, kind: 'traffic', color: CAR_COLORS[Math.floor(random() * CAR_COLORS.length)],
        x: vertical ? road + (random() < 0.5 ? -22 : 22) : along,
        y: vertical ? along : road + (random() < 0.5 ? -22 : 22),
        angle: vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI),
        speed: 130 + random() * 80, health: 100, vertical, dir: random() < 0.5 ? 1 : -1,
        stolen: false, dead: false,
      });
    }
    // Parked, stealable cars — all parked ON roads (lane edge), never inside a block.
    const parked = [
      { x: 628, y: 1120, angle: Math.PI / 2 }, { x: 1128, y: 600, angle: -Math.PI / 2 },
      { x: 1628, y: 1400, angle: Math.PI / 2 }, { x: 2128, y: 1000, angle: -Math.PI / 2 },
      { x: 2628, y: 2000, angle: Math.PI / 2 }, { x: 3128, y: 1500, angle: -Math.PI / 2 },
      { x: 900, y: 378, angle: 0 }, { x: 2800, y: 878, angle: Math.PI },
    ];
    parked.forEach((p, i) => cars.push({
      id: 100 + i, kind: 'parked', color: CAR_COLORS[(i + 2) % CAR_COLORS.length],
      x: p.x, y: p.y, angle: p.angle, speed: 0, health: 100,
      vertical: false, dir: 1, stolen: false, dead: false,
    }));
  }

  function spawnPeds() {
    peds.length = 0;
    for (let i = 0; i < PED_COUNT; i += 1) {
      const pt = nearestRoadPoint(400 + random() * 3000, 200 + random() * 2200);
      // Stand on the sidewalk beside the road (65px out), never inside a block.
      const side = random() < 0.5 ? -65 : 65;
      const along = (random() - 0.5) * 200;
      peds.push({
        x: pt.vertical ? pt.x + side : pt.x + along, y: pt.vertical ? pt.y + along : pt.y + side,
        angle: random() * Math.PI * 2, speed: 45 + random() * 40,
        color: ['#e76f51', '#2a9d8f', '#e9c46a', '#8e6cc8', '#f1faee'][i % 5],
        flee: 0, down: false, downTimer: 0,
      });
    }
  }

  function startMission(index) {
    const m = MISSIONS[index];
    if (!m) { state.mission = null; return; }
    state.missionIndex = index;
    state.mission = m;
    state.missionStage = 0;
    state.checkpoint = 0;
    state.hasPackage = false;
    state.missionTimer = m.timeLimit || 0;
    state.enemiesLeft = 0;
    enemies.length = 0;
    if (m.type === 'escape') {
      state.wanted = 3;
      state.crimeTimer = 0;
    }
    say(`${m.title}: ${m.brief}`, 6);
  }

  function completeMission() {
    const m = state.mission;
    if (!m) return EVENT_MISSION;
    player.cash += m.reward;
    state.bestCash = Math.max(state.bestCash, player.cash);
    state.missionsDone += 1;
    state.missionIndex += 1;
    say(`Mission complete! +$${m.reward} — ${m.title}`, 5);
    let events = EVENT_MISSION | EVENT_CASH;
    if (state.missionIndex >= MISSIONS.length) {
      state.won = true;
      events |= EVENT_WIN;
    } else {
      startMission(state.missionIndex);
    }
    return events;
  }

  function reset() {
    player.x = 320; player.y = 1000; player.angle = -Math.PI / 2;
    player.health = PLAYER.health; player.cash = 40;
    player.ammo = PLAYER.ammoMax; player.reserve = PLAYER.reserveMax;
    player.reload = 0; player.cooldown = 0; player.inCar = null;
    state.wanted = 0; state.wantedTimer = 0; state.crimeTimer = 0;
    state.missionIndex = 0; state.elapsed = 0; state.won = false; state.busted = false;
    state.bestCash = 40; state.carsStolen = 0; state.missionsDone = 0;
    enemies.length = 0; bullets.length = 0;
    spawnTraffic(); spawnPeds(); spawnPickups();
    startMission(0);
  }

  function collideBuildings(x, y, radius) {
    // Axis-separated slide: try x then y, so the player slides along walls.
    return buildingAt(city.buildings, x, y, radius);
  }

  function moveWithCollision(entity, dx, dy, radius) {
    const nx = entity.x + dx;
    if (!collideBuildings(nx, entity.y, radius) && nx > 250 && nx < WORLD.width - 20) entity.x = nx;
    const ny = entity.y + dy;
    if (!collideBuildings(entity.x, ny, radius) && ny > 20 && ny < WORLD.height - 20) entity.y = ny;
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (car.dead || car.kind === 'police') continue;
      const d = dist(player.x, player.y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function spawnPolice() {
    const want = Math.min(state.wanted, POLICE.maxChase);
    const have = cars.filter((c) => c.kind === 'police' && !c.dead).length;
    for (let i = have; i < want; i += 1) {
      const pt = nearestRoadPoint(player.x + (random() < 0.5 ? -700 : 700), player.y + (random() < 0.5 ? -500 : 500));
      cars.push({
        id: 200 + Date.now() % 100000 + i, kind: 'police', color: '#1d3557',
        x: clamp(pt.x, 300, WORLD.width - 100), y: clamp(pt.y, 100, WORLD.height - 100),
        angle: 0, speed: 0, health: 120, vertical: false, dir: 1, stolen: false, dead: false,
        shootCooldown: 1 + random(),
      });
    }
  }

  function spawnEnemiesAt(x, y, count) {
    enemies.length = 0;
    for (let i = 0; i < count; i += 1) {
      enemies.push({
        x: x + (random() - 0.5) * 240, y: y + (random() - 0.5) * 60,
        angle: 0, health: 100, cooldown: 1 + random() * 2, speed: 90,
      });
    }
    state.enemiesLeft = count;
  }

  function missionTarget() {
    const m = state.mission;
    if (!m) return null;
    if (m.type === 'race') return { ...m.checkpoints[state.checkpoint], label: `Checkpoint ${state.checkpoint + 1}/${m.checkpoints.length}` };
    if (m.type === 'deliver') return state.missionStage === 0 ? { ...m.pickup, label: 'Pick up the package' } : { ...m.target, label: 'Deliver the package' };
    if (m.type === 'shootout') {
      if (state.missionStage === 0) return { ...m.target, label: 'Go to the Old Docks' };
      if (state.missionStage === 1) return { ...m.target, label: `Take out Vic's crew (${state.enemiesLeft} left)` };
      return { ...m.finalTarget, label: 'Reach Palm Tower' };
    }
    if (m.type === 'escape') return { ...m.target, label: 'Survive — then reach the Hideout' };
    return { ...m.target, label: m.objective };
  }

  function stepTraffic(dt) {
    for (const car of cars) {
      if (car.dead || car.kind !== 'traffic') continue;
      // Slow down only for a car actually ahead on the same road, not for
      // one behind (a player tailgating should not make traffic crawl).
      let ahead = false;
      for (const other of cars) {
        if (other === car || other.dead) continue;
        const d = dist(car.x, car.y, other.x, other.y);
        if (d >= 90) continue;
        const forward = Math.cos(car.angle) * (other.x - car.x) + Math.sin(car.angle) * (other.y - car.y);
        if (forward > 0) { ahead = true; break; }
      }
      const speed = ahead ? car.speed * 0.4 : car.speed;
      const dx = Math.cos(car.angle) * speed * dt * car.dir;
      const dy = Math.sin(car.angle) * speed * dt * car.dir;
      const nx = car.x + dx;
      const ny = car.y + dy;
      if (collideBuildings(nx, ny, 30)) {
        car.dir *= -1;
        car.angle += Math.PI;
        continue;
      }
      car.x = clamp(nx, 300, WORLD.width - 20);
      car.y = clamp(ny, 20, WORLD.height - 20);
      // At an intersection, sometimes turn onto the crossing road.
      const onCross = car.vertical
        ? ROADS_H.some((ry) => Math.abs(car.y - ry) < 12)
        : ROADS_V.some((rx) => Math.abs(car.x - rx) < 12);
      if (onCross && random() < 0.004) {
        car.vertical = !car.vertical;
        car.angle = car.vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
        car.dir = 1;
      }
      if (car.x <= 310 || car.x >= WORLD.width - 30 || car.y <= 30 || car.y >= WORLD.height - 30) {
        car.dir *= -1;
        car.angle += Math.PI;
      }
    }
  }

  function stepPeds(dt) {
    for (const ped of peds) {
      if (ped.down) {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          const pt = nearestRoadPoint(400 + random() * 3000, 200 + random() * 2200);
          const side = random() < 0.5 ? -65 : 65;
          const along = (random() - 0.5) * 200;
          ped.x = pt.vertical ? pt.x + side : pt.x + along;
          ped.y = pt.vertical ? pt.y + along : pt.y + side;
          ped.down = false;
        }
        continue;
      }
      const playerCar = player.inCar;
      const threatX = playerCar ? playerCar.x : player.x;
      const threatY = playerCar ? playerCar.y : player.y;
      const threatSpeed = playerCar ? Math.abs(playerCar.speed) : 0;
      const dThreat = dist(ped.x, ped.y, threatX, threatY);
      if (dThreat < 120 && (threatSpeed > 200 || ped.flee > 0)) ped.flee = 1.5;
      if (ped.flee > 0) {
        ped.flee -= dt;
        ped.angle = angleTo(threatX, threatY, ped.x, ped.y);
        moveWithCollision(ped, Math.cos(ped.angle) * 150 * dt, Math.sin(ped.angle) * 150 * dt, 10);
        continue;
      }
      if (random() < 0.002) ped.angle = random() * Math.PI * 2;
      moveWithCollision(ped, Math.cos(ped.angle) * ped.speed * dt, Math.sin(ped.angle) * ped.speed * dt, 10);
    }
  }

  function stepPolice(dt) {
    if (state.wanted > 0) {
      state.wantedTimer -= dt;
      if (state.wantedTimer <= 0) { spawnPolice(); state.wantedTimer = 2; }
    }
    let events = 0;
    for (const car of cars) {
      if (car.dead || car.kind !== 'police') continue;
      if (state.wanted === 0) { car.dead = true; continue; }
      const targetX = player.inCar ? player.inCar.x : player.x;
      const targetY = player.inCar ? player.inCar.y : player.y;
      const d = dist(car.x, car.y, targetX, targetY);
      const wantAngle = angleTo(car.x, car.y, targetX, targetY);
      let diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
      const targetSpeed = 420 + state.wanted * 25;
      car.speed = Math.min(targetSpeed, car.speed + 420 * dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      let blocked = false;
      if (!collideBuildings(nx, car.y, 26)) car.x = nx;
      else blocked = true;
      if (!collideBuildings(car.x, ny, 26)) car.y = ny;
      else blocked = true;
      if (blocked) car.speed *= 0.7;
      // Ram the player.
      if (d < 62) {
        car.speed *= 0.8;
        if (car.speed > 200 && (!car.ramCooldown || car.ramCooldown <= 0)) {
          player.health -= POLICE.ramDamage;
          car.ramCooldown = 3.0;
          events |= EVENT_HURT;
        }
      }
      if (car.ramCooldown) car.ramCooldown -= dt;
      // At 4+ stars the police shoot from a distance.
      if (state.wanted >= 4 && d > 140 && d < POLICE.shootRange) {
        car.shootCooldown -= dt;
        if (car.shootCooldown <= 0) {
          car.shootCooldown = POLICE.shootCooldown;
          const a = angleTo(car.x, car.y, player.x, player.y) + (random() - 0.5) * 0.3;
          bullets.push({ x: car.x, y: car.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, life: 1.6, fromPlayer: false, damage: 5 });
          events |= EVENT_ENEMY_SHOOT;
        }
      }
    }
    return events;
  }

  function stepBullets(dt) {
    let events = 0;
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height;
      if (!dead && buildingAt(city.buildings, b.x, b.y, 0)) dead = true;
      if (!dead && b.fromPlayer) {
        for (const e of enemies) {
          if (e.health > 0 && dist(b.x, b.y, e.x, e.y) < 20) {
            e.health -= b.damage || PLAYER.bulletDamage;
            dead = true;
            if (e.health <= 0) {
              state.enemiesLeft -= 1;
              player.cash += 25;
              say('Crew member down. +$25', 2);
            }
            break;
          }
        }
        if (!dead) {
          for (const car of cars) {
            if (car.dead || car === player.inCar) continue;
            if (dist(b.x, b.y, car.x, car.y) < 38) {
              car.health -= b.damage || PLAYER.bulletDamage;
              dead = true;
              if (car.health <= 0) {
                car.dead = true;
                if (car.kind === 'police') events |= addWanted(2);
                else events |= addWanted(1);
                player.cash += 50;
                say('Car destroyed. +$50', 2);
              }
              break;
            }
          }
        }
        if (!dead) {
          for (const ped of peds) {
            if (!ped.down && dist(b.x, b.y, ped.x, ped.y) < 15) {
              ped.down = true;
              ped.downTimer = 6;
              dead = true;
              events |= addWanted(1);
              break;
            }
          }
        }
      }
      if (!dead && !b.fromPlayer) {
        const px = player.inCar ? player.inCar.x : player.x;
        const py = player.inCar ? player.inCar.y : player.y;
        if (dist(b.x, b.y, px, py) < 18) {
          player.health -= b.damage || 8;
          dead = true;
          events |= EVENT_HURT;
        }
      }
      if (dead) bullets.splice(i, 1);
    }
    return events;
  }

  function stepMission(dt) {
    const m = state.mission;
    if (!m || state.won) return 0;
    let events = 0;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    if (m.type === 'race') {
      state.missionTimer -= dt;
      const cp = m.checkpoints[state.checkpoint];
      if (dist(px, py, cp.x, cp.y) < 95) {
        state.checkpoint += 1;
        say(`Checkpoint ${state.checkpoint}/${m.checkpoints.length}!`, 2);
        events |= EVENT_CASH;
        if (state.checkpoint >= m.checkpoints.length) return completeMission();
      }
      if (state.missionTimer <= 0) {
        say('Too slow — race again from the start line.', 4);
        startMission(state.missionIndex);
      }
      return events;
    }
    if (m.type === 'escape') {
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) {
        state.wanted = 0;
        for (const car of cars) if (car.kind === 'police') car.dead = true;
        return completeMission();
      }
      return events;
    }
    if (m.type === 'steal') {
      if (player.inCar && dist(px, py, m.target.x, m.target.y) < 110) return completeMission();
      return events;
    }
    if (m.type === 'deliver') {
      if (state.missionStage === 0 && dist(px, py, m.pickup.x, m.pickup.y) < 85) {
        state.missionStage = 1;
        state.hasPackage = true;
        say('Package collected — deliver it to Marina Bay.', 4);
      } else if (state.missionStage === 1 && dist(px, py, m.target.x, m.target.y) < 110) {
        return completeMission();
      }
      return events;
    }
    if (m.type === 'shootout') {
      if (state.missionStage === 0 && dist(px, py, m.target.x, m.target.y) < 140) {
        state.missionStage = 1;
        spawnEnemiesAt(m.target.x, m.target.y, m.enemies);
        say(`Vic's crew is here — ${m.enemies} of them. Take them all out!`, 5);
      } else if (state.missionStage === 1 && state.enemiesLeft <= 0) {
        state.missionStage = 2;
        say('Docks clear. Get to Palm Tower and finish this.', 4);
      } else if (state.missionStage === 2 && dist(px, py, m.finalTarget.x, m.finalTarget.y) < 110) {
        return completeMission();
      }
      return events;
    }
    return events;
  }

  function step(dt, input) {
    let events = 0;
    state.elapsed += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (player.cooldown > 0) player.cooldown -= dt;
    if (player.reload > 0) {
      player.reload -= dt;
      if (player.reload <= 0) {
        const need = PLAYER.ammoMax - player.ammo;
        const take = Math.min(need, player.reserve);
        player.ammo += take;
        player.reserve -= take;
      }
    }
    if (state.busted || state.won) return events;

    // Wanted decays after a quiet spell; health slowly recovers when the
    // police are not after the player.
    if (state.wanted > 0) {
      state.crimeTimer += dt;
      if (state.crimeTimer > WANTED_DECAY_SECONDS) {
        state.wanted -= 1;
        state.crimeTimer = 0;
        if (state.wanted === 0) for (const car of cars) if (car.kind === 'police') car.dead = true;
      }
    } else if (player.health > 0 && player.health < PLAYER.health) {
      player.health = Math.min(PLAYER.health, player.health + 4 * dt);
    }

    const aimAngle = Math.atan2(input.aimY - player.y, input.aimX - player.x);
    player.aimAngle = aimAngle;

    // Enter / exit a car.
    if (input.enter) {
      if (player.inCar) {
        const car = player.inCar;
        player.inCar = null;
        player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 55;
        player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 55;
        player.angle = car.angle;
      } else {
        const car = nearestCar(75);
        if (car) {
          player.inCar = car;
          car.speed = 0;
          if (!car.stolen) {
            car.stolen = true;
            state.carsStolen += 1;
            if (car.kind !== 'parked') events |= addWanted(1);
            else events |= addWanted(1);
            say(car.kind === 'parked' ? 'Car taken. The owner will notice.' : 'Car jacked! The police are coming.', 3);
          }
        }
      }
    }

    // Shooting (on foot only).
    if (input.shooting && !player.inCar && player.reload <= 0 && player.cooldown <= 0) {
      if (player.ammo > 0) {
        player.ammo -= 1;
        player.cooldown = PLAYER.shootCooldown;
        player.angle = aimAngle;
        bullets.push({
          x: player.x + Math.cos(aimAngle) * 22, y: player.y + Math.sin(aimAngle) * 22,
          vx: Math.cos(aimAngle) * PLAYER.bulletSpeed, vy: Math.sin(aimAngle) * PLAYER.bulletSpeed,
          life: PLAYER.bulletRange / PLAYER.bulletSpeed, fromPlayer: true, damage: PLAYER.bulletDamage,
        });
        events |= EVENT_SHOOT;
        for (const ped of peds) if (dist(ped.x, ped.y, player.x, player.y) < 260) ped.flee = 1.5;
      } else if (player.reserve > 0) {
        player.reload = PLAYER.reloadTime;
      }
    }
    if (input.reload && player.reload <= 0 && player.ammo < PLAYER.ammoMax && player.reserve > 0) {
      player.reload = PLAYER.reloadTime;
    }

    if (player.inCar) {
      const car = player.inCar;
      const accel = input.up ? 1 : input.down ? -1 : 0;
      const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      if (accel > 0) car.speed += CAR.accel * dt;
      else if (accel < 0) car.speed += (car.speed > 0 ? -CAR.brake : -CAR.reverseAccel) * dt;
      car.speed -= car.speed * CAR.drag * dt;
      car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
      if (Math.abs(car.speed) < 4 && accel === 0) car.speed = 0;
      car.angle += steer * CAR.turnRate * dt * clamp(Math.abs(car.speed) / 220, 0.3, 1) * (car.speed < 0 ? -1 : 1);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      // Move axis by axis so the car slides along a building wall instead of
      // bouncing off a corner and getting stuck there. Speed is cut at most
      // once a frame when a wall is hit, so the car can still pull away.
      let blocked = false;
      if (!collideBuildings(nx, car.y, 26)) car.x = clamp(nx, 260, WORLD.width - 20);
      else blocked = true;
      if (!collideBuildings(car.x, ny, 26)) car.y = clamp(ny, 20, WORLD.height - 20);
      else blocked = true;
      if (blocked) car.speed *= 0.7;
      player.x = car.x; player.y = car.y; player.angle = car.angle;
      // Running over pedestrians in a car.
      for (const ped of peds) {
        if (!ped.down && dist(ped.x, ped.y, car.x, car.y) < 42 && Math.abs(car.speed) > 90) {
          ped.down = true; ped.downTimer = 6;
          events |= addWanted(1);
          say('You hit a pedestrian!', 2);
        }
      }
      // Bumping traffic: do not drive through other cars. If the other car
      // is ahead, match its speed (and nudge it along); otherwise just slow.
      // Police cars are skipped here — their ram is handled in stepPolice.
      for (const other of cars) {
        if (other === car || other.dead || other.kind === 'police') continue;
        if (dist(car.x, car.y, other.x, other.y) < 72) {
          const ahead = Math.cos(car.angle) * (other.x - car.x) + Math.sin(car.angle) * (other.y - car.y) > 0;
          if (ahead) {
            car.speed = Math.min(car.speed, Math.max(other.speed || 0, 140));
            if (other.kind === 'traffic') {
              other.x += Math.cos(other.angle) * other.dir * 30 * dt;
              other.y += Math.sin(other.angle) * other.dir * 30 * dt;
            }
          } else car.speed *= 0.92;
        }
      }
    } else {
      const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        moveWithCollision(player, (mx / len) * speed * dt, (my / len) * speed * dt, PLAYER.radius);
        player.angle = Math.atan2(my, mx);
      }
      // Traffic can hit a player on foot — but only when the player is
      // actually standing on the road, never on the sidewalk or beach.
      for (const car of cars) {
        if (car.dead || car.kind !== 'traffic') continue;
        if (!isOnRoad(player.x, player.y)) continue;
        if (dist(player.x, player.y, car.x, car.y) < 42 && Math.abs(car.speed) > 60) {
          player.health -= 10;
          events |= EVENT_HURT;
          moveWithCollision(player, Math.cos(car.angle) * 40, Math.sin(car.angle) * 40, PLAYER.radius);
        }
      }
    }

    stepTraffic(dt);
    stepPeds(dt);
    events |= stepPolice(dt);
    events |= stepBullets(dt);

    // Enemy gang members (mission 5).
    for (const e of enemies) {
      if (e.health <= 0) continue;
      const d = dist(e.x, e.y, player.x, player.y);
      e.angle = angleTo(e.x, e.y, player.x, player.y);
      if (d > 200) moveWithCollision(e, Math.cos(e.angle) * e.speed * dt, Math.sin(e.angle) * e.speed * dt, 12);
      e.cooldown -= dt;
      if (e.cooldown <= 0 && d < 520) {
        e.cooldown = 1.6 + random() * 0.8;
        const a = angleTo(e.x, e.y, player.x, player.y) + (random() - 0.5) * 0.2;
        bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, life: 1.4, fromPlayer: false, damage: 8 });
        events |= EVENT_ENEMY_SHOOT;
      }
    }

    // Pickups.
    for (const p of pickups) {
      if (!p.active) {
        p.respawn = (p.respawn || 0) - dt;
        if (p.respawn <= 0) p.active = true;
        continue;
      }
      if (dist(player.x, player.y, p.x, p.y) < 34) {
        p.active = false;
        p.respawn = 25;
        if (p.kind === 'cash') { player.cash += p.amount; state.bestCash = Math.max(state.bestCash, player.cash); events |= EVENT_CASH; }
        if (p.kind === 'health') player.health = Math.min(PLAYER.health, player.health + p.amount);
        if (p.kind === 'ammo') player.reserve = Math.min(PLAYER.reserveMax, player.reserve + p.amount);
        events |= EVENT_PICKUP;
      }
    }

    events |= stepMission(dt);

    if (player.health <= 0 && !state.busted) {
      state.busted = true;
      player.health = 0;
      events |= EVENT_BUSTED;
    }
    return events;
  }

  function respawnAfterBusted() {
    player.health = PLAYER.health;
    player.cash = Math.max(0, player.cash - 100);
    player.x = 1100; player.y = 1850;
    player.inCar = null;
    player.ammo = PLAYER.ammoMax;
    player.reserve = PLAYER.reserveMax;
    state.wanted = 0;
    state.busted = false;
    for (const car of cars) if (car.kind === 'police') car.dead = true;
    enemies.length = 0;
    if (state.mission && state.mission.type === 'shootout' && state.missionStage >= 1) {
      state.missionStage = 0;
      state.enemiesLeft = 0;
    }
    say('You woke up at Sunshine Clinic. -$100 hospital bill.', 5);
  }

  function saveData() {
    return {
      cash: player.cash, missionIndex: state.missionIndex, missionsDone: state.missionsDone,
      bestCash: state.bestCash, carsStolen: state.carsStolen,
      x: player.x, y: player.y, health: player.health,
    };
  }

  function loadData(data) {
    if (!data || typeof data !== 'object') return false;
    player.cash = typeof data.cash === 'number' ? data.cash : 40;
    state.bestCash = Math.max(player.cash, data.bestCash || 0);
    state.missionsDone = data.missionsDone || 0;
    state.carsStolen = data.carsStolen || 0;
    state.missionIndex = Math.min(data.missionIndex || 0, MISSIONS.length - 1);
    player.x = data.x || 320;
    player.y = data.y || 1000;
    player.health = data.health || PLAYER.health;
    startMission(state.missionIndex);
    return true;
  }

  reset();
  return { state, reset, step, startMission, missionTarget, respawnAfterBusted, saveData, loadData, say };
}
