import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const secretStore = sqliteTable(
  "secret_store",
  {
    id: text("id").primaryKey(),
    ciphertext: text("ciphertext").notNull(),
    nonce: text("nonce").notNull(),
    tag: text("tag").notNull(),
    keyVersion: integer("key_version").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    keyVersionIdx: index("secret_store_key_version_idx").on(table.keyVersion),
  }),
);

export type SecretStoreRow = typeof secretStore.$inferSelect;
export type NewSecretStoreRow = typeof secretStore.$inferInsert;
