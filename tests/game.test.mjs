import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  addPlayer,
  applyAction,
  advanceClock,
  publicRoom,
  cleanName,
  ROOM_TTL_MS,
  sectorsForRound,
} from "../lib/game-engine.mjs";
import { handleRoomsApi, hashToken } from "../lib/rooms-api.mjs";
import { createRoomStore } from "../lib/room-store.mjs";

function fixture(random = () => 0.99) {
  const state = createGame({
    code: "ABC234",
    name: "Nova",
    id: "a",
    tokenHash: "hash-a",
    now: 1000,
    random,
  });
  addPlayer(state, { id: "b", name: "Orbit", tokenHash: "hash-b" });
  applyAction(state, "b", { type: "ready", ready: true }, 1000);
  applyAction(state, "a", { type: "start" }, 1000);
  return state;
}

test("calm sectors split a finite pool and all locks resolve once", () => {
  const state = fixture();
  applyAction(
    state,
    "a",
    { type: "choose", round: 1, sector: 2, shield: false },
    1100,
  );
  assert.equal(state.phase, "choosing");
  assert.throws(
    () =>
      applyAction(
        state,
        "a",
        { type: "choose", round: 1, sector: 0, shield: false },
        1150,
      ),
    /already locked/,
  );
  applyAction(
    state,
    "b",
    { type: "choose", round: 1, sector: 2, shield: false },
    1200,
  );
  assert.equal(state.phase, "reveal");
  assert.deepEqual(
    state.players.map((p) => p.score),
    [18, 18],
  );
  assert.equal(state.history.length, 1);
  assert.deepEqual(state.result.stormIds, []);
  assert.deepEqual(state.choices, {});
});

test("storm gains zero except an explicitly consumed shield, including on calm sectors", () => {
  const state = fixture(() => 0);
  applyAction(
    state,
    "a",
    { type: "choose", round: 1, sector: 1, shield: true },
    1100,
  );
  applyAction(
    state,
    "b",
    { type: "choose", round: 1, sector: 1, shield: false },
    1200,
  );
  assert.deepEqual(
    state.players.map((p) => [p.score, p.shields]),
    [
      [15, 1],
      [0, 2],
    ],
  );
  assert.deepEqual(state.result.stormIds, [0, 1, 2]);
  assert.deepEqual(
    state.result.gains.map((g) => [g.share, g.gain, g.storm]),
    [
      [15, 15, true],
      [15, 0, true],
    ],
  );
  const calm = fixture();
  applyAction(
    calm,
    "a",
    { type: "choose", round: 1, sector: 0, shield: true },
    1100,
  );
  advanceClock(calm, 46000);
  assert.equal(calm.players[0].shields, 1);
});

test("a timed-out player earns zero, never dilutes a chosen sector, and late picks fail", () => {
  const state = fixture();
  applyAction(
    state,
    "a",
    { type: "choose", round: 1, sector: 2, shield: false },
    1100,
  );
  assert.equal(advanceClock(state, 45999), false);
  assert.equal(advanceClock(state, 46000), true);
  assert.equal(state.players[0].score, 36);
  assert.deepEqual(state.result.gains[1], {
    playerId: "b",
    sectorId: null,
    shield: false,
    gain: 0,
    storm: false,
    share: 0,
  });
  assert.throws(
    () =>
      applyAction(
        state,
        "b",
        { type: "choose", round: 1, sector: 0, shield: false },
        46001,
      ),
    /no longer/,
  );
  assert.equal(advanceClock(state, 47000), false);
  assert.equal(state.history.length, 1);
});

test("public snapshots reveal lock status but never secret picks, hashes or future storms", () => {
  const state = fixture(() => 0.123456789);
  applyAction(
    state,
    "a",
    { type: "choose", round: 1, sector: 2, shield: true },
    1100,
  );
  const visible = publicRoom(state, "b", 3, 1100);
  assert.equal(visible.players[0].locked, true);
  assert.equal(visible.result, null);
  const serialized = JSON.stringify(visible);
  for (const secret of [
    "hash-a",
    "hash-b",
    "stormRolls",
    "choices",
    "tokenHash",
    "0.123456789",
  ])
    assert.ok(!serialized.includes(secret));
  assert.ok(!Object.hasOwn(visible.players[0], "sector"));
  assert.equal(
    visible.players[0].shields,
    2,
    "shield decision stays private until resolution",
  );
});

