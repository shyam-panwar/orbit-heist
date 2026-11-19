import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const gameRooms = sqliteTable(
  "game_rooms",
  {
    code: text("code").primaryKey(),
    state: text("state").notNull(),
    revision: integer("revision").notNull().default(0),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("game_rooms_expiry_idx").on(table.expiresAt)],
);
