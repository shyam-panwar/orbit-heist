import { GameError, ROOM_TTL_MS } from "./game-engine.mjs";

export function createRoomStore(db) {
  if (!db)
    throw new GameError(
      "Mission control is warming up. Please try again shortly.",
      503,
    );
  return {
    async insert(state) {
      const result = await db
        .prepare(
          "INSERT INTO game_rooms (code, state, revision, expires_at) VALUES (?, ?, 0, ?) ON CONFLICT(code) DO NOTHING",
        )
        .bind(state.code, JSON.stringify(state), state.expiresAt)
        .run();
      return Number(result.meta?.changes ?? 0) === 1;
    },
    async read(code, now) {
      const row = await db
        .prepare(
          "SELECT state, revision, expires_at FROM game_rooms WHERE code = ?",
        )
        .bind(code)
        .first();
      if (!row || row.expires_at <= now) {
        if (row)
          await db
            .prepare(
              "DELETE FROM game_rooms WHERE code = ? AND expires_at <= ?",
            )
            .bind(code, now)
            .run();
        throw new GameError(
          "Crew not found or expired. Rooms stay open for two hours.",
          404,
        );
      }
      let state;
      try {
        state = JSON.parse(row.state);
      } catch {
        throw new GameError(
          "This room could not be loaded. Please create a new crew.",
          500,
        );
      }
      return { state, revision: row.revision };
    },
    async mutate(code, mutate, clock = Date.now) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const now = clock();
        const { state, revision } = await this.read(code, now);
        const changed = await mutate(state, now);
        if (!changed) return { state, revision, now };
        const result = await db
          .prepare(
            "UPDATE game_rooms SET state = ?, revision = revision + 1 WHERE code = ? AND revision = ? AND expires_at > ?",
          )
          .bind(JSON.stringify(state), code, revision, now)
          .run();
        if (Number(result.meta?.changes ?? 0) === 1)
          return { state, revision: revision + 1, now };
      }
      throw new GameError(
        "Your crew is busy syncing. Please retry your action.",
        409,
      );
    },
    async sweep(now) {
      // Bound cleanup by age; individual reads also enforce expiry independently.
      await db
        .prepare("DELETE FROM game_rooms WHERE expires_at <= ?")
        .bind(now - ROOM_TTL_MS)
        .run();
    },
  };
}
