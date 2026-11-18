// Sunshine City — story and missions. All names, people and places are
// invented for this game. Kai Reyes arrives in Sunshine City with nothing
// but a duffel bag; Mara Solano, a fixer who runs jobs out of Coral Market,
// gives him work; Vic Delgado's crew owns the docks and wants him gone.
import { PLACES, RACE_CHECKPOINTS } from './city.js';

export const STORY_INTRO = 'Kai Reyes came to Sunshine City with $40 and a duffel bag. Mara Solano has jobs. Vic Delgado has the docks. The city has room for one more king.';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: '1 — First Wheels',
    brief: 'Mara needs wheels. Take any parked car and bring it to Marina Bay. Nobody will miss it.',
    objective: 'Steal a car and drive to Marina Bay',
    type: 'steal',
    target: PLACES.marina,
    reward: 200,
    timeLimit: 0,
  },
  {
    id: 'sunset-sprint',
    title: '2 — Sunset Sprint',
    brief: 'A street race across the city. Hit every checkpoint before the clock runs out. Win and the whole city hears your name.',
    objective: 'Race through all 5 checkpoints',
    type: 'race',
    checkpoints: RACE_CHECKPOINTS,
    reward: 400,
    timeLimit: 100,
  },
  {
    id: 'payback-run',
    title: '3 — Payback Run',
    brief: 'Pick up Mara\'s package at Coral Market and deliver it to the Marina drop. Fast and quiet — or fast and loud.',
    objective: 'Collect the package, then deliver it',
    type: 'deliver',
    pickup: PLACES.marketPickup,
    target: PLACES.marketDrop,
    reward: 500,
    timeLimit: 0,
  },
  {
    id: 'heat-wave',
    title: '4 — Heat Wave',
    brief: 'Vic tipped off the police. Three stars, a whole precinct on your tail. Survive 35 seconds — then disappear.',
    objective: 'Survive the police chase for 35 seconds',
    type: 'escape',
    target: PLACES.hideout,
    reward: 600,
    timeLimit: 35,
  },
  {
    id: 'king-of-sunshine',
    title: '5 — King of Sunshine',
    brief: 'Vic\'s crew is waiting at the Old Docks. End it. Then take the Palm Tower and the city is yours.',
    objective: 'Clear the docks, then reach Palm Tower',
    type: 'shootout',
    target: PLACES.docks,
    finalTarget: PLACES.penthouse,
    enemies: 6,
    reward: 1000,
    timeLimit: 0,
  },
];

export const MISSION_COMPLETE_TEXT = 'Mission complete. Mara is impressed — and the city is watching.';
export const WIN_TEXT = 'KING OF SUNSHINE CITY — Kai Reyes owns the town now. Thanks for playing.';
