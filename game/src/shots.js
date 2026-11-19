// Sunshine City v3 — staged poses for screenshots (used by the maker's
// screenshot script, never by gameplay). Each pose sets up a scene that
// shows several systems at once.
export function poseChase(api) {
  const S = api.state;
  api.teleport(1500, 1150);
  api.setWanted(3);
  const car = S.cars.find((c) => c.kind === "parked" && !c.stolen);
  if (car) {
    S.player.inCar = true; S.player.car = car; car.stolen = true;
    car.x = 1500; car.y = 1150; car.speed = 0;
    S.player.x = 1500; S.player.y = 1150;
  }
  return "chase: wanted 3, police inbound, mission arrow live";
}

export function poseStreet(api) {
  const S = api.state;
  S.player.inCar = false; S.player.car = null;
  api.teleport(1330, 1125);
  api.setWanted(0);
  return "street: spawn by the clinic, traffic and pedestrians";
}

export function poseMarina(api) {
  const S = api.state;
  api.teleport(700, 1880);
  api.setWanted(0);
  const car = S.cars.find((c) => c.kind === "parked" && !c.stolen);
  if (car) {
    S.player.inCar = true; S.player.car = car; car.stolen = true;
    car.x = 700; car.y = 1880; car.speed = 0;
    S.player.x = 700; S.player.y = 1880;
  }
  return "marina: mission target reached in Marina Bay";
}

export function poseDocks(api) {
  api.teleport(2250, 850);
  api.setWanted(2);
  return "docks: Old Docks crew territory, wanted 2";
}
