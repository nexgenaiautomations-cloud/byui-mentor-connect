// Refuse to run browser tests unless the database is a seeded fixture DB.
// The sentinel is written only by scripts/seed-e2e.ts, which itself refuses
// to target the app's main database.
import { neon } from "@neondatabase/serverless";

export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) {
    throw new Error(
      "E2E_DATABASE_URL is not set. Point it at a disposable database and run scripts/seed-e2e.ts first (tests/e2e/README.md)."
    );
  }
  if (!process.env.E2E_PASSWORD) throw new Error("E2E_PASSWORD (the fixture accounts' password) is not set.");
  const sql = neon(url);
  const rows = (await sql(
    `select value_json from program_setting where school = '*' and key = 'e2e_fixture'`
  )) as { value_json: string }[];
  if (rows[0]?.value_json !== "true") {
    throw new Error("Refusing to run: the database has no e2e fixture sentinel. Run scripts/seed-e2e.ts against it.");
  }
}