test("six rounds finish; any active player can continue after reveal; rematch resets all counters", () => {
  const state = fixture();
  let now = 1100;
  for (let round = 1; round <= 6; round++) {
    if (round > 1) {
      assert.throws(
        () => applyAction(state, "b", { type: "continue" }, now - 1),
        /moment/,
      );
      now += 2000;
      applyAction(state, "b", { type: "continue" }, now);
    }
    applyAction(
      state,
      "a",
      { type: "choose", round, sector: 0, shield: round <= 2 },
      now,
    );
    applyAction(
      state,
      "b",
      { type: "choose", round, sector: 2, shield: false },
      now,
    );
  }
  assert.equal(state.phase, "finished");
  assert.equal(state.round, 6);
  assert.equal(state.history.length, 6);
  assert.equal(state.players[0].shields, 0);
  const expectedA = [24, 28, 32, 36, 40, 44].reduce((a, b) => a + b, 0);
  assert.equal(state.players[0].score, expectedA);
  applyAction(state, "b", { type: "rematch" }, now + 1, () => 0.01);
  assert.equal(state.phase, "lobby");
  assert.equal(state.round, 0);
  assert.deepEqual(
    state.players.map((p) => [p.score, p.shields, p.ready]),
    [
      [0, 2, true],
      [0, 2, false],
    ],
  );
  assert.deepEqual(state.history, []);
  assert.equal(state.stormRolls[0][0], 0.01);
});

test("departed players are not awaited; host transfers; single-player in-flight heist ends", () => {
  const state = fixture();
  // Add a third player before starting through a separate lobby fixture.
  state.phase = "lobby";
  state.round = 0;
  state.deadline = null;
  addPlayer(state, { id: "c", name: "Cinder", tokenHash: "hash-c" });
  applyAction(state, "c", { type: "ready", ready: true }, 1100);
  applyAction(state, "a", { type: "start" }, 1100);
  applyAction(
    state,
    "b",
    { type: "choose", round: 1, sector: 0, shield: false },
    1200,
  );
  applyAction(
    state,
    "c",
    { type: "choose", round: 1, sector: 1, shield: false },
    1200,
  );
  applyAction(state, "a", { type: "leave" }, 1300);
  assert.equal(state.hostId, "b");
  assert.equal(state.phase, "reveal");
  assert.equal(state.players.find((p) => p.id === "b").score, 24);
  applyAction(state, "b", { type: "continue" }, 3300);
  applyAction(state, "c", { type: "leave" }, 3400);
  assert.equal(state.phase, "finished");
  assert.ok(state.finishReason.includes("two active"));
  assert.throws(
    () => applyAction(state, "c", { type: "rematch" }, 3400),
    /left this crew/,
  );
});

test("lobby constraints, clean names, input validation and stale rounds are enforced", () => {
  assert.equal(cleanName("  N\u0000ova   X "), "Nova X");
  for (const name of ["", " ".repeat(10), "x".repeat(19), null])
    assert.throws(() => cleanName(name));
  const state = fixture();
  for (const sector of [-1, 3, 0.5, "1", null])
    assert.throws(() =>
      applyAction(
        state,
        "a",
        { type: "choose", round: 1, sector, shield: false },
        1100,
      ),
    );
  assert.throws(
    () =>
      applyAction(
        state,
        "a",
        { type: "choose", round: 0, sector: 0, shield: false },
        1100,
      ),
    /round changed/,
  );
  assert.throws(
    () =>
      applyAction(
        state,
        "a",
        { type: "choose", round: 1, sector: 0, shield: "yes" },
        1100,
      ),
    /Shield must/,
  );
  state.players[0].shields = 0;
  assert.throws(
    () =>
      applyAction(
        state,
        "a",
        { type: "choose", round: 1, sector: 0, shield: true },
        1100,
      ),
    /no shields/,
  );
  assert.throws(
    () => addPlayer(state, { id: "c", name: "C", tokenHash: "h" }),
    /already launched/,
  );
  assert.equal(sectorsForRound(6)[2].pool, 56);
});

