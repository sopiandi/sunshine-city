// Drawing only: the world's state and the current screen in, pixels out.
// A 1280x720 camera follows the player across the 3600x2600 city; the HUD
// (cash, health, wanted stars, minimap, mission banner) is drawn in screen
// space on top. Flat shapes and canvas text, no images, no network.
import { FONT, PALETTE, VIEW, WORLD } from './config.js';
import { BEACH_X, ROADS_H, ROADS_V, ROAD_W } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }
  function plainText(value, x, y, size, color, align, baseline) {
    if (!fonts.has(`p${size}`)) fonts.set(`p${size}`, `${size}px ${FONT}`);
    context.font = fonts.get(`p${size}`);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    view.x = (canvas.width - VIEW.width * view.scale) / 2;
    view.y = (canvas.height - VIEW.height * view.scale) / 2;
  }

  function drawCity(state, camX, camY, now) {
    const city = state.city;
    // Ground: sea, sand, grass.
    context.fillStyle = PALETTE.seaDeep;
    context.fillRect(0, 0, 260, WORLD.height);
    context.fillStyle = PALETTE.sea;
    context.fillRect(0, 0, 260, WORLD.height);
    context.strokeStyle = 'rgba(255,255,255,0.35)';
    context.lineWidth = 3;
    for (let y = 0; y < WORLD.height; y += 90) {
      const wob = Math.sin(now / 900 + y / 70) * 14;
      context.beginPath();
      context.moveTo(150 + wob, y);
      context.lineTo(240 + wob, y + 22);
      context.stroke();
    }
    context.fillStyle = PALETTE.sand;
    context.fillRect(260, 0, BEACH_X - 260, WORLD.height);
    context.fillStyle = '#8fbf6a';
    context.fillRect(BEACH_X, 0, WORLD.width - BEACH_X, WORLD.height);
    // Parks and parking lots.
    for (const p of city.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(p.x, p.y, p.w, p.h);
    }
    for (const lot of city.lots) {
      context.fillStyle = '#6b7280';
      context.fillRect(lot.x, lot.y, lot.w, lot.h);
      context.strokeStyle = 'rgba(255,255,255,0.5)';
      context.lineWidth = 2;
      for (let x = lot.x + 20; x < lot.x + lot.w - 20; x += 60) {
        context.beginPath(); context.moveTo(x, lot.y + 12); context.lineTo(x, lot.y + lot.h - 12); context.stroke();
      }
    }
    // Roads.
    context.fillStyle = PALETTE.road;
    for (const rx of ROADS_V) context.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    for (const ry of ROADS_H) context.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
    // Lane dashes.
    context.fillStyle = PALETTE.lane;
    for (const rx of ROADS_V) {
      for (let y = 0; y < WORLD.height; y += 64) context.fillRect(rx - 3, y, 6, 30);
    }
    for (const ry of ROADS_H) {
      for (let x = 0; x < WORLD.width; x += 64) context.fillRect(x, ry - 3, 30, 6);
    }
    // Crosswalks at every intersection.
    context.fillStyle = 'rgba(255,255,255,0.75)';
    for (const rx of ROADS_V) {
      for (const ry of ROADS_H) {
        for (let i = -3; i <= 3; i += 1) {
          context.fillRect(rx + i * 13 - 4, ry - ROAD_W / 2 + 8, 8, 16);
          context.fillRect(rx + i * 13 - 4, ry + ROAD_W / 2 - 24, 8, 16);
        }
      }
    }
    // Buildings with roofs and windows. v2 (A7): roofs and window rows
    // differ per district — marina roofs are blue/teal, docks are rust.
    for (const b of city.buildings) {
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.district === 'marina' ? 'rgba(255,255,255,0.45)' : b.district === 'docks' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.28)';
      context.fillRect(b.x + 8, b.y + 8, b.w - 16, 10);
      context.fillStyle = 'rgba(0,0,0,0.35)';
      const cols = Math.max(2, Math.floor(b.w / 34));
      const rows = Math.max(2, Math.floor(b.h / 34));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if ((c + r + Math.floor(b.x / 40)) % 3 === 0) continue;
          context.fillRect(b.x + 14 + c * 34, b.y + 28 + r * 34, 16, 18);
        }
      }
    }
    // v2 (A7): marina piers + boats, dock containers, district names.
    for (const pier of city.piers || []) {
      context.fillStyle = '#8b5a2b';
      context.fillRect(pier.x, pier.y, pier.w, pier.h);
      context.fillStyle = '#a4713b';
      for (let x = pier.x + 8; x < pier.x + pier.w; x += 22) context.fillRect(x, pier.y, 3, pier.h);
    }
    for (const boat of city.boats || []) {
      context.save();
      context.translate(boat.x, boat.y);
      context.rotate(boat.angle);
      context.fillStyle = '#f1faee';
      context.beginPath();
      context.roundRect(-34, -12, 68, 24, 10);
      context.fill();
      context.fillStyle = '#2a9d8f';
      context.fillRect(-10, -8, 22, 16);
      context.restore();
    }
    for (const box of city.containers || []) {
      context.fillStyle = box.color;
      context.fillRect(box.x, box.y, box.w, box.h);
      context.strokeStyle = 'rgba(0,0,0,0.4)';
      context.lineWidth = 2;
      context.strokeRect(box.x, box.y, box.w, box.h);
    }
    context.fillStyle = 'rgba(255,255,255,0.5)';
    context.font = `bold 22px ${FONT}`;
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillText('MARINA BAY', 3080, 420);
    context.fillText('OLD DOCKS', 3060, 2080);
    // Palm trees.
    for (const palm of city.palms) {
      context.strokeStyle = '#8b5a2b';
      context.lineWidth = 4;
      context.beginPath(); context.moveTo(palm.x, palm.y + 8); context.lineTo(palm.x, palm.y - 6); context.stroke();
      context.fillStyle = '#2f9e44';
      context.beginPath(); context.arc(palm.x, palm.y - 10, 13, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#40c057';
      context.beginPath(); context.arc(palm.x - 5, palm.y - 13, 7, 0, Math.PI * 2); context.fill();
    }
  }

  function drawCar(car, now, isPlayer) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    if (car.dead) {
      context.fillStyle = '#555';
      context.fillRect(-42, -20, 84, 40);
      context.fillStyle = 'rgba(80,80,80,0.6)';
      context.beginPath(); context.arc(-10, -26, 18 + Math.sin(now / 200) * 4, 0, Math.PI * 2); context.fill();
      context.restore();
      return;
    }
    if (isPlayer) {
      context.strokeStyle = '#fff';
      context.lineWidth = 4;
      context.strokeRect(-48, -26, 96, 52);
    }
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.fillRect(-40, -20, 84, 44);
    context.fillStyle = car.color;
    context.beginPath();
    context.roundRect(-42, -22, 84, 44, 10);
    context.fill();
    context.fillStyle = '#20242c';
    context.fillRect(-8, -18, 26, 36);
    context.fillStyle = 'rgba(255,255,255,0.75)';
    context.fillRect(28, -16, 8, 32);
    context.fillStyle = '#ffe66d';
    context.fillRect(40, -18, 3, 8);
    context.fillRect(40, 10, 3, 8);
    if (car.kind === 'police' || car.kind === 'roadblock') {
      context.fillStyle = '#fff';
      context.fillRect(-34, -20, 20, 40);
      context.fillStyle = '#111';
      plainText('PD', -30, 5, 13, '#111', 'left', 'middle');
      const flash = Math.floor(now / 280) % 2 === 0;
      context.fillStyle = flash ? '#ff2d2d' : '#2d6bff';
      context.beginPath(); context.arc(-2, -20, 7, 0, Math.PI * 2); context.fill();
      context.fillStyle = flash ? '#2d6bff' : '#ff2d2d';
      context.beginPath(); context.arc(-2, 20, 7, 0, Math.PI * 2); context.fill();
    }
    // v2 (B2): a damaged car smokes — thicker as health drops.
    if (car.health < 55) {
      const puffs = car.health < 25 ? 3 : 2;
      for (let i = 0; i < puffs; i += 1) {
        const rise = ((now / 300 + i * 0.7) % 1) * 34;
        context.fillStyle = `rgba(120,120,120,${0.55 - rise / 90})`;
        context.beginPath();
        context.arc(-28 + i * 14, -24 - rise, 8 + rise / 4, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.restore();
  }

  function drawMinimap(state, target) {
    const mw = 230;
    const mh = 164;
    const mx = VIEW.width - mw - 16;
    const my = 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    context.fillStyle = 'rgba(10,16,26,0.85)';
    context.fillRect(mx - 6, my - 6, mw + 12, mh + 12);
    context.fillStyle = '#2b6cb0';
    context.fillRect(mx, my, 260 * sx, mh);
    context.fillStyle = '#e8d29a';
    context.fillRect(mx + 260 * sx, my, (BEACH_X - 260) * sx, mh);
    context.fillStyle = '#3f7d4a';
    context.fillRect(mx + BEACH_X * sx, my, (WORLD.width - BEACH_X) * sx, mh);
    context.strokeStyle = '#3a3f47';
    context.lineWidth = 3;
    for (const rx of ROADS_V) {
      context.beginPath(); context.moveTo(mx + rx * sx, my); context.lineTo(mx + rx * sx, my + mh); context.stroke();
    }
    for (const ry of ROADS_H) {
      context.beginPath(); context.moveTo(mx, my + ry * sy); context.lineTo(mx + mw, my + ry * sy); context.stroke();
    }
    if (target) {
      const pulse = 5 + Math.sin(Date.now() / 300) * 2;
      context.fillStyle = '#ffb703';
      context.beginPath(); context.arc(mx + target.x * sx, my + target.y * sy, pulse, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#fff';
      context.lineWidth = 2;
      context.beginPath(); context.arc(mx + target.x * sx, my + target.y * sy, pulse + 3, 0, Math.PI * 2); context.stroke();
    }
    for (const car of state.cars) {
      if (car.dead) continue;
      context.fillStyle = car.kind === 'police' ? '#ff2d2d' : '#fff';
      context.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
    }
    for (const e of state.enemies) {
      if (e.health <= 0) continue;
      context.fillStyle = '#ff2d2d';
      context.beginPath(); context.arc(mx + e.x * sx, my + e.y * sy, 3, 0, Math.PI * 2); context.fill();
    }
    const p = state.player;
    context.fillStyle = '#ffb703';
    context.beginPath(); context.arc(mx + p.x * sx, my + p.y * sy, 5, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#fff';
    context.lineWidth = 2;
    context.beginPath(); context.arc(mx + p.x * sx, my + p.y * sy, 7, 0, Math.PI * 2); context.stroke();
    plainText('SUNSHINE CITY', mx + 4, my + mh - 8, 11, '#fff', 'left', 'alphabetic');
  }

  function drawHud(state, ui, now) {
    const p = state.player;
    // Top-left: cash, health, ammo.
    context.fillStyle = PALETTE.panel;
    context.fillRect(16, 16, 250, p.inCar ? 122 : 92);
    text(`$${p.cash}`, 30, 52, 30, PALETTE.cash, 'left', 'alphabetic');
    plainText(`Missions ${state.missionsDone}/5`, 150, 48, 16, PALETTE.text, 'left', 'alphabetic');
    context.fillStyle = '#333';
    context.fillRect(30, 62, 180, 14);
    context.fillStyle = p.health > 40 ? PALETTE.health : PALETTE.danger;
    context.fillRect(30, 62, 180 * clamp(p.health / 100, 0, 1), 14);
    plainText(`${Math.max(0, Math.round(p.health))} HP`, 218, 75, 13, PALETTE.text, 'left', 'alphabetic');
    plainText(p.inCar ? 'IN CAR — E to exit' : `Ammo ${p.ammo} / ${p.reserve}${p.reload > 0 ? '  reloading…' : ''}`, 30, 100, 14, PALETTE.muted, 'left', 'alphabetic');
    if (p.inCar) {
      // v2 (B2): the driven car's health, so damage is visible before it stalls.
      context.fillStyle = '#333';
      context.fillRect(30, 108, 180, 8);
      context.fillStyle = p.inCar.health > 40 ? '#ffb703' : PALETTE.danger;
      context.fillRect(30, 108, 180 * clamp(p.inCar.health / 100, 0, 1), 8);
      plainText('CAR', 218, 116, 11, PALETTE.muted, 'left', 'alphabetic');
    }
    // Wanted stars, top centre. v2 (A4): they pulse big + red while the
    // flash timer runs right after the wanted level goes up.
    const flashing = state.wantedFlash > 0;
    const starSize = flashing ? 34 + Math.sin(now / 90) * 5 : 34;
    const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    text(stars, VIEW.width / 2, 52, starSize, state.wanted > 0 ? PALETTE.danger : 'rgba(255,255,255,0.55)', 'center', 'alphabetic');
    if (state.wanted > 0) plainText('WANTED', VIEW.width / 2, 76, 13, PALETTE.danger, 'center', 'alphabetic');
    drawMinimap(state, ui.target);
    // Mission banner under the top bar. v2 (A3): live distance to the target.
    if (ui.mission) {
      context.fillStyle = PALETTE.panel;
      const label = `${ui.mission.title} — ${ui.mission.objective}`;
      context.fillRect(VIEW.width / 2 - 330, 92, 660, 44);
      context.fillStyle = PALETTE.accent;
      context.fillRect(VIEW.width / 2 - 330, 92, 6, 44);
      plainText(label, VIEW.width / 2 - 312, 112, 16, PALETTE.text, 'left', 'alphabetic');
      let sub = ui.missionTimer > 0 ? `Time left: ${Math.ceil(ui.missionTimer)}s` : (ui.target ? ui.target.label : '');
      if (ui.target) {
        const metres = Math.round(Math.hypot(ui.target.x - p.x, ui.target.y - p.y) / 4);
        sub = `${ui.target.label} — ${metres} m${ui.missionTimer > 0 ? `  •  ${Math.ceil(ui.missionTimer)}s left` : ''}`;
      }
      plainText(sub, VIEW.width / 2 - 312, 130, 13, PALETTE.accent, 'left', 'alphabetic');
    }
    // v2 (A3): off-screen edge arrow — always points at the mission target.
    if (ui.target) {
      const tx = ui.target.x - p.x;
      const ty = ui.target.y - p.y;
      const distPx = Math.hypot(tx, ty);
      if (distPx > 420) {
        const ang = Math.atan2(ty, tx);
        const ax = VIEW.width / 2 + Math.cos(ang) * 300;
        const ay = VIEW.height / 2 + Math.sin(ang) * 190;
        context.save();
        context.translate(clamp(ax, 40, VIEW.width - 40), clamp(ay, 130, VIEW.height - 60));
        context.rotate(ang);
        context.fillStyle = PALETTE.accent;
        context.beginPath();
        context.moveTo(18, 0);
        context.lineTo(-12, -12);
        context.lineTo(-12, 12);
        context.closePath();
        context.fill();
        context.restore();
      }
    }
    // Message toast.
    if (state.message && state.messageTimer > 0) {
      context.fillStyle = 'rgba(0,0,0,0.65)';
      const w = Math.min(720, 40 + state.message.length * 8);
      context.fillRect(VIEW.width / 2 - w / 2, VIEW.height - 92, w, 36);
      plainText(state.message, VIEW.width / 2, VIEW.height - 68, 15, '#fff', 'center', 'alphabetic');
    }
    // Bottom hints and speed.
    plainText('WASD move / drive   •   E steal or exit car   •   Mouse aim, Click or Space shoot   •   R reload   •   Shift run   •   P pause   •   M sound', 16, VIEW.height - 16, 13, 'rgba(255,255,255,0.75)', 'left', 'alphabetic');
    if (p.inCar) {
      const speed = Math.round(Math.abs(p.inCar.speed) * 0.18);
      text(`${speed}`, VIEW.width - 60, VIEW.height - 44, 44, '#fff', 'right', 'alphabetic');
      plainText('km/h', VIEW.width - 58, VIEW.height - 44, 14, PALETTE.muted, 'left', 'alphabetic');
    }
    void now;
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 680;
    const height = 170 + lines.length * 32;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(8,12,20,0.88)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || PALETTE.accent;
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 74, 46, '#fff', 'center', 'alphabetic');
    lines.forEach((line, i) => plainText(line, VIEW.width / 2, y + 118 + i * 32, 17, PALETTE.muted, 'center', 'alphabetic'));
    text(prompt, VIEW.width / 2, y + height - 30, 20, accent || PALETTE.accent, 'center', 'alphabetic');
  }

  function draw(state, screen, best, ui) {
    const now = performance.now();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0b1220';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const p = state.player;
    const camX = clamp(p.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    const camY = clamp(p.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
    // v2 (B2): screen shake after a hard crash, scaled to the impact.
    const shake = state.shake || 0;
    const shX = shake > 0 ? (Math.random() - 0.5) * shake * 14 : 0;
    const shY = shake > 0 ? (Math.random() - 0.5) * shake * 14 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x - camX * view.scale + shX, view.y - camY * view.scale + shY);
    drawCity(state, camX, camY, now);
    // Mission target beacon.
    if (ui.target && screen === SCREEN_PLAY) {
      const pulse = 34 + Math.sin(now / 260) * 8;
      context.strokeStyle = PALETTE.accent;
      context.lineWidth = 4;
      context.beginPath(); context.arc(ui.target.x, ui.target.y, pulse, 0, Math.PI * 2); context.stroke();
      context.fillStyle = PALETTE.accent;
      context.beginPath();
      context.moveTo(ui.target.x, ui.target.y - 26);
      context.lineTo(ui.target.x + 12, ui.target.y - 6);
      context.lineTo(ui.target.x - 12, ui.target.y - 6);
      context.closePath(); context.fill();
    }
    // Race checkpoints.
    if (ui.mission && ui.mission.type === 'race' && screen === SCREEN_PLAY) {
      ui.mission.checkpoints.forEach((cp, i) => {
        if (i < ui.checkpoint) return;
        context.strokeStyle = i === ui.checkpoint ? PALETTE.accent : 'rgba(255,255,255,0.6)';
        context.lineWidth = i === ui.checkpoint ? 5 : 3;
        context.beginPath(); context.arc(cp.x, cp.y, i === ui.checkpoint ? 52 : 40, 0, Math.PI * 2); context.stroke();
        plainText(`${i + 1}`, cp.x, cp.y + 6, 20, '#fff', 'center', 'alphabetic');
      });
    }
    // Pickups.
    for (const pk of state.pickups) {
      if (!pk.active) continue;
      const bob = Math.sin(now / 400 + pk.x) * 3;
      context.fillStyle = pk.kind === 'cash' ? '#2ec4b6' : pk.kind === 'health' ? '#43aa5b' : '#ffb703';
      context.beginPath(); context.arc(pk.x, pk.y + bob, 14, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#fff'; context.lineWidth = 2;
      context.beginPath(); context.arc(pk.x, pk.y + bob, 14, 0, Math.PI * 2); context.stroke();
      plainText(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : 'A', pk.x, pk.y + bob + 5, 16, '#fff', 'center', 'alphabetic');
    }
    for (const car of state.cars) drawCar(car, now, car === p.inCar);
    for (const ped of state.peds) {
      if (ped.down) {
        context.fillStyle = ped.color;
        context.beginPath(); context.ellipse(ped.x, ped.y, 16, 8, ped.angle, 0, Math.PI * 2); context.fill();
        continue;
      }
      context.fillStyle = 'rgba(0,0,0,0.3)';
      context.beginPath(); context.ellipse(ped.x, ped.y + 10, 10, 4, 0, 0, Math.PI * 2); context.fill();
      context.fillStyle = ped.color;
      context.beginPath(); context.arc(ped.x, ped.y, 10, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#f1c27d';
      context.beginPath(); context.arc(ped.x, ped.y - 4, 5, 0, Math.PI * 2); context.fill();
      // v2 (A4): a fleeing pedestrian shows a "!" — the panic reads at a glance.
      if (ped.flee > 0) {
        context.fillStyle = '#e63946';
        context.font = `bold 20px ${FONT}`;
        context.textAlign = 'center';
        context.textBaseline = 'alphabetic';
        context.fillText('!', ped.x, ped.y - 18);
      }
    }
    for (const e of state.enemies) {
      if (e.health <= 0) continue;
      context.fillStyle = '#e63946';
      context.beginPath(); context.arc(e.x, e.y, 14, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#111'; context.lineWidth = 3;
      context.beginPath(); context.moveTo(e.x, e.y); context.lineTo(e.x + Math.cos(e.angle) * 26, e.y + Math.sin(e.angle) * 26); context.stroke();
      context.fillStyle = '#333'; context.fillRect(e.x - 16, e.y - 26, 32, 5);
      context.fillStyle = '#e63946'; context.fillRect(e.x - 16, e.y - 26, 32 * clamp(e.health / 100, 0, 1), 5);
    }
    // Bullets.
    for (const b of state.bullets) {
      context.strokeStyle = b.fromPlayer ? '#ffe66d' : '#ff6b6b';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    // Player on foot.
    if (!p.inCar) {
      context.fillStyle = 'rgba(0,0,0,0.3)';
      context.beginPath(); context.ellipse(p.x, p.y + 11, 12, 5, 0, 0, Math.PI * 2); context.fill();
      context.fillStyle = PALETTE.player;
      context.beginPath(); context.arc(p.x, p.y, 14, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#7a5b00'; context.lineWidth = 2;
      context.beginPath(); context.arc(p.x, p.y, 14, 0, Math.PI * 2); context.stroke();
      context.strokeStyle = '#222'; context.lineWidth = 4;
      context.beginPath(); context.moveTo(p.x, p.y); context.lineTo(p.x + Math.cos(p.aimAngle) * 26, p.y + Math.sin(p.aimAngle) * 26); context.stroke();
      // Aim crosshair at the mouse (screen space is drawn later; this is the world gun line only).
    }
    // v2 (A2): "E — steal car" floats above the nearest car on foot.
    if (screen === SCREEN_PLAY && !p.inCar) {
      let hintCar = null;
      let hintD = 110;
      for (const car of state.cars) {
        if (car.dead || car.kind === 'police' || car.kind === 'roadblock') continue;
        const d = Math.hypot(car.x - p.x, car.y - p.y);
        if (d < hintD) { hintD = d; hintCar = car; }
      }
      if (hintCar) {
        const label = 'E — steal car';
        context.font = `bold 15px ${FONT}`;
        const w = context.measureText(label).width + 18;
        context.fillStyle = 'rgba(12,18,28,0.85)';
        context.fillRect(hintCar.x - w / 2, hintCar.y - 62, w, 26);
        context.fillStyle = '#ffb703';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(label, hintCar.x, hintCar.y - 48);
      }
    }
    // Back to screen space for HUD and panels.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, ui, now);
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(6,10,18,0.55)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      text('SUNSHINE CITY', VIEW.width / 2, 190, 72, '#ffb703', 'center', 'alphabetic');
      plainText('v2 — A sunny coastal city. One newcomer. Five jobs. One king.', VIEW.width / 2, 232, 20, '#fff', 'center', 'alphabetic');
      plainText('Kai Reyes came to Sunshine City with $40 and a duffel bag.', VIEW.width / 2, 272, 16, PALETTE.muted, 'center', 'alphabetic');
      plainText('Mara Solano has jobs. Vic Delgado has the docks. The city has room for one more king.', VIEW.width / 2, 298, 16, PALETTE.muted, 'center', 'alphabetic');
      const lines = [
        'WASD move / drive  •  E steal or exit a car  •  Mouse aim, Click or Space to shoot',
        'Space — shoot / confirm  •  R reload  •  Shift run  •  P pause  •  M sound',
        // v2 (A1): the title names the save — mission, cash, time — instead
        // of only saying one exists. Progress saves automatically on pause,
        // on mission completion and every 10 seconds of play.
        ui.saveSummary || (ui.hasSave ? `Saved game found — best cash $${best}. Press Enter to continue.` : `Best cash so far: $${best}.`),
      ];
      lines.forEach((line, i) => plainText(line, VIEW.width / 2, 360 + i * 30, 16, '#fff', 'center', 'alphabetic'));
      text(ui.hasSave ? 'ENTER — CONTINUE    •    N — NEW GAME' : 'ENTER — START', VIEW.width / 2, 500, 22, PALETTE.accent, 'center', 'alphabetic');
      plainText('An original game. No Rockstar names, characters, map or music.', VIEW.width / 2, 560, 13, 'rgba(255,255,255,0.6)', 'center', 'alphabetic');
    } else if (screen === SCREEN_PAUSED) {
      context.fillStyle = 'rgba(6,10,18,0.5)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('Paused', [`${state.mission ? state.mission.title : 'Free roam'} — $${p.cash} in pocket`, 'Progress is saved.'], 'P — RESUME   •   Q — QUIT TO TITLE');
    } else if (screen === SCREEN_OVER) {
      context.fillStyle = 'rgba(20,4,8,0.6)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('BUSTED', ['The police picked you up at Sunshine Clinic.', '-$100 hospital bill. The city is still yours to take.'], 'ENTER — GET BACK OUT THERE', PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      context.fillStyle = 'rgba(6,14,10,0.55)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('KING OF SUNSHINE CITY', ['All five jobs done. Kai Reyes owns the town now.', `Final cash: $${p.cash}   •   Cars stolen: ${state.carsStolen}`], 'ENTER — KEEP PLAYING THE CITY', PALETTE.cash);
    }
    // Mouse crosshair on foot.
    if (screen === SCREEN_PLAY && !p.inCar && ui.mouse) {
      context.strokeStyle = '#fff';
      context.lineWidth = 2;
      context.beginPath(); context.arc(ui.mouse.x, ui.mouse.y, 10, 0, Math.PI * 2); context.stroke();
      context.beginPath();
      context.moveTo(ui.mouse.x - 14, ui.mouse.y); context.lineTo(ui.mouse.x - 6, ui.mouse.y);
      context.moveTo(ui.mouse.x + 6, ui.mouse.y); context.lineTo(ui.mouse.x + 14, ui.mouse.y);
      context.moveTo(ui.mouse.x, ui.mouse.y - 14); context.lineTo(ui.mouse.x, ui.mouse.y - 6);
      context.moveTo(ui.mouse.x, ui.mouse.y + 6); context.lineTo(ui.mouse.x, ui.mouse.y + 14);
      context.stroke();
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
