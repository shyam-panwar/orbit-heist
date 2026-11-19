/** @param {import('../app/game-types').Room} room @param {number} round */
export function replayAt(room, round) {
  return room.players.map((player) => ({
    ...player,
    score: room.history
      .filter((h) => h.round <= round)
      .reduce(
        (sum, h) =>
          sum + (h.gains.find((g) => g.playerId === player.id)?.gain ?? 0),
        0,
      ),
  }));
}

/** @param {import('../app/game-types').Room} room @param {string | null} playerId */
export function playerDebrief(room, playerId) {
  let solo = 0,
    saved = 0,
    shared = 0,
    missed = 0,
    shields = 0;
  for (const result of room.history) {
    const mine = result.gains.find((g) => g.playerId === playerId);
    if (!mine || mine.sectorId === null) {
      missed++;
      continue;
    }
    const arrivals = result.gains.filter(
      (g) => g.sectorId === mine.sectorId,
    ).length;
    if (arrivals === 1) solo++;
    else shared++;
    if (mine.shield) shields++;
    if (mine.shield && mine.storm) saved += mine.gain;
  }
  const title =
    saved > 0
      ? "Storm runner"
      : solo >= 3
        ? "Lone navigator"
        : shared >= 3
          ? "Crowd reader"
          : "Orbit explorer";
  const tip =
    missed > 0
      ? `${missed} missed ${missed === 1 ? "move" : "moves"}. Lock before the timer ends; an unconfirmed choice earns zero.`
      : shared >= 3
        ? "You often landed with company. Watch the previous-round traffic and try an overlooked sector."
        : shields === 0
          ? "Both shields stayed unused. They can protect a large late-round haul, even in a risky sector."
          : "Your next challenge: vary your route. A predictable pilot is easier for friends to crowd.";
  return { solo, saved, shared, missed, shields, title, tip };
}
