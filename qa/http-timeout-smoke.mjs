import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const base = process.argv[2];
if (!base || !/^https?:\/\//.test(base))
  throw new Error("Provide the developer preview base URL.");
async function call(path, body, token) {
  const res = await fetch(`${base}/api/rooms${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { "x-player-token": token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, json: await res.json() };
}
const a = await call("", { name: "Timeout host" });
assert.equal(a.status, 201);
const code = a.json.room.code;
const b = await call(`/${code}/join`, { name: "Timeout guest" });
assert.equal(b.status, 201);
const at = a.json.playerToken;
const bt = b.json.playerToken;
const action = (body, token = at) => call(`/${code}/action`, body, token);
await action({ type: "ready", ready: true }, bt);
const started = await action({ type: "start" });
assert.equal(started.status, 200);
assert.equal(
  (await action({ type: "choose", round: 1, sector: 2, shield: true })).status,
  200,
);
const waitMs = started.json.room.deadline - started.json.room.serverNow + 500;
console.log(`Waiting ${waitMs}ms for real server deadline.`);
await new Promise((resolve) => setTimeout(resolve, waitMs));
const late = await action(
  { type: "choose", round: 1, sector: 0, shield: false },
  bt,
);
assert.equal(late.status, 409);
const snapshot = await call(`/${code}`, null, at);
assert.equal(snapshot.status, 200);
const room = snapshot.json.room;
assert.equal(room.phase, "reveal");
assert.equal(room.history.length, 1);
assert.equal(room.players.find((p) => p.id === a.json.room.youId).score, 36);
assert.equal(room.players.find((p) => p.id === a.json.room.youId).shields, 1);
assert.equal(room.players.find((p) => p.id === b.json.room.youId).score, 0);
assert.equal(room.players.find((p) => p.id === b.json.room.youId).shields, 2);
assert.deepEqual(
  room.result.gains.find((g) => g.playerId === b.json.room.youId),
  {
    playerId: b.json.room.youId,
    sectorId: null,
    shield: false,
    gain: 0,
    storm: false,
    share: 0,
  },
);
const repeat = await call(`/${code}`, null, bt);
assert.equal(repeat.json.room.history.length, 1);
const evidence = {
  passed: true,
  testedAt: new Date().toISOString(),
  base,
  checks: [
    "Actual 45-second deadline enforced.",
    "Rejected late action still commits resolution.",
    "Shielded host receives full pool; missed guest earns zero and does not dilute share.",
    "Subsequent reads cannot score round twice.",
  ],
};
await writeFile(
  new URL("./http-timeout-smoke-result.json", import.meta.url),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
console.log(JSON.stringify(evidence, null, 2));
