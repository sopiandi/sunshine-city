// Sunshine City v3 — the five-story mission chain for Kai Reyes.
// Each mission has stages with a live target; the banner always shows the
// distance to the active target.
import { MISSIONS } from "./config.js";
import { dist } from "./random.js";

export function missionDef(S) { return MISSIONS[S.missionIndex] || null; }
export function stageDef(S) {
  const m = missionDef(S);
  return m ? m.stages[S.stageIndex] || null : null;
}

export function missionTarget(S) {
  const st = stageDef(S);
  if (!st) return null;
  if (st.kind === "combat" && S.foesLeft > 0) {
    const foe = S.peds.find((p) => p.foe && !p.dead);
    if (foe) return { x: foe.x, y: foe.y, label: st.label };
  }
  return { x: st.target.x, y: st.target.y, label: st.label };
}

export function missionLabel(S) {
  const m = missionDef(S);
  if (!m) return "Free roam — Sunshine City is yours";
  const st = stageDef(S);
  const base = "Mission " + (S.missionIndex + 1) + " of 5: " + m.name + " — " + (st ? st.label : "");
  if (st && st.kind === "combat") return base.replace(/\(\d+ left\)/, "(" + S.foesLeft + " left)");
  return base;
}

export function missionDistance(S) {
  const t = missionTarget(S);
  if (!t) return 0;
  return Math.round(dist(S.player.x, S.player.y, t.x, t.y) / 10);
}

// Called every frame; returns event strings the game loop turns into banners.
export function updateMissions(S, dt, hooks) {
  const m = missionDef(S);
  if (!m) return;
  const st = stageDef(S);
  if (!st) return;
  S.missionTime += dt;
  const p = S.player;
  const t = missionTarget(S);
  if (st.kind === "steal") {
    if (p.inCar) { advanceStage(S, hooks); }
  } else if (st.kind === "drive" || st.kind === "goto") {
    const needCar = st.kind === "drive";
    if (t && dist(p.x, p.y, t.x, t.y) < 100 && (!needCar || p.inCar)) {
      if (st.time && S.missionTime > st.time && S.stageIndex === 0 && S.missionIndex === 1) {
        hooks.onMissionFailed("Out of time — race failed. Try again.");
        resetMission(S);
        return;
      }
      advanceStage(S, hooks);
    }
  } else if (st.kind === "escape") {
    if (t && dist(p.x, p.y, t.x, t.y) < 100) advanceStage(S, hooks);
  } else if (st.kind === "combat") {
    if (S.foesLeft <= 0) advanceStage(S, hooks);
  }
}

function advanceStage(S, hooks) {
  const m = missionDef(S);
  S.stageIndex++;
  if (S.stageIndex >= m.stages.length) {
    S.money += m.pay;
    hooks.onMissionComplete(m);
    S.missionIndex++;
    S.stageIndex = 0;
    S.missionTime = 0;
    if (S.missionIndex < MISSIONS.length) {
      const nm = MISSIONS[S.missionIndex];
      hooks.onMissionStart(nm);
      setupMission(S);
    } else {
      hooks.onStoryComplete();
    }
  } else {
    S.missionTime = 0;
    hooks.onStageAdvance(stageDef(S));
  }
}

function resetMission(S) {
  S.stageIndex = 0;
  S.missionTime = 0;
  setupMission(S);
}

export function setupMission(S) {
  const m = missionDef(S);
  if (!m) return;
  // Mission 4 starts hot: wanted 3.
  if (S.missionIndex === 3) {
    S.wanted = Math.max(S.wanted, 3);
    S.lastCrime = S.time;
  }
  // Mission 5 spawns the dock crew.
  if (S.missionIndex === 4) {
    S.foesLeft = 6;
    const spots = [[2250, 850], [2300, 900], [2200, 900], [2280, 780], [2180, 820], [2350, 860]];
    for (let i = 0; i < 6; i++) {
      S.peds.push({
        x: spots[i][0], y: spots[i][1], angle: 0, walkSpeed: 0, speed: 0,
        tx: spots[i][0], ty: spots[i][1], pause: 0,
        down: 0, dead: false, panic: 0, hitCount: 0, foe: true,
        shirt: "#3a3a3a", shootT: 1 + i * 0.3,
      });
    }
  }
}
