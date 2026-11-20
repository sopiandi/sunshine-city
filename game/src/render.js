// Sunshine City — all canvas drawing: the city, its people and cars,
// the HUD, minimap and the edge arrow to the mission target.
// Written fresh in this session for the v3 rebuild.
import { WORLD_W, WORLD_H, VX, HY, ROAD_HALF, CAR_W, CAR_L, WANTED_DECAY_SECONDS } from "./config.js";
import { CITY, PARKING_LOT, DISTRICTS } from "./city.js";
import { missionTarget, missionHint, MISSIONS } from "./missions.js";
import { stealableCar } from "./world.js";
import { dist } from "./config.js";

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, car, t) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  rr(ctx, -CAR_W / 2 + 2, -CAR_L / 2 + 3, CAR_W, CAR_L, 7);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = "#151515";
  ctx.fillRect(-16, -CAR_L / 2 - 2, 12, 5);
  ctx.fillRect(6, -CAR_L / 2 - 2, 12, 5);
  ctx.fillRect(-16, CAR_L / 2 - 3, 12, 5);
  ctx.fillRect(6, CAR_L / 2 - 3, 12, 5);
  // Body.
  ctx.fillStyle = car.color;
  rr(ctx, -CAR_W / 2, -CAR_L / 2, CAR_W, CAR_L, 7);
  ctx.fill();
  // Cop livery.
  if (car.kind === "cop") {
    ctx.fillStyle = "#f2f2ee";
    ctx.fillRect(-8, -CAR_L / 2, 16, CAR_L);
    ctx.fillStyle = "#1c5fd6";
    ctx.fillRect(-CAR_W / 2 + 2, -CAR_L / 2, 5, CAR_L);
    // Flashing light bar.
    const on = Math.floor(t * 3) % 2 === 0;
    ctx.fillStyle = on ? "#ff2d2d" : "#2d7dff";
    ctx.fillRect(-6, -CAR_L / 2 - 1, 5, 4);
    ctx.fillStyle = on ? "#2d7dff" : "#ff2d2d";
    ctx.fillRect(1, -CAR_L / 2 - 1, 5, 4);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 7px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("POLICE", 0, 3);
  }
  // Windshield + roof.
  ctx.fillStyle = "rgba(20,30,44,0.85)";
  ctx.fillRect(8, -CAR_L / 2 + 4, 7, CAR_L - 8);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(-8, -CAR_L / 2 + 4, 12, CAR_L - 8);
  // Headlights.
  ctx.fillStyle = "#ffe9a8";
  ctx.fillRect(CAR_W / 2 - 2, -CAR_L / 2 + 3, 2, 4);
  ctx.fillRect(CAR_W / 2 - 2, CAR_L / 2 - 7, 2, 4);
  ctx.restore();
  // Smoke when wrecked or badly hurt.
  if (car.hp < 40 && car.hp > 0) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#888";
    const wob = Math.sin(t * 6 + car.x) * 4;
    ctx.beginPath();
    ctx.arc(car.x + Math.cos(car.angle) * 20 + wob, car.y + Math.sin(car.angle) * 20 - 8, 7 + Math.sin(t * 9) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (car.hp <= 0) {
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = "#555";
    ctx.beginPath();
    ctx.arc(car.x, car.y - 6, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPed(ctx, p, t) {
  if (p.dead) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f2c9a0";
    ctx.beginPath(); ctx.arc(12, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const bob = p.down > 0 ? 0 : Math.sin(t * 8 + p.x) * 1.5;
  ctx.save();
  ctx.translate(p.x, p.y + bob);
  if (p.down > 0) {
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.globalAlpha = 0.9;
  }
  // Body.
  ctx.fillStyle = p.panic > 0 ? "#ffcf3f" : p.color;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.foe ? "#3a0d0d" : "#23272e";
  ctx.beginPath(); ctx.arc(0, -2, 5.5, 0, Math.PI * 2); ctx.fill();
  // Facing tick.
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(p.angle) * 12, Math.sin(p.angle) * 12);
  ctx.stroke();
  ctx.restore();
}

export function drawWorld(ctx, S, view) {
  const { x0, y0, x1, y1 } = view;
  // Ground, tinted per district.
  ctx.fillStyle = "#8aa07a";
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // District ground washes.
  for (const key of Object.keys(DISTRICTS)) {
    ctx.fillStyle = DISTRICTS[key].ground;
    ctx.globalAlpha = 0.55;
    if (key === "marina") ctx.fillRect(Math.max(x0, 0), Math.max(y0, 1550), Math.min(x1, 1150) - Math.max(x0, 0), y1 - Math.max(y0, 1550));
    if (key === "docks") ctx.fillRect(Math.max(x0, 1850), Math.max(y0, 1450), x1 - Math.max(x0, 1850), y1 - Math.max(y0, 1450));
    if (key === "downtown") ctx.fillRect(Math.max(x0, 1050), Math.max(y0, 650), Math.min(x1, 1950) - Math.max(x0, 1050), Math.min(y1, 1550) - Math.max(y0, 650));
    if (key === "north") ctx.fillRect(x0, Math.max(y0, 0), x1 - x0, Math.min(y1, 650) - Math.max(y0, 0));
  }
  ctx.globalAlpha = 1;
  // The bay: water along the west edge, sand beside it.
  ctx.fillStyle = "#2f8fc4";
  ctx.fillRect(Math.max(x0, 0), y0, Math.max(0, Math.min(x1, 140) - Math.max(x0, 0)), y1 - y0);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2;
  for (let wy = Math.floor(y0 / 90) * 90; wy < y1; wy += 90) {
    ctx.beginPath();
    ctx.moveTo(30, wy + Math.sin(S.time * 1.5 + wy) * 6);
    ctx.quadraticCurveTo(70, wy + 10, 120, wy);
    ctx.stroke();
  }
  ctx.fillStyle = "#e8d9a8";
  ctx.fillRect(Math.max(x0, 140), y0, Math.max(0, Math.min(x1, 185) - Math.max(x0, 140)), y1 - y0);
  // Roads.
  ctx.fillStyle = "#3c4148";
  for (const vx of VX) ctx.fillRect(vx - ROAD_HALF, Math.max(y0, 0), ROAD_HALF * 2, Math.min(y1, WORLD_H) - Math.max(y0, 0));
  for (const hy of HY) ctx.fillRect(Math.max(x0, 0), hy - ROAD_HALF, Math.min(x1, WORLD_W) - Math.max(x0, 0), ROAD_HALF * 2);
  // Sidewalks.
  ctx.fillStyle = "#b9bec4";
  for (const vx of VX) {
    ctx.fillRect(vx - ROAD_HALF - 12, Math.max(y0, 0), 10, Math.min(y1, WORLD_H) - Math.max(y0, 0));
    ctx.fillRect(vx + ROAD_HALF + 2, Math.max(y0, 0), 10, Math.min(y1, WORLD_H) - Math.max(y0, 0));
  }
  for (const hy of HY) {
    ctx.fillRect(Math.max(x0, 0), hy - ROAD_HALF - 12, Math.min(x1, WORLD_W) - Math.max(x0, 0), 10);
    ctx.fillRect(Math.max(x0, 0), hy + ROAD_HALF + 2, Math.min(x1, WORLD_W) - Math.max(x0, 0), 10);
  }
  // Centre dashes.
  ctx.fillStyle = "#f2d54b";
  for (const vx of VX) {
    for (let y = Math.floor(y0 / 46) * 46; y < y1; y += 46) ctx.fillRect(vx - 2, y, 4, 22);
  }
  for (const hy of HY) {
    for (let x = Math.floor(x0 / 46) * 46; x < x1; x += 46) ctx.fillRect(x, hy - 2, 22, 4);
  }
  // Parking lot west of the clinic.
  ctx.fillStyle = "#565d66";
  ctx.fillRect(PARKING_LOT.x, PARKING_LOT.y, PARKING_LOT.w, PARKING_LOT.h);
  ctx.strokeStyle = "#e8e8e8";
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const px = PARKING_LOT.x + 18 + i * 36;
    ctx.beginPath(); ctx.moveTo(px, PARKING_LOT.y + 14); ctx.lineTo(px, PARKING_LOT.y + 52); ctx.stroke();
  }
  ctx.fillStyle = "#fff";
  ctx.font = "bold 15px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("P", PARKING_LOT.x + PARKING_LOT.w / 2, PARKING_LOT.y + PARKING_LOT.h - 16);
  // Buildings.
  for (const b of CITY.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    if (b.tall) {
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(b.x, b.y, b.w, 10);
    }
    // Windows.
    ctx.fillStyle = "rgba(20,30,44,0.55)";
    const cols = Math.max(1, Math.floor(b.w / 26)), rows = Math.max(1, Math.floor(b.h / 24));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      ctx.fillRect(b.x + 8 + i * 26, b.y + 8 + j * 24, 12, 10);
    }
    if (b.clinic) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(b.x + b.w / 2 - 22, b.y + 14, 44, 12);
      ctx.fillRect(b.x + b.w / 2 - 6, b.y + 2, 12, 36);
      ctx.fillStyle = "#c0392b";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("CLINIC", b.x + b.w / 2, b.y + b.h - 14);
    }
  }
  // District signboards.
  const signs = [
    { x: 480, y: 1680, text: "MARINA BAY", color: DISTRICTS.marina.sign },
    { x: 2080, y: 1560, text: "OLD DOCKS", color: DISTRICTS.docks.sign },
    { x: 1700, y: 1350, text: "DOWNTOWN", color: DISTRICTS.downtown.sign },
  ];
  for (const s of signs) {
    if (s.x < x0 - 120 || s.x > x1 + 120 || s.y < y0 - 40 || s.y > y1 + 40) continue;
    ctx.fillStyle = s.color;
    rr(ctx, s.x - 95, s.y - 20, 190, 40, 6); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(s.text, s.x, s.y + 7);
  }
  // Dock containers.
  ctx.fillStyle = "#b3541e";
  for (let i = 0; i < 5; i++) ctx.fillRect(2250 + i * 8, 2050 + (i % 2) * 40, 90, 30);
  ctx.fillStyle = "#2f6db3";
  for (let i = 0; i < 4; i++) ctx.fillRect(2260 + i * 10, 2160 + (i % 2) * 36, 80, 28);
  // Trees.
  for (const tr of CITY.trees) {
    if (tr.x < x0 - 20 || tr.x > x1 + 20 || tr.y < y0 - 20 || tr.y > y1 + 20) continue;
    if (tr.palm) {
      ctx.strokeStyle = "#6b4a2f";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.x + 3, tr.y - 16); ctx.stroke();
      ctx.fillStyle = "#2fae5f";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath(); ctx.ellipse(tr.x + 3 + Math.cos(a) * 9, tr.y - 16 + Math.sin(a) * 5, 10, 3.5, a, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = "#2e7d46";
      ctx.beginPath(); ctx.arc(tr.x, tr.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#37945a";
      ctx.beginPath(); ctx.arc(tr.x - 3, tr.y - 3, 7, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Mission target marker (pulsing ring + flag).
  const tgt = missionTarget(S);
  if (tgt) {
    const pulse = 1 + Math.sin(S.time * 4) * 0.15;
    ctx.save();
    ctx.strokeStyle = "#ffd60a";
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(tgt.x, tgt.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#ffd60a";
    ctx.beginPath(); ctx.arc(tgt.x, tgt.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("★", tgt.x, tgt.y + 4);
    ctx.restore();
  }
  // Roadblocks.
  for (const r of S.roadblocks) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.angle);
    ctx.fillStyle = "#23272e";
    rr(ctx, -26, -13, 52, 26, 6); ctx.fill();
    ctx.fillStyle = "#f2f2ee";
    ctx.fillRect(-8, -13, 16, 26);
    ctx.fillStyle = "#ff7b00";
    ctx.beginPath(); ctx.moveTo(-34, -20); ctx.lineTo(-26, -8); ctx.lineTo(-34, 4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(34, -4); ctx.lineTo(26, 8); ctx.lineTo(34, 20); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Cars, peds, player.
  for (const c of S.cars) {
    if (c.x < x0 - 60 || c.x > x1 + 60 || c.y < y0 - 60 || c.y > y1 + 60) continue;
    drawCarShape(ctx, c, S.time);
  }
  for (const p of S.peds) {
    if (p.x < x0 - 30 || p.x > x1 + 30 || p.y < y0 - 30 || p.y > y1 + 30) continue;
    drawPed(ctx, p, S.time);
  }
  // Player (Kai Reyes, teal jacket).
  const pl = S.player;
  if (!S.inCar) {
    ctx.save();
    ctx.translate(pl.x, pl.y);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(2, 3, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0e7c86";
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f2c9a0";
    ctx.beginPath(); ctx.arc(0, -2, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#23272e";
    ctx.beginPath(); ctx.arc(0, -4, 6.5, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(pl.angle) * 18, Math.sin(pl.angle) * 18);
    ctx.stroke();
    ctx.restore();
  }
  // Effects: tracers, muzzle flashes, hit markers, smoke.
  for (const e of S.effects) {
    const a = 1 - e.t / e.life;
    if (e.kind === "tracer") {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = "#ffe95e";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
      ctx.restore();
    } else if (e.kind === "muzzle") {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = "#ffd60a";
      ctx.beginPath(); ctx.arc(e.x, e.y, 9 * a + 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (e.kind === "hitmark") {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(e.x - 8, e.y - 8); ctx.lineTo(e.x + 8, e.y + 8);
      ctx.moveTo(e.x + 8, e.y - 8); ctx.lineTo(e.x - 8, e.y + 8);
      ctx.stroke();
      ctx.restore();
    } else if (e.kind === "smoke") {
      ctx.save();
      ctx.globalAlpha = a * 0.55;
      ctx.fillStyle = "#777";
      ctx.beginPath(); ctx.arc(e.x, e.y - e.t * 22, 10 + e.t * 14, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}

// ---------- v4 HUD layout ----------
// One layout function decides every HUD rect, canvas and DOM alike, so
// nothing can clip or overlap at any width. The boxes are recorded on
// S.hudBoxes each frame for the test harness to check.
function hudLayout(W, H, inCar) {
  const pad = 12;
  const narrow = W < 760;
  const mw = narrow ? 104 : 168;
  const mh = Math.round(mw * 0.78);
  // Top-left cluster: money, HP bar, stars, ammo, car bar.
  const clusterH = inCar ? 142 : 118;
  // On narrow screens the pause button sits under the minimap (top 100,
  // 44px tall) — reserve that row so the banner never sits on it.
  const topH = Math.max(clusterH, 12 + mh + (narrow ? 60 : 0));
  let banner = null;
  if (!narrow) {
    const bw = Math.min(460, W - 2 * (mw + 36));
    if (bw >= 280) banner = { x: Math.round((W - bw) / 2), y: 10, w: Math.round(bw), h: 64 };
  }
  // Narrow: the banner drops below the whole top row — never on the
  // minimap, never on the money cluster, never on the pause button.
  if (!banner) banner = { x: pad, y: topH + 8, w: W - pad * 2, h: 64 };
  // The notice line lives above the hint on tall screens; on short
  // (landscape-phone) screens it moves above the hint further up so it
  // never collides with the toast under the banner.
  const noticeY = H >= 500 ? H - 122 : H - 152;
  return {
    pad, narrow, mw, mh, clusterH,
    money: { x: pad, y: 12, w: 150, h: 22 },
    hpBar: { x: pad, y: 44, w: 150, h: 14 },
    stars: { x: pad, y: 66, w: 150, h: 26 },
    ammo: { x: pad, y: 96, w: 150, h: 18 },
    carBar: inCar ? { x: pad, y: 120, w: 150, h: 12 } : null,
    minimap: { x: W - mw - pad, y: 12, w: mw, h: mh },
    banner,
    toast: { x: pad, y: banner.y + banner.h + 12, w: W - pad * 2, h: 64 },
    hint: { x: Math.round(W / 2 - 110), y: H - 84, w: 220, h: 30 },
    notice: { x: Math.round(W / 2 - 140), y: noticeY, w: 280, h: 22 },
    district: { x: pad, y: H - 110, w: 220, h: 24 },
  };
}

// DOM overlay text, kept in sync with the layout above. These elements
// sit above the canvas in the page stacking order, so a building drawn
// on the canvas can never cover a banner, a toast or a hint.
const domCache = {};
function setDom(id, text, show, rect) {
  const el = document.getElementById(id);
  if (!el) return;
  const key = id + "|" + text + "|" + show;
  if (domCache[id] !== key) {
    domCache[id] = key;
    el.textContent = text;
    el.style.display = show ? "block" : "none";
  }
  if (rect && show) {
    el.style.left = rect.x + "px";
    el.style.top = rect.y + "px";
    el.style.width = rect.w + "px";
    if (rect.h) el.style.height = rect.h + "px";
  }
}
function syncDomHud(S, L, W, H) {
  // Mission banner: name, live stage + distance, and the stage hint.
  const tgt = missionTarget(S);
  const mi = S.missionIndex;
  const name = mi < MISSIONS.length ? MISSIONS[mi].name : "Sunshine City";
  const stage = mi < MISSIONS.length
    ? MISSIONS[mi].stages[Math.min(S.stage, MISSIONS[mi].stages.length - 1)].text
    : "Free roam — Sunshine City is yours";
  const d = tgt ? Math.round(dist(S.player.x, S.player.y, tgt.x, tgt.y) / 8) : null;
  const line = stage + (d !== null ? " · " + d + " m" : "");
  const bannerEl = document.getElementById("mission-banner");
  if (bannerEl) {
    // While the heat is cooling off, the banner shows the countdown
    // instead of the stage hint — the decay is visible, not silent.
    const hintLine = S.decayActive
      ? "Losing them… " + Math.ceil(WANTED_DECAY_SECONDS - S.decayT) + "s — stay out of sight"
      : missionHint(S);
    const key = name + "|" + line + "|" + hintLine;
    if (domCache.banner !== key) {
      domCache.banner = key;
      document.getElementById("banner-name").textContent = name;
      document.getElementById("banner-stage").textContent = line;
      document.getElementById("banner-hint").textContent = hintLine;
    }
    bannerEl.style.display = S.mode === "play" || S.mode === "pause" ? "block" : "none";
    bannerEl.style.left = L.banner.x + "px";
    bannerEl.style.top = L.banner.y + "px";
    bannerEl.style.width = L.banner.w + "px";
  }
  // Toast: the WANTED / mission-complete banner text.
  if (S.msg) {
    setDom("hud-toast", S.msg.text + "\n" + S.msg.sub, true, L.toast);
    const el = document.getElementById("hud-toast");
    if (el) el.style.opacity = String(Math.min(1, 3.2 - S.msg.t));
  } else {
    setDom("hud-toast", "", false, null);
  }
  // Context hint: exactly the car E would take (or the exit prompt).
  const steal = !S.inCar ? stealableCar(S) : null;
  if (steal) {
    const dm = Math.round(dist(S.player.x, S.player.y, steal.x, steal.y) / 8);
    setDom("hud-hint", "E — steal car · " + dm + " m", true, L.hint);
    S.hintVisible = true;
  } else if (S.inCar) {
    setDom("hud-hint", "E — exit car", true, L.hint);
    S.hintVisible = true;
  } else {
    setDom("hud-hint", "", false, null);
    S.hintVisible = false;
  }
  // One notice line: reloading, a stalled car, or the arrest countdown.
  let notice = "";
  if (S.arrestT > 0 && S.arrestCop) {
    notice = "BUSTED in " + Math.max(0, 2.0 - S.arrestT).toFixed(1) + "s — RUN!";
  } else if (S.reloadT > 0) {
    notice = "Reloading…";
  } else if (S.inCar && S.car && S.car.hp <= 0) {
    notice = "CAR STALLED — press E to get out";
  }
  setDom("hud-notice", notice, notice !== "", L.notice);
  // District label, wide screens only (on a phone it sits on the joystick).
  const showDistrict = S.districtT < 2.5 && W >= 480;
  setDom("hud-district", showDistrict ? DISTRICTS[S.district].name : "", showDistrict, L.district);
}

export function drawHUD(ctx, S, W, H, input) {
  const L = hudLayout(W, H, S.inCar && S.car);
  const pad = L.pad;
  // Money + health, top-left.
  ctx.save();
  ctx.textAlign = "left";
  ctx.font = "bold 22px sans-serif";
  ctx.fillStyle = "#37d67a";
  ctx.fillText("$" + S.money, pad, 34);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  rr(ctx, pad, 44, 150, 14, 7); ctx.fill();
  ctx.fillStyle = S.player.hp > 30 ? "#37d67a" : "#ff4d4d";
  rr(ctx, pad, 44, 150 * (S.player.hp / 100), 14, 7); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText("HP " + Math.round(S.player.hp), pad + 4, 55);
  // Wanted stars, top-left under health. While the decay clock runs the
  // last live star fades out — the countdown itself lives on the banner.
  const flash = S.starsFlash > 0 && Math.floor(S.time * 6) % 2 === 0;
  ctx.font = "bold 24px sans-serif";
  for (let i = 0; i < 5; i++) {
    if (i === S.wanted - 1 && S.decayActive) {
      ctx.globalAlpha = Math.max(0.15, 1 - S.decayT / WANTED_DECAY_SECONDS);
    }
    ctx.fillStyle = i < S.wanted ? (flash ? "#fff" : "#ffd60a") : "rgba(255,255,255,0.28)";
    ctx.fillText("★", pad + i * 28, 90);
    ctx.globalAlpha = 1;
  }
  // "WANTED" label only where it fits clear of the minimap (wide screens).
  if (S.wanted > 0 && !L.narrow) {
    ctx.fillStyle = flash ? "#ff4d4d" : "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("WANTED", pad + 148, 88);
  }
  // Ammo + car health, top-left under the stars — never under the
  // joystick or the touch buttons at the bottom of a phone screen.
  ctx.font = "bold 18px sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText("AMMO " + S.ammo + " / " + S.reserve, pad, 112);
  if (S.inCar && S.car) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    rr(ctx, pad, 120, 150, 12, 6); ctx.fill();
    ctx.fillStyle = S.car.hp > 30 ? "#4da3ff" : "#ff4d4d";
    rr(ctx, pad, 120, 150 * (S.car.hp / 100), 12, 6); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("CAR " + Math.round(S.car.hp), pad + 4, 131);
  }
  // Mission banner, toast, hint and notices live in the DOM overlay
  // (syncDomHud above) — page text sits above the canvas, so a building
  // can never cover it, and CSS keeps it inside the viewport.
  syncDomHud(S, L, W, H);
  // Record every visible HUD box for the test harness: canvas pieces
  // from the layout, DOM pieces and touch controls measured live.
  const boxes = [
    { name: "money", ...L.money },
    { name: "hp", ...L.hpBar },
    { name: "stars", ...L.stars },
    { name: "ammo", ...L.ammo },
    { name: "minimap", ...L.minimap },
    { name: "banner", ...L.banner },
  ];
  if (L.carBar) boxes.push({ name: "car", ...L.carBar });
  if (S.msg) boxes.push({ name: "toast", ...L.toast });
  if (S.hintVisible) boxes.push({ name: "hint", ...L.hint });
  if (S.districtT < 2.5 && W >= 480) boxes.push({ name: "district", ...L.district });
  if (input && input.touch) {
    for (const id of ["joy-zone", "btn-shoot", "btn-car", "btn-reload", "btn-pause"]) {
      const el = document.getElementById(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0) {
        boxes.push({ name: id, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
      }
    }
  }
  S.hudBoxes = boxes;
  drawMinimap(ctx, S, W, H, L);
  drawEdgeArrow(ctx, S, W, H);
  ctx.restore();
}

function drawMinimap(ctx, S, W, H, L) {
  const mw = L.mw;
  const mh = L.mh;
  const mx = L.minimap.x, my = L.minimap.y;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  rr(ctx, mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.fill();
  // Water + districts.
  ctx.fillStyle = "#2f8fc4";
  ctx.fillRect(mx, my, 140 * sx + 2, mh);
  ctx.fillStyle = "#8fb8a4";
  ctx.fillRect(mx, my + 1550 * sy, 1150 * sx, mh - 1550 * sy);
  ctx.fillStyle = "#9a8d7a";
  ctx.fillRect(mx + 1850 * sx, my + 1450 * sy, mw - 1850 * sx, mh - 1450 * sy);
  // Roads.
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  for (const vx of VX) { ctx.beginPath(); ctx.moveTo(mx + vx * sx, my); ctx.lineTo(mx + vx * sx, my + mh); ctx.stroke(); }
  for (const hy of HY) { ctx.beginPath(); ctx.moveTo(mx, my + hy * sy); ctx.lineTo(mx + mw, my + hy * sy); ctx.stroke(); }
  // Target: yellow, player: white/blue — never the same colour.
  const tgt = missionTarget(S);
  if (tgt) {
    ctx.fillStyle = "#ffd60a";
    ctx.beginPath(); ctx.arc(mx + tgt.x * sx, my + tgt.y * sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  for (const c of S.cops) {
    ctx.fillStyle = "#ff3b30";
    ctx.beginPath(); ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#2f7fe3";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mx + S.player.x * sx, my + S.player.y * sy, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawEdgeArrow(ctx, S, W, H) {
  const tgt = missionTarget(S);
  if (!tgt) return;
  const cam = S.camera;
  const sx = W / 2 + (tgt.x - cam.x);
  const sy = H / 2 + (tgt.y - cam.y);
  // On screen already: only a small marker above the target.
  if (sx > 40 && sx < W - 40 && sy > 40 && sy < H - 40) return;
  const cx = W / 2, cy = H / 2;
  const ang = Math.atan2(sy - cy, sx - cx);
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const m = 34;
  // Distance from the centre to the frame edge along the arrow direction.
  const tx = ux > 0.01 ? (W / 2 - m) / ux : ux < -0.01 ? (-(W / 2) + m) / ux : Infinity;
  const ty = uy > 0.01 ? (H / 2 - m) / uy : uy < -0.01 ? (-(H / 2) + m) / uy : Infinity;
  const t = Math.min(tx, ty);
  const px = cx + ux * t;
  const py = cy + uy * t;
  const d = Math.round(dist(S.player.x, S.player.y, tgt.x, tgt.y) / 8);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.fillStyle = "#ffd60a";
  ctx.beginPath();
  ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-4, 0); ctx.lineTo(-10, 11);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  // Distance label: pulled toward the centre of the screen from the
  // arrow and clamped inside the frame, so it never clips off an edge
  // or sits on the ammo / touch controls at the bottom.
  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  const lx = Math.max(48, Math.min(W - 48, px - ux * 30));
  const ly = Math.max(64, Math.min(H - 24, py - uy * 30));
  ctx.fillText(d + " m", lx, ly);
}
