import type { Config } from "drizzle-kit";

// Schema migrations require DDL privileges (CREATE TABLE, ALTER, etc.) that
// the runtime `app_user` role intentionally lacks. We prefer
// DATABASE_URL_OWNER (the neondb_owner connection string) for drizzle-kit
// and fall back to DATABASE_URL for environments that still use a single
// privileged URL.
const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: url! },
} satisfies Config;
