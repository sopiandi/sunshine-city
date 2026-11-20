# Sunshine City

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/sopiandi/sunshine-city/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/sopiandi/sunshine-city/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/c/gta6-01). Kai Reyes is back in
Sunshine City, broke and wanted: steal a ride, outrun the Sunshine PD, run
parcels for the marina crew and take the docks back across five story
missions in one sunny coastal city.

Everything is original — city, characters, vehicles, story, art and music —
drawn and synthesised from code. No Rockstar names, characters, maps or
assets. Vanilla JavaScript, no libraries, no network requests: the whole
game is static files under `game/`.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

Desktop: **WASD / arrows** move & drive, **Shift** run, **E** enter / steal
a car, **Space / click** shoot, **R** reload, **P / Esc** pause (saves),
**M** mute, **N** new game, **Q** quit to menu. Touch screens get a virtual
joystick on the left and SHOOT / CAR / RELOAD / PAUSE buttons on the right.

## What's inside

- A living city: traffic that queues at intersections, pedestrians who
  cross, panic and flee, two districts with their own look — Marina Bay and
  Old Docks — plus Downtown and Northside.
- Wanted 0–5: stealing any car is +1, shooting in front of a witness is +1,
  shooting a police car is +2. Police chase, shoot back at wanted 3+ and
  set roadblocks at wanted 4–5; lose them and the stars decay one per
  30 seconds.
- Five story missions ($200 / $400 / $500 / $600 / $1,000) with a live
  distance banner, an edge arrow and a minimap that never confuses the
  player dot with the target.
- Full save / continue: position, health, money, mission + stage, ammo,
  wanted and the driven car — colour, position and health included.
- Procedural WebAudio sound and music (M mutes everything).

## Entry

Built with the [make.fun](https://make.fun) kit. Referral code: `nz5z89a8`.
