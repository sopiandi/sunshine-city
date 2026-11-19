// Sunshine City v3 — world constants, districts and mission definitions.
// All names, places and characters are original.
export const WORLD = { w: 2800, h: 2400 };

export const ROADS_X = [300, 650, 1000, 1350, 1700, 2050, 2400];
export const ROADS_Y = [300, 650, 1000, 1350, 1700, 2050];
export const ROAD_W = 72;

export const SPAWN = { x: 1330, y: 1125 };
export const CLINIC = { x: 1180, y: 1040, w: 130, h: 150, name: "Sunshine Clinic" };
// Starter car: parked, unlocked, west of the clinic, nose toward the exit road.
export const STARTER_CAR = { x: 960, y: 1155, angle: 0, color: "#e8b23a" };
export const PARKED_CARS = [
  { x: 620, y: 780, angle: Math.PI / 2, color: "#3a7bd5" },
  { x: 620, y: 830, angle: Math.PI / 2, color: "#c94f4f" },
  { x: 2050, y: 420, angle: 0, color: "#4f9d69" },
  { x: 1400, y: 2050, angle: -Math.PI / 2, color: "#8a5fc0" },
  { x: 1750, y: 1500, angle: 0, color: "#d5d5d5" },
];

export const DISTRICTS = [
  { name: "Marina Bay", x0: 0, y0: 1500, x1: 1150, y1: 2400,
    ground: "#9db98a", road: "#5a5f6b", build: "#f2e3c6", accent: "#2fa8a0", sign: "#0e7c86" },
  { name: "Old Docks", x0: 1700, y0: 0, x1: 2800, y1: 1000,
    ground: "#8a7a5e", road: "#4c463c", build: "#a9805a", accent: "#c96a2c", sign: "#7a3b12" },
  { name: "Downtown", x0: 0, y0: 0, x1: 2800, y1: 2400,
    ground: "#8fae7d", road: "#555a66", build: "#cfd6e4", accent: "#e8b23a", sign: "#274b8f" },
];

export function districtAt(x, y) {
  if (x < 1150 && y >= 1500) return DISTRICTS[0];
  if (x >= 1700 && y < 1000) return DISTRICTS[1];
  return DISTRICTS[2];
}

export const MISSIONS = [
  {
    name: "Hot Wheels", pay: 200,
    intro: "Kai needs wheels. Steal the yellow coupe parked west of the clinic, then drive it to Marina Bay.",
    stages: [
      { label: "Steal the yellow car west of the clinic", target: { x: 960, y: 1155 }, kind: "steal" },
      { label: "Drive to Marina Bay", target: { x: 700, y: 1880 }, kind: "drive" },
    ],
  },
  {
    name: "Sunshine Sprint", pay: 400,
    intro: "Rosa bets you can't beat the clock. Hit all three checkpoints in 90 seconds.",
    stages: [
      { label: "Checkpoint 1/3 — North Strip", target: { x: 2050, y: 300 }, kind: "drive", time: 90 },
      { label: "Checkpoint 2/3 — East Docks", target: { x: 2400, y: 1000 }, kind: "drive" },
      { label: "Checkpoint 3/3 — Marina Bay", target: { x: 350, y: 2050 }, kind: "drive" },
    ],
  },
  {
    name: "Dockside Drop", pay: 500,
    intro: "Pick up Rosa's package at the Old Docks and deliver it to the Marina Bay cafe. No questions.",
    stages: [
      { label: "Pick up the package at Old Docks", target: { x: 2200, y: 700 }, kind: "goto" },
      { label: "Deliver to the Marina Bay cafe", target: { x: 900, y: 1900 }, kind: "drive" },
    ],
  },
  {
    name: "Heat Escape", pay: 600,
    intro: "The cops are on you. Lose them and reach the safehouse on the south strip.",
    stages: [
      { label: "Reach the safehouse — lose the cops", target: { x: 400, y: 2100 }, kind: "escape", wanted: 3 },
    ],
  },
  {
    name: "Dock War", pay: 1000,
    intro: "Marlo's crew took the docks. Clear them out, then meet Rosa at the plaza.",
    stages: [
      { label: "Clear the dock crew (6 left)", target: { x: 2250, y: 850 }, kind: "combat", foes: 6 },
      { label: "Meet Rosa at the plaza", target: { x: 1300, y: 1300 }, kind: "goto" },
    ],
  },
];

export const SAVE_KEY = "sunshine-city-v3-save";
export const START_AMMO = 12;
export const START_RESERVE = 48;
