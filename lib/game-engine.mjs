export const TOTAL_ROUNDS = 6;
export const ROUND_MS = 45_000;
export const REVEAL_MS = 2_000;
export const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
export const COLORS = [
  "#63e6ff",
  "#ffb76b",
  "#bb9aff",
  "#77efba",
  "#ff83af",
  "#ffe27b",
];

export class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function cleanName(value) {
  if (typeof value !== "string") throw new GameError("Choose a crew name.");
  const name = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < 1 || name.length > 18)
    throw new GameError("Crew names must be 1–18 characters.");
  return name;
}

export function secureRoll() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}

export function generateStorms(random = secureRoll) {
  // Kept strictly server-side. Each rematch receives a fresh independent storm field.
  return Array.from({ length: TOTAL_ROUNDS }, () =>
    Array.from({ length: 3 }, () => random()),
  );
}

export function sectorsForRound(round) {
  const level = Math.max(1, Math.min(TOTAL_ROUNDS, round));
  const growth = (level - 1) * 4;
  const surge = [0, 0.02, 0.04, -0.02, 0.03, 0.06][level - 1];
  return [
    {
      id: 0,
      name: "Azure Belt",
      pool: 24 + growth,
      risk: Number((0.1 + surge).toFixed(2)),
      flavor: "A steady route through blue ice. Smaller haul, gentler storms.",
    },
    {
      id: 1,
      name: "Ember Ring",
      pool: 30 + growth,
      risk: Number((0.25 + surge).toFixed(2)),
      flavor: "Rich salvage drifts beside a volatile orange star.",
    },
    {
      id: 2,
      name: "Violet Rift",
      pool: 36 + growth,
      risk: Number((0.4 + surge).toFixed(2)),
      flavor: "The richest wrecks lie beyond an unstable gravity seam.",
    },
  ];
}

function makePlayer(id, name, tokenHash, color, host = false) {
  return {
    id,
    name: cleanName(name),
    tokenHash,
    color,
    score: 0,
    shields: 2,
    ready: host,
    active: true,
  };
}

export function createGame({
  code,
  name,
  id,
  tokenHash,
  now,
  random = secureRoll,
}) {
  return {
    code,
    phase: "lobby",
    round: 0,
    hostId: id,
    createdAt: now,
    expiresAt: now + ROOM_TTL_MS,
    deadline: null,
    revealAt: null,
    players: [makePlayer(id, name, tokenHash, COLORS[0], true)],
    choices: {},
    stormRolls: generateStorms(random),
    result: null,
    history: [],
  };
}

export function addPlayer(state, { id, name, tokenHash }) {
  if (state.phase !== "lobby")
    throw new GameError(
      "This heist has already launched. Join the next lobby.",
      409,
    );
  const active = state.players.filter((p) => p.active);
  if (active.length >= 6)
    throw new GameError("This crew is full (6 players).", 409);
  if (state.players.length >= 30)
    throw new GameError(
      "This room has reached its join limit. Create a fresh room.",
      409,
    );
  const color =
    COLORS.find((c) => !active.some((p) => p.color === c)) || COLORS[0];
  const hostMissing = !active.some((p) => p.id === state.hostId);
  state.players.push(makePlayer(id, name, tokenHash, color, hostMissing));
  if (hostMissing) state.hostId = id;
}

export function authenticate(state, tokenHash) {
  const player = state.players.find((p) => p.tokenHash === tokenHash);
  if (!player)
    throw new GameError(
      "Your crew pass is missing or invalid. Rejoin from the lobby.",
      401,
    );
  return player;
}

function activePlayers(state) {
  return state.players.filter((p) => p.active);
}

function beginRound(state, now) {
  state.round += 1;
  state.phase = "choosing";
  state.deadline = now + ROUND_MS;
  state.revealAt = null;
  state.choices = {};
  state.result = null;
}

function finishIfAlone(state) {
  if (
    state.phase !== "lobby" &&
    state.phase !== "finished" &&
    activePlayers(state).length < 2
  ) {
    state.phase = "finished";
    state.deadline = null;
    state.finishReason =
      "The crew fell below two active players. Start a rematch or create a new room.";
    return true;
  }
  return false;
}

export function resolveRound(state, now) {
  if (state.phase !== "choosing") return false;
  const sectors = sectorsForRound(state.round);
  const active = activePlayers(state);
  const stormIds = sectors
    .filter((s) => state.stormRolls[state.round - 1][s.id] < s.risk)
    .map((s) => s.id);
  const gains = active.map((player) => {
    const choice = state.choices[player.id];
    if (!choice)
      return {
        playerId: player.id,
        sectorId: null,
        shield: false,
        gain: 0,
        storm: false,
        share: 0,
      };
    const occupants = active.filter(
      (p) => state.choices[p.id]?.sector === choice.sector,
    ).length;
    const share = Math.floor(sectors[choice.sector].pool / occupants);
    const storm = stormIds.includes(choice.sector);
    const gain = storm && !choice.shield ? 0 : share;
    player.score += gain;
    if (choice.shield) player.shields -= 1;
    return {
      playerId: player.id,
      sectorId: choice.sector,
      shield: choice.shield,
      gain,
      storm,
      share,
    };
  });
  state.result = { round: state.round, stormIds, gains };
  state.history.push(state.result);
  state.phase = state.round === TOTAL_ROUNDS ? "finished" : "reveal";
  state.revealAt = now;
  state.deadline = null;
  // A resolved round must never retain private picks outside its public result.
  state.choices = {};
  return true;
}