test("an emptied lobby can be revived with a fresh automatically ready host", () => {
  const state = createGame({
    code: "ABC234",
    name: "Nova",
    id: "a",
    tokenHash: "hash-a",
    now: 1000,
    random: () => 0.99,
  });
  applyAction(state, "a", { type: "leave" }, 1001);
  assert.equal(state.hostId, null);
  addPlayer(state, { id: "b", name: "Orbit", tokenHash: "hash-b" });
  addPlayer(state, { id: "c", name: "Cinder", tokenHash: "hash-c" });
  assert.equal(state.hostId, "b");
  assert.equal(state.players.find((p) => p.id === "b").ready, true);
  applyAction(state, "c", { type: "ready", ready: true }, 1002);
  applyAction(state, "b", { type: "start" }, 1003);
  assert.equal(state.phase, "choosing");
});

// Small asynchronous D1 double. Every read yields before its CAS update so simultaneous
// requests genuinely see the same revision; losing writes must retry with fresh state.
class FakeD1 {
  rows = new Map();
  updates = 0;
  conflicts = 0;
  prepare(sql) {
    const db = this;
    return {
      bind(...args) {
        return {
          async first() {
            const row = db.rows.get(args[0]);
            const snapshot = row ? structuredClone(row) : null;
            await new Promise((resolve) => setImmediate(resolve));
            return snapshot;
          },
          async run() {
            await new Promise((resolve) => setImmediate(resolve));
            if (sql.startsWith("INSERT")) {
              const [code, state, expires_at] = args;
              if (db.rows.has(code)) return { meta: { changes: 0 } };
              db.rows.set(code, { state, revision: 0, expires_at });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith("UPDATE")) {
              const [state, code, revision, now] = args;
              const current = db.rows.get(code);
              if (
                !current ||
                current.revision !== revision ||
                current.expires_at <= now
              ) {
                db.conflicts++;
                return { meta: { changes: 0 } };
              }
              current.state = state;
              current.revision++;
              db.updates++;
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith("DELETE")) {
              if (sql.includes("code =")) {
                const row = db.rows.get(args[0]);
                if (row && row.expires_at <= args[1]) db.rows.delete(args[0]);
              } else
                for (const [code, row] of db.rows)
                  if (row.expires_at <= args[0]) db.rows.delete(code);
              return { meta: { changes: 1 } };
            }
            throw new Error(`Unsupported fake statement: ${sql}`);
          },
        };
      },
    };
  }
}

