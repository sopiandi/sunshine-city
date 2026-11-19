// Sunshine City v3 — all canvas drawing: city, actors, effects and HUD.
// The edge arrow sticks to the screen frame and always points at the
// active mission target; the minimap uses white/blue for the player and
// yellow for the target.
import { WORLD, ROADS_X, ROADS_Y, ROAD_W, CLINIC, districtAt } from "./config.js";
import { clamp, dist, fmtMoney } from "./random.js";
import { missionLabel, missionTarget, missionDistance } from "./missions.js";

export function drawWorld(ctx, S, city, view) {
  const { w, h } = view;
  ctx.fillStyle = "#7fae72";
  ctx.fillRect(0, 0, w, h);
  const camX = S.cam.x - w / 2, camY = S.cam.y - h / 2;
  ctx.save();
  ctx.translate(-camX, -camY);
  drawGround(ctx, city, camX, camY, w, h);
  drawRoads(ctx, camX, camY, w, h);
  drawBuildings(ctx, city, camX, camY, w, h);
  drawTrees(ctx, city, camX, camY, w, h);
  drawTargetMarker(ctx, S);
  drawCars(ctx, S, camX, camY, w, h);
  drawPeds(ctx, S, camX, camY, w, h);
  drawPlayer(ctx, S);
  drawEffects(ctx, S);
  ctx.restore();
  drawHUD(ctx, S, view);
}

function inView(x, y, camX, camY, w, h, m) {
  return x > camX - m && x < camX + w + m && y > camY - m && y < camY + h + m;
}

function drawGround(ctx, city, camX, camY, w, h) {
  // District ground tints.
  ctx.fillStyle = "#8fae7d"; ctx.fillRect(camX - 40, camY - 40, w + 80, h + 80);
  ctx.fillStyle = "rgba(47,168,160,0.25)";
  ctx.fillRect(0, 1500, 1150, 900); // Marina Bay
  ctx.fillStyle = "rgba(201,106,44,0.20)";
  ctx.fillRect(1700, 0, 1100, 1000); // Old Docks
  // Beach strip along the south-west edge.
  ctx.fillStyle = "#e8d9a0";
  ctx.fillRect(0, 2280, 1150, 120);
  ctx.fillStyle = "#3f9db8";
  ctx.fillRect(0, 2360, 1150, 40);
}

function drawRoads(ctx, camX, camY, w, h) {
  ctx.fillStyle = "#555a66";
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.h);
  for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD.w, ROAD_W);
  // Centre dashes.
  ctx.fillStyle = "#e8e8e8";
  for (const rx of ROADS_X) {
    for (let y = 0; y < WORLD.h; y += 56) {
      if (inView(rx, y, camX, camY, w, h, 40)) ctx.fillRect(rx - 2, y, 4, 26);
    }
  }
  for (const ry of ROADS_Y) {
    for (let x = 0; x < WORLD.w; x += 56) {
      if (inView(x, ry, camX, camY, w, h, 40)) ctx.fillRect(x, ry - 2, 26, 4);
    }
  }
  // District name signs on the road.
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  for (const s of [{ x: 350, y: 1520, t: "MARINA BAY", c: "#0e7c86" }, { x: 2100, y: 350, t: "OLD DOCKS", c: "#7a3b12" }, { x: 1350, y: 650, t: "DOWNTOWN", c: "#274b8f" }]) {
    if (!inView(s.x, s.y, camX, camY, w, h, 60)) continue;
    ctx.fillStyle = s.c;
    ctx.fillRect(s.x - 92, s.y - 16, 184, 32);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(s.t, s.x, s.y + 7);
  }
}

function drawBuildings(ctx, city, camX, camY, w, h) {
  for (const b of city.buildings) {
    if (!inView(b.x, b.y, camX, camY, w, h, 120)) continue;
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(b.x - b.w / 2 + 5, b.y - b.h / 2 + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, 8);
    // Windows.
    ctx.fillStyle = "rgba(40,60,90,0.55)";
    const cols = Math.max(1, Math.floor(b.w / 26)), rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      ctx.fillRect(b.x - b.w / 2 + 8 + i * 26, b.y - b.h / 2 + 16 + j * 26, 12, 12);
    }
    if (b.label && !b.cross) {
      ctx.fillStyle = "#222";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(b.label, b.x, b.y + 4);
    }
    if (b.cross) {
      ctx.fillStyle = "#d94f4f";
      ctx.fillRect(b.x - 4, b.y - 34, 8, 26);
      ctx.fillRect(b.x - 15, b.y - 21, 30, 8);
      ctx.fillStyle = "#222";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("CLINIC", b.x, b.y + b.h / 2 - 12);
    }
  }
  // Dock cranes.
  for (const c of city.cranes) {
    if (!inView(c.x, c.y, camX, camY, w, h, 120)) continue;
    ctx.strokeStyle = "#7a3b12"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(c.x - 30, c.y + 40); ctx.lineTo(c.x, c.y - 60); ctx.lineTo(c.x + 60, c.y - 60); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(c.x + 60, c.y - 60); ctx.lineTo(c.x + 60, c.y - 20); ctx.stroke();
  }
  // Starter parking lot bay lines (west of clinic).
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    const x = 880 + i * 30;
    ctx.beginPath(); ctx.moveTo(x, 1100); ctx.lineTo(x, 1210); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(880, 1210); ctx.lineTo(1000, 1210); ctx.stroke();
}

