import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

const base = process.argv[2];
if (!base || !/^https?:\/\//.test(base))
  throw new Error("Provide the developer preview base URL.");
const results = [];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function api(path, body, token) {
  const res = await fetch(`${base.replace(/\/$/, "")}/api/rooms${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { "x-player-token": token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response ${res.status}: ${text.slice(0, 120)}`);
  }
  return { status: res.status, json, headers: res.headers };
}
function checkSecretBoundary(room) {
  for (const key of ["choices", "stormRolls", "playerToken", "tokenHash"])
    assert.ok(!JSON.stringify(room).includes(`"${key}"`));
  for (const p of room.players)
    assert.deepEqual(
      Object.keys(p).sort(),
      [
        "active",
        "color",
        "id",
        "locked",
        "name",
        "ready",
        "score",
        "shields",
      ].sort(),
    );
}
const a = await api("", { name: "QA Nova" });
assert.equal(a.status, 201);
const code = a.json.room.code;
const at = a.json.playerToken;
const b = await api(`/${code}/join`, { name: "QA Ember" });
assert.equal(b.status, 201);
const bt = b.json.playerToken;
assert.notEqual(at, bt);
const act = (body, token = at) => api(`/${code}/action`, body, token);
const read = (token = at) => api(`/${code}`, null, token);
assert.equal((await act({ type: "start" })).status, 409);
assert.equal((await act({ type: "start" }, bt)).status, 403);
assert.equal((await read()).headers.get("cache-control"), "no-store");
assert.equal((await api(`/${code}`)).status, 401);
assert.equal((await read("f".repeat(64))).status, 401);
assert.equal(
  (await act({ type: "ready", ready: true }, "f".repeat(64))).status,
  401,
);
results.push(
  "Authenticated room snapshots, forged-token rejection, readiness and host authority passed.",
);

await act({ type: "ready", ready: true }, bt);
const launches = await Promise.all([
  act({ type: "start" }),
  act({ type: "start" }),
]);
assert.deepEqual(launches.map((r) => r.status).sort(), [200, 409]);
assert.equal((await api(`/${code}/join`, { name: "Late join" })).status, 409);
let last = (await read()).json.room;
assert.equal(last.phase, "choosing");
assert.equal(last.round, 1);
for (let round = 1; round <= 6; round++) {
  assert.equal(
    (await act({ type: "choose", round: round - 1, sector: 0, shield: false }))
      .status,
    409,
  );
  assert.equal(
    (await act({ type: "choose", round, sector: -1, shield: false })).status,
    400,
  );
  assert.equal(
    (await act({ type: "choose", round, sector: 0, shield: "true" })).status,
    400,
  );
  const shield = round <= 2;
  const first = await act({ type: "choose", round, sector: 2, shield });
  assert.equal(first.status, 200);
  assert.equal(first.json.room.result, null);
  assert.equal(
    first.json.room.players.find((p) => p.id === a.json.room.youId).shields,
    2 - Math.min(round - 1, 2),
  );
  checkSecretBoundary(first.json.room);
  const peer = (await read(bt)).json.room;
  checkSecretBoundary(peer);
  assert.equal(peer.youId, b.json.room.youId);
  assert.equal(
    peer.players.find((p) => p.id === a.json.room.youId).locked,
    true,
  );
  assert.equal(peer.result, null);
  assert.equal(
    (await act({ type: "choose", round, sector: 0, shield: false })).status,
    409,
  );
  const end = await act({ type: "choose", round, sector: 2, shield }, bt);
  assert.equal(end.status, 200);
  last = end.json.room;
  assert.equal(last.history.length, round);
  assert.equal(last.phase, round === 6 ? "finished" : "reveal");
  assert.deepEqual(
    last.result.gains.map((g) => g.share),
    [
      Math.floor((36 + (round - 1) * 4) / 2),
      Math.floor((36 + (round - 1) * 4) / 2),
    ],
  );
  assert.deepEqual(
    last.players.map((p) => p.shields),
    [2 - Math.min(round, 2), 2 - Math.min(round, 2)],
  );
  for (const p of last.players) {
    assert.equal(
      p.score,
      last.history
        .flatMap((r) => r.gains)
        .filter((g) => g.playerId === p.id)
        .reduce((sum, g) => sum + g.gain, 0),
    );
  }
  checkSecretBoundary(last);
  if (round < 6) {
    assert.equal((await act({ type: "continue" }, bt)).status, 409);
    await wait(2100);
    const nexts = await Promise.all([
      act({ type: "continue" }),
      act({ type: "continue" }, bt),
    ]);
    assert.deepEqual(nexts.map((r) => r.status).sort(), [200, 409]);
    const reloaded = (await read()).json.room;
    assert.equal(reloaded.round, round + 1);
    assert.equal(reloaded.phase, "choosing");
    assert.equal(reloaded.result, null);
  }
}
results.push(
  "Two independent tokens completed all six rounds; private picks, stale/invalid actions, duplicate picks, exact share arithmetic, reload and concurrent continues passed.",
);
assert.equal((await act({ type: "rematch" }, bt)).status, 200);
last = (await read()).json.room;
assert.equal(last.phase, "lobby");
assert.equal(last.round, 0);
assert.equal(last.history.length, 0);
assert.deepEqual(
  last.players.map((p) => [p.score, p.shields]),
  [
    [0, 2],
    [0, 2],
  ],
);
assert.equal(last.players.find((p) => p.id === last.hostId).ready, true);
assert.equal(last.players.find((p) => p.id !== last.hostId).ready, false);
results.push("Rematch state reset and readiness passed.");

const cap = await api("", { name: "Capacity host" });
const capCode = cap.json.room.code;
const joins = await Promise.all(
  Array.from({ length: 8 }, (_, i) =>
    api(`/${capCode}/join`, { name: `Crew ${i}` }),
  ),
);
assert.equal(joins.filter((r) => r.status === 201).length, 5);
assert.equal(joins.filter((r) => r.status === 409).length, 3);
const capRoom = (await api(`/${capCode}`, null, cap.json.playerToken)).json
  .room;
assert.equal(capRoom.players.filter((p) => p.active).length, 6);
assert.equal(new Set(capRoom.players.map((p) => p.color)).size, 6);
results.push(
  "Concurrent joins enforce six-player capacity with no lost member or duplicate color.",
);

const empty = await api("", { name: "Former host" });
const emptyCode = empty.json.room.code;
assert.equal(
  (await api(`/${emptyCode}/action`, { type: "leave" }, empty.json.playerToken))
    .status,
  200,
);
const newHost = await api(`/${emptyCode}/join`, { name: "New host" });
const guest = await api(`/${emptyCode}/join`, { name: "New guest" });
assert.equal(newHost.json.room.hostId, newHost.json.room.youId);
assert.equal(
  newHost.json.room.players.find((p) => p.id === newHost.json.room.youId).ready,
  true,
);
await api(
  `/${emptyCode}/action`,
  { type: "ready", ready: true },
  guest.json.playerToken,
);
assert.equal(
  (
    await api(
      `/${emptyCode}/action`,
      { type: "start" },
      newHost.json.playerToken,
    )
  ).status,
  200,
);
results.push(
  "Previously reported empty-lobby host recovery is fixed through the real HTTP API.",
);

const evidence = {
  passed: true,
  testedAt: new Date().toISOString(),
  base,
  checks: results,
};
await writeFile(
  new URL("./http-smoke-result.json", import.meta.url),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
console.log(JSON.stringify(evidence, null, 2));