function apiRequest(path, body, token, method) {
  return new Request(`https://orbit.example/api/rooms${path}`, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { "x-player-token": token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function apiFixture() {
  const db = new FakeD1();
  let now = 1000;
  let seq = 0;
  const options = {
    clock: () => now,
    makeCode: () => "ABC234",
    makeId: () => `p${++seq}`,
    random: () => 0.99,
  };
  const api = (path, body, token, method) =>
    handleRoomsApi(apiRequest(path, body, token, method), db, options);
  const a = await (await api("", { name: "Nova" })).json();
  const b = await (await api("/ABC234/join", { name: "Orbit" })).json();
  return {
    db,
    api,
    a,
    b,
    options,
    setTime: (value) => {
      now = value;
    },
  };
}

test("API returns pass only at creation/join; storage contains hash only; authentication is mandatory", async () => {
  const { db, api, a, b } = await apiFixture();
  assert.match(a.playerToken, /^[a-f0-9]{64}$/);
  assert.notEqual(a.playerToken, b.playerToken);
  const raw = db.rows.get("ABC234").state;
  assert.ok(!raw.includes(a.playerToken));
  assert.ok(raw.includes(await hashToken(a.playerToken)));
  assert.equal((await api("/ABC234")).status, 401);
  assert.equal((await api("/ABC234", null, "f".repeat(64))).status, 401);
  const result = await (await api("/abc234", null, a.playerToken)).json();
  assert.equal(result.room.youId, a.room.youId);
  assert.ok(!Object.hasOwn(result, "playerToken"));
  assert.ok(!JSON.stringify(result).includes("tokenHash"));
});

test("concurrent ready actions preserve both writes through CAS retries", async () => {
  const { db, api, a, b } = await apiFixture();
  const c = await (await api("/ABC234/join", { name: "Cinder" })).json();
  const responses = await Promise.all([
    api("/ABC234/action", { type: "ready", ready: true }, b.playerToken),
    api("/ABC234/action", { type: "ready", ready: true }, c.playerToken),
  ]);
  assert.ok(responses.every((r) => r.status === 200));
  const snapshot = await (await api("/ABC234", null, a.playerToken)).json();
  assert.ok(snapshot.room.players.every((p) => p.ready));
  assert.ok(
    db.conflicts > 0,
    "test exercised a real compare-and-swap conflict",
  );
  assert.equal(
    (await api("/ABC234/action", { type: "start" }, a.playerToken)).status,
    200,
  );
});

test("concurrent last picks produce exactly one result with both choices counted", async () => {
  const { api, a, b } = await apiFixture();
  await api("/ABC234/action", { type: "ready", ready: true }, b.playerToken);
  await api("/ABC234/action", { type: "start" }, a.playerToken);
  const responses = await Promise.all([
    api(
      "/ABC234/action",
      { type: "choose", round: 1, sector: 2, shield: false },
      a.playerToken,
    ),
    api(
      "/ABC234/action",
      { type: "choose", round: 1, sector: 2, shield: false },
      b.playerToken,
    ),
  ]);
  assert.ok(responses.every((r) => r.status === 200));
  const { room } = await (await api("/ABC234", null, a.playerToken)).json();
  assert.equal(room.phase, "reveal");
  assert.deepEqual(
    room.players.map((p) => p.score),
    [18, 18],
  );
  assert.equal(room.history.length, 1);
});

test("API commits server deadline even when the triggering action is rejected as late", async () => {
  const { api, a, b, setTime } = await apiFixture();
  await api("/ABC234/action", { type: "ready", ready: true }, b.playerToken);
  await api("/ABC234/action", { type: "start" }, a.playerToken);
  await api(
    "/ABC234/action",
    { type: "choose", round: 1, sector: 1, shield: false },
    a.playerToken,
  );
  setTime(46000);
  const late = await api(
    "/ABC234/action",
    { type: "choose", round: 1, sector: 2, shield: false },
    b.playerToken,
  );
  assert.equal(late.status, 409);
  const { room } = await (await api("/ABC234", null, a.playerToken)).json();
  assert.equal(room.phase, "reveal");
  assert.equal(room.players[0].score, 30);
  assert.equal(room.players[1].score, 0);
});

test("body limit is enforced without a content-length header and malformed/expired rooms fail cleanly", async () => {
  const { db, api, a, options, setTime } = await apiFixture();
  const tooLarge = new Request("https://orbit.example/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "x".repeat(3000) }),
  });
  assert.equal((await handleRoomsApi(tooLarge, db, options)).status, 413);
  assert.equal((await api("/BAD")).status, 404);
  assert.equal((await api("/NOPE23", null, a.playerToken)).status, 404);
  setTime(1000 + ROOM_TTL_MS);
  assert.equal((await api("/ABC234", null, a.playerToken)).status, 404);
  assert.ok(!db.rows.has("ABC234"));
});

test("six-player capacity cannot be overfilled by concurrent joins", async () => {
  const { api, a } = await apiFixture();
  const responses = await Promise.all(
    Array.from({ length: 7 }, (_, i) =>
      api("/ABC234/join", { name: `Crew${i}` }),
    ),
  );
  assert.equal(responses.filter((r) => r.status === 201).length, 4);
  assert.equal(responses.filter((r) => r.status === 409).length, 3);
  const { room } = await (await api("/ABC234", null, a.playerToken)).json();
  assert.equal(room.players.filter((p) => p.active).length, 6);
  assert.equal(new Set(room.players.map((p) => p.color)).size, 6);
});

test("expired row cannot be revived by an in-flight stale CAS write", async () => {
  const db = new FakeD1();
  const store = createRoomStore(db);
  const state = createGame({
    code: "ABC234",
    name: "Nova",
    id: "a",
    tokenHash: "x",
    now: 0,
    random: () => 0.5,
  });
  await store.insert(state);
  await assert.rejects(
    () =>
      store.mutate(
        "ABC234",
        () => true,
        () => ROOM_TTL_MS,
      ),
    /expired/,
  );
  assert.ok(!db.rows.has("ABC234"));
});