export function advanceClock(state, now) {
  if (finishIfAlone(state)) return true;
  if (state.phase === "choosing" && now >= state.deadline)
    return resolveRound(state, now);
  return false;
}

export function applyAction(state, playerId, action, now, random = secureRoll) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player?.active)
    throw new GameError(
      "You have left this crew. Join a lobby to play again.",
      403,
    );
  if (!action || typeof action !== "object" || Array.isArray(action))
    throw new GameError("Invalid action.");
  const active = activePlayers(state);
  switch (action.type) {
    case "ready": {
      if (state.phase !== "lobby")
        throw new GameError(
          "Ready checks are only available in the lobby.",
          409,
        );
      if (typeof action.ready !== "boolean")
        throw new GameError("Ready must be true or false.");
      player.ready = player.id === state.hostId ? true : action.ready;
      return true;
    }
    case "start": {
      if (player.id !== state.hostId)
        throw new GameError("Only the host can launch this heist.", 403);
      if (state.phase !== "lobby")
        throw new GameError("This heist has already launched.", 409);
      if (active.length < 2 || !active.every((p) => p.ready))
        throw new GameError("At least two players must be ready.", 409);
      beginRound(state, now);
      return true;
    }
    case "choose": {
      if (state.phase !== "choosing")
        throw new GameError("This round is no longer accepting picks.", 409);
      if (!Number.isInteger(action.round) || action.round !== state.round)
        throw new GameError("Your round changed. Refresh your crew view.", 409);
      if (now >= state.deadline)
        throw new GameError("The round deadline has passed.", 409);
      if (
        !Number.isInteger(action.sector) ||
        action.sector < 0 ||
        action.sector > 2
      )
        throw new GameError("Choose one of the three sectors.");
      if (typeof action.shield !== "boolean")
        throw new GameError("Shield must be true or false.");
      if (state.choices[player.id])
        throw new GameError("Your pick is already locked for this round.", 409);
      if (action.shield && player.shields < 1)
        throw new GameError("You have no shields remaining.", 409);
      state.choices[player.id] = {
        sector: action.sector,
        shield: action.shield,
      };
      if (active.every((p) => state.choices[p.id])) resolveRound(state, now);
      return true;
    }
    case "continue": {
      if (state.phase !== "reveal")
        throw new GameError("There is no next round to launch yet.", 409);
      if (now - state.revealAt < REVEAL_MS)
        throw new GameError("Take a moment to review the round result.", 409);
      if (active.length < 2)
        throw new GameError("Two active crew members are required.", 409);
      beginRound(state, now);
      return true;
    }
    case "rematch": {
      if (state.phase !== "finished")
        throw new GameError("Finish the current heist before a rematch.", 409);
      state.phase = "lobby";
      state.round = 0;
      state.deadline = null;
      state.revealAt = null;
      state.choices = {};
      state.result = null;
      state.history = [];
      delete state.finishReason;
      state.stormRolls = generateStorms(random);
      // Departed players do not occupy slots in a new heist.
      state.players = active;
      if (!active.some((p) => p.id === state.hostId))
        state.hostId = active[0].id;
      for (const p of state.players) {
        p.score = 0;
        p.shields = 2;
        p.ready = p.id === state.hostId;
      }
      return true;
    }
    case "leave": {
      player.active = false;
      player.ready = false;
      delete state.choices[player.id];
      const remaining = activePlayers(state);
      if (state.hostId === player.id) {
        state.hostId = remaining[0]?.id || null;
        if (remaining[0] && state.phase === "lobby") remaining[0].ready = true;
      }
      if (
        !finishIfAlone(state) &&
        state.phase === "choosing" &&
        remaining.every((p) => state.choices[p.id])
      )
        resolveRound(state, now);
      return true;
    }
    default:
      throw new GameError("Unknown crew action.");
  }
}

export function publicRoom(state, youId, revision, now) {
  // Explicit allow-list: no tokens/hashes, hidden storm field, or private picks can leak.
  return {
    code: state.code,
    phase: state.phase,
    round: state.round,
    totalRounds: TOTAL_ROUNDS,
    deadline: state.deadline,
    serverNow: now,
    hostId: state.hostId,
    youId,
    revision,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      score: p.score,
      shields: p.shields,
      ready: p.ready,
      locked: Boolean(state.choices[p.id]),
      active: p.active,
    })),
    sectors: sectorsForRound(state.round),
    result: state.result,
    history: state.history,
    ...(state.finishReason ? { finishReason: state.finishReason } : {}),
  };
}
