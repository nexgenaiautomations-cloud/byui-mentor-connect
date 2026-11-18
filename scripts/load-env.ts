// Side-effect module: load environment variables for operator scripts.
//
// IMPORT THIS FIRST, before anything that reads process.env at module scope
// (notably `src/db/client.ts`, which captures DATABASE_URL on load). ES
// module imports are evaluated in order and all of them run before the
// importing module's own top-level statements — so calling dotenv as a
// function in the script body is too late, and the db client will already
// have fallen back to its build-time placeholder URL. The symptom is an
// opaque `TypeError: fetch failed`, not a missing-variable error.
//
// Precedence matches Next.js: `.env.local` wins over `.env`. Plain
// `import "dotenv/config"` reads only `.env`, which this repo does not have.
import { config } from "dotenv";

config({ path: ".env.local" });
config(); // .env, if present; dotenv does not override already-set vars
