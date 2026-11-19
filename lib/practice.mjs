import {
  createGame,
  addPlayer,
  applyAction,
  advanceClock,
  publicRoom,
  secureRoll,
} from "./game-engine.mjs";

// Local, explicitly labelled training. Multiplayer authority remains in the server.
// Opponents commit BEFORE the human acts, using only previously revealed history.
function commitOpponents(sim, now) {
  const view = publicRoom(sim.game, "pilot", sim.revision, now);
  const last = view.history.at(-1);
  for (const [index, id] of ["kestrel", "echo", "rook"].entries()) {
    const bot = view.players.find((p) => p.id === id);
    const crowd = view.sectors.map(
      (s) => last?.gains.filter((g) => g.sectorId === s.id).length ?? 0,
    );
    let weights =
      index === 0
        ? [6, 3, 1]
        : index === 1
          ? [1, 3, 6]
          : crowd.map((n) => 1 / (n + 1));
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = sim.random() * total;
    let sector = weights.length - 1;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll < 0) {
        sector = i;
        break;
      }
    }
    const shield =
      bot.shields > 0 &&
      (view.round > 4 || (sector === 2 && sim.random() < 0.55));
    applyAction(
      sim.game,
      id,
      { type: "choose", sector, shield, round: view.round },
      now,
    );
  }
}

export function createPractice(
  name = "Pilot",
  now = Date.now(),
  random = secureRoll,
) {
  const game = createGame({
    code: "TRAINING",
    name,
    id: "pilot",
    tokenHash: "local-pilot",
    now,
    random,
  });
  for (const [id, callsign] of [
    ["kestrel", "Kestrel · BOT"],
    ["echo", "Echo · BOT"],
    ["rook", "Rook · BOT"],
  ]) {
    addPlayer(game, { id, name: callsign, tokenHash: `local-${id}` });
    applyAction(game, id, { type: "ready", ready: true }, now);
  }
  applyAction(game, "pilot", { type: "start" }, now);
  const sim = { game, random, revision: 1 };
  commitOpponents(sim, now);
  return sim;
}

export function practiceView(sim, now = Date.now()) {
  return publicRoom(sim.game, "pilot", sim.revision, now);
}

export function tickPractice(sim, now = Date.now()) {
  if (!advanceClock(sim.game, now)) return null;
  sim.revision++;
  return practiceView(sim, now);
}

export function practiceAction(sim, type, extra = {}, now = Date.now()) {
  if (advanceClock(sim.game, now)) sim.revision++;
  applyAction(sim.game, "pilot", { type, ...extra }, now, sim.random);
  if (type === "rematch") {
    for (const bot of sim.game.players.filter((p) => p.id !== "pilot"))
      applyAction(sim.game, bot.id, { type: "ready", ready: true }, now);
    applyAction(sim.game, "pilot", { type: "start" }, now);
  }
  if (type === "continue" || type === "rematch") commitOpponents(sim, now);
  sim.revision++;
  return practiceView(sim, now);
}
