import test from "node:test";
import assert from "node:assert/strict";
import {
  createPractice,
  practiceAction,
  practiceView,
  tickPractice,
} from "../lib/practice.mjs";
import { replayAt, playerDebrief } from "../lib/match-insights.mjs";

test("training commits three opponents before human input and completes six rounds", () => {
  let now = 1000;
  const sim = createPractice("Pilot", now, () => 0.8);
  let view = practiceView(sim, now);
  assert.equal(view.phase, "choosing");
  assert.equal(view.players.filter((p) => p.locked).length, 3);
  assert.equal(view.players.find((p) => p.id === "pilot").locked, false);
  assert.equal("choices" in view, false);
  assert.equal("stormRolls" in view, false);
  for (let round = 1; round <= 6; round++) {
    const committed = structuredClone(sim.game.choices);
    view = practiceAction(
      sim,
      "choose",
      { sector: 0, shield: round <= 2, round },
      now + 100,
    );
    assert.equal(view.history.length, round);
    for (const [id, choice] of Object.entries(committed))
      assert.equal(
        view.result.gains.find((g) => g.playerId === id).sectorId,
        choice.sector,
      );
    assert.equal(
      view.players.find((p) => p.id === "pilot").shields,
      Math.max(0, 2 - round),
    );
    if (round < 6) {
      now += 2200;
      view = practiceAction(sim, "continue", {}, now);
    }
  }
  assert.equal(view.phase, "finished");
  assert.deepEqual(
    replayAt(view, 6).map((p) => p.score),
    view.players.map((p) => p.score),
  );
  assert.ok(replayAt(view, 0).every((p) => p.score === 0));
  const rematch = practiceAction(sim, "rematch", {}, now + 3000);
  assert.equal(rematch.phase, "choosing");
  assert.equal(rematch.round, 1);
  assert.ok(rematch.players.every((p) => p.score === 0 && p.shields === 2));
});

test("training timeout resolves once and cannot accept a late move", () => {
  const sim = createPractice("Pilot", 1000, () => 0.9);
  const view = tickPractice(sim, 46000);
  assert.equal(view.history.length, 1);
  assert.equal(view.result.gains.find((g) => g.playerId === "pilot").gain, 0);
  assert.equal(tickPractice(sim, 47000), null);
  assert.throws(
    () =>
      practiceAction(
        sim,
        "choose",
        { sector: 0, shield: false, round: 1 },
        47000,
      ),
    /no longer/,
  );
});

test("replay and pilot profile use historical outcomes without future scores", () => {
  const room = {
    players: [
      { id: "a", score: 100 },
      { id: "b", score: 80 },
    ],
    history: [
      {
        round: 1,
        gains: [
          { playerId: "a", sectorId: 2, gain: 18, shield: true, storm: true },
          { playerId: "b", sectorId: 2, gain: 0, shield: false, storm: true },
        ],
      },
      {
        round: 2,
        gains: [
          { playerId: "a", sectorId: 0, gain: 28, shield: false, storm: false },
          {
            playerId: "b",
            sectorId: null,
            gain: 0,
            shield: false,
            storm: false,
          },
        ],
      },
    ],
  };
  assert.deepEqual(
    replayAt(room, 1).map((p) => p.score),
    [18, 0],
  );
  const profile = playerDebrief(room, "a");
  assert.equal(profile.saved, 18);
  assert.equal(profile.solo, 1);
  assert.equal(profile.shared, 1);
  assert.equal(profile.title, "Storm runner");
  assert.equal(playerDebrief(room, "b").missed, 1);
});
