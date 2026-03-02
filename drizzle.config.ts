import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema/**/*.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.CATNOVEL_DB_PATH ?? "./data/catnovel.db",
  },
  verbose: true,
  strict: true,
});
