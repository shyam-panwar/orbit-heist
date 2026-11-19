import {
  GameError,
  createGame,
  addPlayer,
  authenticate,
  advanceClock,
  applyAction,
  publicRoom,
} from "./game-engine.mjs";
import { createRoomStore } from "./room-store.mjs";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_BODY_BYTES = 2048;

export async function hashToken(token) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function newToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function newCode() {
  return [...crypto.getRandomValues(new Uint8Array(6))]
    .map((n) => CODE_ALPHABET[n % CODE_ALPHABET.length])
    .join("");
}

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function readBody(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json"))
    throw new GameError("Send this action as JSON.", 415);
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES)
    throw new GameError("This request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new GameError("Missing request body.");
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new GameError("This request is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new GameError("The request contains invalid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new GameError("The request must be a JSON object.");
  return parsed;
}

export async function handleRoomsApi(request, db, options = {}) {
  const clock = options.clock || Date.now;
  const makeCode = options.makeCode || newCode;
  const makeToken = options.makeToken || newToken;
  const makeId = options.makeId || (() => crypto.randomUUID());
  try {
    const path = new URL(request.url).pathname.replace(/\/$/, "");
    const match = path.match(
      /^\/api\/rooms(?:\/([A-Za-z0-9]{6})(?:\/(join|action))?)?$/,
    );
    if (!match) throw new GameError("Unknown mission-control route.", 404);
    const code = match[1]?.toUpperCase();
    const endpoint = match[2];
    const store = createRoomStore(db);
    if (!code) {
      if (request.method !== "POST")
        return response({ error: "Use POST to create a crew." }, 405);
      const body = await readBody(request);
      const token = makeToken();
      const tokenHash = await hashToken(token);
      const id = makeId();
      for (let attempt = 0; attempt < 8; attempt++) {
        const now = clock();
        const state = createGame({
          code: makeCode(),
          name: body.name,
          id,
          tokenHash,
          now,
          random: options.random,
        });
        if (await store.insert(state))
          return response(
            { room: publicRoom(state, id, 0, now), playerToken: token },
            201,
          );
      }
      throw new GameError("Could not allocate a crew code. Please retry.", 503);
    }
    if (endpoint === "join") {
      if (request.method !== "POST")
        return response({ error: "Use POST to join a crew." }, 405);
      const body = await readBody(request);
      const token = makeToken();
      const tokenHash = await hashToken(token);
      const id = makeId();
      const saved = await store.mutate(
        code,
        (state) => {
          addPlayer(state, { id, name: body.name, tokenHash });
          return true;
        },
        clock,
      );
      return response(
        {
          room: publicRoom(saved.state, id, saved.revision, saved.now),
          playerToken: token,
        },
        201,
      );
    }
    if (
      (!endpoint && request.method !== "GET") ||
      (endpoint === "action" && request.method !== "POST")
    )
      return response({ error: "Unsupported request method." }, 405);
    const token = request.headers.get("x-player-token");
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new GameError("A valid crew pass is required.", 401);
    const tokenHash = await hashToken(token);
    const body = endpoint === "action" ? await readBody(request) : null;
    // Expired deadlines are committed independently, even if a submitted action is stale.
    const tick = await store.mutate(
      code,
      (state, now) => {
        authenticate(state, tokenHash);
        return advanceClock(state, now);
      },
      clock,
    );
    if (!body) {
      const player = authenticate(tick.state, tokenHash);
      return response({
        room: publicRoom(tick.state, player.id, tick.revision, tick.now),
      });
    }
    let youId;
    const saved = await store.mutate(
      code,
      (state, now) => {
        const player = authenticate(state, tokenHash);
        youId = player.id;
        // Clock was advanced above, but a CAS retry can cross a deadline. Never accept a late pick.
        if (state.phase === "choosing" && now >= state.deadline)
          throw new GameError(
            "The round deadline has passed. Refresh your crew view.",
            409,
          );
        return applyAction(state, player.id, body, now, options.random);
      },
      clock,
    );
    return response({
      room: publicRoom(saved.state, youId, saved.revision, saved.now),
    });
  } catch (error) {
    if (error instanceof GameError)
      return response({ error: error.message }, error.status);
    console.error(
      "Orbit Heist mission-control error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return response(
      { error: "Mission control could not sync. Please retry in a moment." },
      500,
    );
  }
}
