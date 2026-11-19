import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  addPlayer,
  applyAction,
  publicRoom,
  advanceClock,
} from "../lib/game-engine.mjs";

// Independent scoring oracle: fixed advertised pools/risk, with exhaustive sector
// distributions rather than duplicating the engine's player-iteration algorithm.
test("all 2–6 player allocations obey fixed first-round scoring and shield privacy", () => {
  const pools = [24, 30, 36];
  let cases = 0;
  for (let count = 2; count <= 6; count++) {
    for (let allocation = 0; allocation < 3 ** count; allocation++) {
      const picks = Array.from(
        { length: count },
        (_, i) => Math.floor(allocation / 3 ** i) % 3,
      );
      for (const storms of [false, true]) {
        const state = createGame({
          code: "QA2345",
          name: "Crew0",
          id: "p0",
          tokenHash: "h0",
          now: 0,
          random: () => (storms ? 0 : 0.99),
        });
        for (let i = 1; i < count; i++) {
          addPlayer(state, {
            id: `p${i}`,
            name: `Crew${i}`,
            tokenHash: `h${i}`,
          });
          applyAction(state, `p${i}`, { type: "ready", ready: true }, 0);
        }
        applyAction(state, "p0", { type: "start" }, 0);
        for (let i = 0; i < count; i++) {
          applyAction(
            state,
            `p${i}`,
            { type: "choose", round: 1, sector: picks[i], shield: i % 2 === 0 },
            1,
          );
          if (i < count - 1) {
            const visible = publicRoom(state, `p${count - 1}`, i, 1);
            assert.equal(visible.result, null);
            assert.equal(visible.players[i].shields, 2);
            assert.ok(!JSON.stringify(visible).includes("stormRolls"));
            assert.ok(!JSON.stringify(visible).includes("tokenHash"));
          }
        }
        const occupancy = [0, 1, 2].map(
          (sector) => picks.filter((p) => p === sector).length,
        );
        const expected = picks.map((sector, i) =>
          storms && i % 2 ? 0 : Math.floor(pools[sector] / occupancy[sector]),
        );
        assert.deepEqual(
          state.players.map((p) => p.score),
          expected,
        );
        assert.deepEqual(
          state.players.map((p) => p.shields),
          picks.map((_, i) => (i % 2 === 0 ? 1 : 2)),
        );
        assert.equal(state.history.length, 1);
        assert.equal(advanceClock(state, 100_000), false);
        cases++;
      }
    }
  }
  assert.equal(cases, 2178);
});

test("leaving before resolution removes that crew from sector shares and shield use", () => {
  const state = createGame({
    code: "QA2345",
    name: "Crew0",
    id: "p0",
    tokenHash: "h0",
    now: 0,
    random: () => 0.99,
  });
  for (let i = 1; i <= 2; i++) {
    addPlayer(state, { id: `p${i}`, name: `Crew${i}`, tokenHash: `h${i}` });
    applyAction(state, `p${i}`, { type: "ready", ready: true }, 0);
  }
  applyAction(state, "p0", { type: "start" }, 0);
  applyAction(
    state,
    "p0",
    { type: "choose", round: 1, sector: 2, shield: false },
    1,
  );
  applyAction(
    state,
    "p1",
    { type: "choose", round: 1, sector: 2, shield: true },
    2,
  );
  applyAction(state, "p1", { type: "leave" }, 3);
  applyAction(
    state,
    "p2",
    { type: "choose", round: 1, sector: 2, shield: false },
    4,
  );
  assert.deepEqual(
    state.players.map((p) => p.score),
    [18, 0, 18],
  );
  assert.equal(state.players[1].shields, 2);
  assert.equal(state.result.gains.length, 2);
});
