import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { programSettings } from "@/db/schema";
import {
  resolveRoi,
  resolveThresholds,
  SETTING_KEYS,
  type RoiAssumptions,
  type Thresholds,
} from "@/lib/program-settings";

async function layers(school: string | null, key: string): Promise<(string | null)[]> {
  const schools = school ? ["*", school] : ["*"];
  const rows = await db
    .select({ school: programSettings.school, valueJson: programSettings.valueJson })
    .from(programSettings)
    .where(and(eq(programSettings.key, key), inArray(programSettings.school, schools)));
  const by = new Map(rows.map((r) => [r.school, r.valueJson]));
  return schools.map((s) => by.get(s) ?? null);
}

export async function getThresholds(school: string | null): Promise<Thresholds> {
  return resolveThresholds(...(await layers(school, SETTING_KEYS.thresholds)));
}

export async function getRoiAssumptions(school: string | null): Promise<RoiAssumptions> {
  return resolveRoi(...(await layers(school, SETTING_KEYS.roi)));
}

// Load thresholds for many schools at once (cron).
export async function getThresholdsBySchool(schools: string[]): Promise<Map<string, Thresholds>> {
  const all = ["*", ...new Set(schools)];
  const rows = await db
    .select({ school: programSettings.school, valueJson: programSettings.valueJson })
    .from(programSettings)
    .where(and(eq(programSettings.key, SETTING_KEYS.thresholds), inArray(programSettings.school, all)));
  const by = new Map(rows.map((r) => [r.school, r.valueJson]));
  const out = new Map<string, Thresholds>();
  for (const s of schools) out.set(s, resolveThresholds(by.get("*"), by.get(s)));
  return out;
}

export async function saveSetting(school: string, key: string, value: unknown, userId: string | null) {
  const valueJson = JSON.stringify(value);
  await db
    .insert(programSettings)
    .values({ school, key, valueJson, updatedById: userId })
    .onConflictDoUpdate({
      target: [programSettings.school, programSettings.key],
      set: { valueJson, updatedById: userId, updatedAt: new Date() },
    });
}

export async function getRawSetting(school: string, key: string): Promise<string | null> {
  const [row] = await db
    .select({ valueJson: programSettings.valueJson })
    .from(programSettings)
    .where(and(eq(programSettings.school, school), eq(programSettings.key, key)))
    .limit(1);
  return row?.valueJson ?? null;
}
