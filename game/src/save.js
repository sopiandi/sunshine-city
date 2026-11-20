// Sunshine City — save / continue. The save is the whole run state:
// position, health, money, mission + stage, ammo + reserve, wanted,
// and the driven car including its colour, position and health.
// Written fresh in this session for the v3 rebuild.
import { SAVE_KEY } from "./config.js";

export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s.x !== "number" || typeof s.money !== "number") return null;
    return s;
  } catch (e) {
    return null;
  }
}

export function writeSave(S) {
  try {
    const car = S.inCar && S.car
      ? { color: S.car.color, x: S.car.x, y: S.car.y, hp: S.car.hp, angle: S.car.angle }
      : null;
    const data = {
      version: "v4",
      x: S.player.x, y: S.player.y, hp: S.player.hp,
      money: S.money, missionIndex: S.missionIndex, stage: S.stage,
      ammo: S.ammo, reserve: S.reserve, wanted: S.wanted,
      inCar: S.inCar, car,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return data;
  } catch (e) {
    return null;
  }
}

export function saveSummary() {
  const s = readSave();
  if (!s) return null;
  const d = new Date(s.savedAt);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { mission: s.missionIndex + 1, money: s.money, time: hh + ":" + mm };
}
