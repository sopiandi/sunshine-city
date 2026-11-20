// Sunshine City — the five story missions of Kai Reyes, plus the
// mission banner target logic. Written fresh in this session (v3).
import { dist } from "./config.js";
import { addWanted } from "./world.js";

export const MISSIONS = [
  {
    name: "Mission 1 — Hot Wheels",
    reward: 200,
    stages: [
      { text: "Steal a car", target: { x: 980, y: 1180 }, hint: "The red car west of the clinic is unlocked. Press E near it." },
      { text: "Drive to Marina Bay", target: { x: 700, y: 1880 }, hint: "Follow the yellow arrow to the marina." },
    ],
  },
  {
    name: "Mission 2 — Bay City Sprint",
    reward: 400,
    stages: [
      { text: "Race: checkpoint 1 of 3", target: { x: 1900, y: 700 } },
      { text: "Race: checkpoint 2 of 3", target: { x: 2300, y: 1900 } },
      { text: "Race: checkpoint 3 of 3", target: { x: 700, y: 300 } },
    ],
  },
  {
    name: "Mission 3 — Parcel Run",
    reward: 500,
    stages: [
      { text: "Pick up the parcel at the docks", target: { x: 2150, y: 1650 } },
      { text: "Deliver the parcel to Marina Bay", target: { x: 500, y: 1900 } },
    ],
  },
  {
    name: "Mission 4 — Heat Escape",
    reward: 600,
    stages: [
      { text: "Lose the heat — reach the hideout", target: { x: 400, y: 400 } },
    ],
  },
  {
    name: "Mission 5 — Dockside Showdown",
    reward: 1000,
    stages: [
      { text: "Get to the Old Docks", target: { x: 2100, y: 1800 } },
      { text: "Take down the dock crew", target: { x: 2100, y: 1800 } },
    ],
  },
];

export function missionTarget(S) {
  if (S.missionIndex >= MISSIONS.length) return null;
  const m = MISSIONS[S.missionIndex];
  const st = m.stages[Math.min(S.stage, m.stages.length - 1)];
  return st.target;
}
export function missionText(S) {
  if (S.missionIndex >= MISSIONS.length) return "Free roam — Sunshine City is yours";
  const m = MISSIONS[S.missionIndex];
  const st = m.stages[Math.min(S.stage, m.stages.length - 1)];
  return m.name + " · " + st.text;
}

// Called when a mission stage begins (e.g. spawning foes, setting wanted).
export function enterStage(S, sound) {
  if (S.missionIndex === 3 && S.stage === 0) {
    // Mission 4: the heat is on the moment it starts.
    addWanted(S, 3, "The cops are onto you — run!", sound);
  }
  if (S.missionIndex === 4 && S.stage === 1) {
    // Mission 5: five armed foes hold the dockyard.
    const spots = [
      { x: 2050, y: 1750 }, { x: 2160, y: 1740 }, { x: 2100, y: 1860 },
      { x: 2200, y: 1830 }, { x: 2030, y: 1850 },
    ];
    for (const s of spots) {
      S.peds.push({
        x: s.x, y: s.y, angle: 0, speed: 0, tx: s.x, ty: s.y, pause: 0,
        panic: 0, down: 0, dead: false, foe: true, hp: 2, color: "#8a2f2f",
        hitCd: 0, shootCd: 1,
      });
    }
    S.foesLeft = 5;
    S.msg = { text: "Dock crew: 5 left", sub: "Take them all down", t: 0 };
  }
}

function completeMission(S, sound) {
  const m = MISSIONS[S.missionIndex];
  S.money += m.reward;
  S.msg = { text: m.name + " complete!", sub: "+$" + m.reward, t: 0 };
  if (sound) sound.cash();
  if (S.missionIndex === 3) {
    // Escaped: the heat dies down once the hideout is reached.
    S.wanted = 0;
    S.lastCrime = S.time;
  }
  S.missionIndex++;
  S.stage = 0;
  if (S.missionIndex >= MISSIONS.length) {
    S.msg = { text: "STORY COMPLETE", sub: "Sunshine City is yours, Kai. Free roam!", t: 0 };
  } else {
    enterStage(S, sound);
  }
}

export function updateMissions(S, sound) {
  if (S.missionIndex >= MISSIONS.length) return;
  const m = MISSIONS[S.missionIndex];
  const st = m.stages[S.stage];
  const p = S.player;
  if (S.missionIndex === 0 && S.stage === 0) {
    // Stage 0 completes the moment Kai is behind a wheel.
    if (S.inCar) { S.stage = 1; if (sound) sound.pickup(); }
    return;
  }
  if (S.missionIndex === 4 && S.stage === 1) {
    // Stage 1 completes when the last foe falls.
    if (S.foesLeft <= 0) completeMission(S, sound);
    return;
  }
  const d = dist(p.x, p.y, st.target.x, st.target.y);
  const radius = S.missionIndex === 1 ? 95 : 100;
  if (d < radius) {
    if (S.stage + 1 < m.stages.length) {
      S.stage++;
      if (sound) sound.pickup();
      if (S.missionIndex === 4 && S.stage === 1) enterStage(S, sound);
    } else {
      completeMission(S, sound);
    }
  }
}
