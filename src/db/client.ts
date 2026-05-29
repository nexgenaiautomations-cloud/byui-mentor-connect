import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "postgres://placeholder@build/db";
const sql = neon(url);
export const db = drizzle(sql, { schema });
export { schema };