function drawTrees(ctx, city, camX, camY, w, h) {
  for (const t of city.trees) {
    if (!inView(t.x, t.y, camX, camY, w, h, 30)) continue;
    ctx.fillStyle = "#5a7a3a";
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    if (t.palm) {
      ctx.strokeStyle = "#4a6a2a"; ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + Math.cos(a) * 14, t.y + Math.sin(a) * 14); ctx.stroke();
      }
    }
  }
}

function drawTargetMarker(ctx, S) {
  const t = missionTarget(S);
  if (!t) return;
  const pulse = 1 + Math.sin(S.time * 5) * 0.15;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.strokeStyle = "#ffd23a"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#ffd23a";
  ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(10, -14); ctx.lineTo(-10, -14); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawCarShape(ctx, x, y, angle, color, opts) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(-19, -11, 40, 24);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-19, -11, 40, 22, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(180,220,255,0.85)";
  ctx.fillRect(-4, -9, 12, 18);
  ctx.fillStyle = "#ffe9a8";
  ctx.fillRect(17, -9, 3, 5); ctx.fillRect(17, 4, 3, 5);
  ctx.fillStyle = "#d94f4f";
  ctx.fillRect(-20, -9, 3, 5); ctx.fillRect(-20, 4, 3, 5);
  if (opts && opts.police) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-2, -11, 8, 22);
    ctx.fillStyle = "#274b8f";
    ctx.font = "bold 8px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("PD", 2, 3);
    if (opts.siren) {
      ctx.fillStyle = Math.floor(opts.siren * 4) % 2 ? "#ff2a2a" : "#2a6bff";
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawCars(ctx, S, camX, camY, w, h) {
  for (const c of S.cars) {
    if (c.dead) continue;
    if (!inView(c.x, c.y, camX, camY, w, h, 60)) continue;
    drawCarShape(ctx, c.x, c.y, c.angle, c.color, { police: c.kind === "police", siren: S.time });
    if (c.kind === "parked" && !c.stolen) {
      // Hint ring on the nearest stealable car is drawn by the HUD hint.
    }
    if (c.hp < 100 && c.hp > 0) {
      ctx.fillStyle = "#222";
      ctx.fillRect(c.x - 18, c.y - 26, 36, 5);
      ctx.fillStyle = c.hp < 35 ? "#ff2a2a" : "#ffd23a";
      ctx.fillRect(c.x - 18, c.y - 26, 36 * (c.hp / 100), 5);
    }
    if (c.hp < 35 && c.hp > 0) {
      // Smoke puffs.
      const n = 3;
      for (let i = 0; i < n; i++) {
        const a = S.time * 2 + i * 2.1;
        ctx.fillStyle = "rgba(120,120,120,0.5)";
        ctx.beginPath();
        ctx.arc(c.x + Math.cos(a) * 8, c.y - 10 - ((S.time * 20 + i * 14) % 30), 6 + i * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawPeds(ctx, S, camX, camY, w, h) {
  for (const ped of S.peds) {
    if (ped.dead) continue;
    if (!inView(ped.x, ped.y, camX, camY, w, h, 40)) continue;
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.down > 0) {
      // Lying down.
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = ped.shirt;
      ctx.beginPath(); ctx.roundRect(-11, -5, 22, 10, 4); ctx.fill();
      ctx.fillStyle = "#e8c39a";
      ctx.beginPath(); ctx.arc(13, 0, 5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = ped.panic > 0 ? "#ff2a2a" : ped.shirt;
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e8c39a";
      ctx.beginPath(); ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4, 5, 0, Math.PI * 2); ctx.fill();
      if (ped.foe) {
        ctx.strokeStyle = "#222"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ped.angle) * 18, Math.sin(ped.angle) * 18); ctx.stroke();
        ctx.fillStyle = "#ff2a2a";
        ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("!", 0, -14);
      }
      if (ped.panic > 0) {
        ctx.fillStyle = "#ff2a2a";
        ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("!", 0, -14);
      }
    }
    ctx.restore();
  }
}

function drawPlayer(ctx, S) {
  const p = S.player;
  if (p.inCar) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = "#274b8f";
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffd9a8";
  ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4, 6, 0, Math.PI * 2); ctx.fill();
  // Gun.
  ctx.strokeStyle = "#222"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(p.angle) * 18, Math.sin(p.angle) * 18); ctx.stroke();
  ctx.restore();
}

function drawEffects(ctx, S) {
  for (const e of S.effects) {
    if (e.kind === "tracer") {
      ctx.strokeStyle = "rgba(255,240,120,0.95)";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(e.x0, e.y0); ctx.lineTo(e.x1, e.y1); ctx.stroke();
      ctx.fillStyle = "#fff6b0";
      ctx.beginPath(); ctx.arc(e.x0, e.y0, 5, 0, Math.PI * 2); ctx.fill();
    } else if (e.kind === "hitmark") {
      ctx.strokeStyle = "#ff2a2a"; ctx.lineWidth = 3;
      const s = 8;
      ctx.beginPath();
      ctx.moveTo(e.x - s, e.y - s); ctx.lineTo(e.x + s, e.y + s);
      ctx.moveTo(e.x + s, e.y - s); ctx.lineTo(e.x - s, e.y + s);
      ctx.stroke();
    } else if (e.kind === "flash") {
      ctx.fillStyle = "rgba(255,220,80,0.9)";
      ctx.beginPath(); ctx.arc(e.x, e.y, 7, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Floating texts (Car taken, +$200, ...).
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  for (const f of S.floats) {
    ctx.fillStyle = f.color;
    ctx.globalAlpha = clamp(f.t, 0, 1);
    ctx.fillText(f.text, f.x, f.y - (1.6 - f.t) * 30);
  }
  ctx.globalAlpha = 1;
}

// ---- HUD ----
function drawHUD(ctx, S, view) {
  const { w, h } = view;
  const p = S.player;
  // Mission banner (top centre) with live distance.
  const t = missionTarget(S);
  const label = missionLabel(S);
  ctx.font = "bold 15px sans-serif";
  const tw = ctx.measureText(label).width + (t ? 90 : 20);
  ctx.fillStyle = "rgba(10,16,28,0.78)";
  ctx.beginPath(); ctx.roundRect(w / 2 - tw / 2, 10, tw, 30, 8); ctx.fill();
  ctx.fillStyle = "#ffd23a";
  ctx.textAlign = "left";
  ctx.fillText(label, w / 2 - tw / 2 + 12, 30);
  if (t) {
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    ctx.fillText(missionDistance(S) + "m", w / 2 + tw / 2 - 12, 30);
  }
  // Banner announcements.
  if (S.banner && S.bannerT > 0) {
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(10,16,28,0.8)";
    const bw = ctx.measureText(S.banner).width + 40;
    ctx.beginPath(); ctx.roundRect(w / 2 - bw / 2, h * 0.22, bw, 42, 10); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(S.banner, w / 2, h * 0.22 + 29);
  }
  // Wanted stars (top right, above minimap).
  const flash = S.wantedFlash > 0 && Math.floor(S.time * 6) % 2 === 0;
  ctx.font = "bold 26px sans-serif";
  ctx.textAlign = "right";
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < S.wanted ? (flash ? "#ff5a2a" : "#ffd23a") : "rgba(255,255,255,0.25)";
    ctx.fillText("★", w - 16 - (4 - i) * 30, 44);
  }
  if (S.wanted > 0) {
    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = flash ? "#ff5a2a" : "#ffd23a";
    ctx.fillText("WANTED", w - 16, 64);
  }
  // Money + health (top left).
  ctx.textAlign = "left";
  ctx.font = "bold 22px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(fmtMoney(S.money), 16, 36);
  ctx.fillStyle = "#222";
  ctx.fillRect(16, 46, 150, 12);
  ctx.fillStyle = p.hp > 30 ? "#3ddc5a" : "#ff2a2a";
  ctx.fillRect(16, 46, 150 * (p.hp / 100), 12);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.strokeRect(16, 46, 150, 12);
  // Ammo (bottom centre, clear of the minimap and the touch buttons).
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("AMMO " + S.ammo + " / " + S.reserve, w / 2, h - 16);
  // Car health bar when driving.
  if (p.inCar && p.car) {
    ctx.textAlign = "left";
    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("CAR", 16, h - 34);
    ctx.fillStyle = "#222";
    ctx.fillRect(60, h - 46, 150, 12);
    ctx.fillStyle = p.car.hp > 35 ? "#ffd23a" : "#ff2a2a";
    ctx.fillRect(60, h - 46, 150 * (p.car.hp / 100), 12);
    if (p.car.hp <= 0) {
      ctx.fillStyle = "#ff2a2a";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("CAR STALLED — press E to get out", 16, h - 58);
    }
  }
  // District label (bottom left).
  const d = districtAt(p.x, p.y);
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(d.name, 16, h - 16);
  // Context hint "E — steal car" above the nearest car (same radius as E works).
  if (!p.inCar) {
    let best = null, bd = 70;
    for (const c of S.cars) {
      if (c.dead || c.kind === "police") continue;
      const dd = dist(p.x, p.y, c.x, c.y);
      if (dd < bd) { bd = dd; best = c; }
    }
    if (best) {
      const sx = best.x - (S.cam.x - w / 2), sy = best.y - (S.cam.y - h / 2);
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(10,16,28,0.85)";
      const msg = best.kind === "traffic" ? "E — steal car" : "E — get in car";
      const mw = ctx.measureText(msg).width + 18;
      ctx.beginPath(); ctx.roundRect(sx - mw / 2, sy - 52, mw, 24, 6); ctx.fill();
      ctx.fillStyle = "#ffd23a";
      ctx.fillText(msg, sx, sy - 35);
    }
  }
  // Edge arrow: sticks to the screen frame, points at the mission target.
  if (t) {
    const tx = t.x - (S.cam.x - w / 2), ty = t.y - (S.cam.y - h / 2);
    const onScreen = tx > 60 && tx < w - 60 && ty > 60 && ty < h - 60;
    if (!onScreen) {
      // Pin the arrow to the screen frame along the direction to the target.
      const cx = w / 2, cy = h / 2;
      const a = Math.atan2(ty - cy, tx - cx);
      const dx = Math.cos(a), dy = Math.sin(a);
      const t = Math.min((w / 2 - 30) / Math.abs(dx || 0.001), (h / 2 - 30) / Math.abs(dy || 0.001));
      const ex = cx + dx * t, ey = cy + dy * t;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = "#ffd23a";
      ctx.beginPath();
      ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffd23a";
      ctx.fillText(missionDistance(S) + "m", ex, ey + 28);
    }
  }
  // Minimap (bottom centre-right, clear of touch buttons).
  drawMinimap(ctx, S, view);
  // Mute indicator.
  if (S.muted) {
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("MUTED (M)", w - 16, h - 44);
  }
}

function drawMinimap(ctx, S, view) {
  const { w, h } = view;
  const mw = 170, mh = 146, mx = w - mw - 16, my = h - mh - 16;
  // Keep the minimap out of the touch buttons' corner on small screens.
  const top = S.isTouch ? 84 : my;
  ctx.fillStyle = "rgba(10,16,28,0.8)";
  ctx.beginPath(); ctx.roundRect(mx, top, mw, mh, 8); ctx.fill();
  const sx = mw / WORLD.w, sy = mh / WORLD.h;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  for (const rx of ROADS_X) { ctx.beginPath(); ctx.moveTo(mx + rx * sx, top); ctx.lineTo(mx + rx * sx, top + mh); ctx.stroke(); }
  for (const ry of ROADS_Y) { ctx.beginPath(); ctx.moveTo(mx, top + ry * sy); ctx.lineTo(mx + mw, top + ry * sy); ctx.stroke(); }
  // Target: yellow. Player: white/blue.
  const t = missionTarget(S);
  if (t) {
    ctx.fillStyle = "#ffd23a";
    ctx.beginPath(); ctx.arc(mx + t.x * sx, top + t.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  for (const c of S.cops) {
    ctx.fillStyle = "#ff2a2a";
    ctx.fillRect(mx + c.x * sx - 2, top + c.y * sy - 2, 4, 4);
  }
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(mx + S.player.x * sx, top + S.player.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#2a6bff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mx + S.player.x * sx, top + S.player.y * sy, 5, 0, Math.PI * 2); ctx.stroke();
  // Viewport box.
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + (S.cam.x - view.w / 2) * sx, top + (S.cam.y - view.h / 2) * sy, view.w * sx, view.h * sy);
}

export { CLINIC };
