import { NextResponse } from "next/server";
import { seedDemo } from "@/db/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.DEMO_ENABLED !== "true") {
    return NextResponse.json({ error: "Demo reset disabled" }, { status: 403 });
  }

  try {
    await seedDemo();
  } catch (e) {
    console.error("demo-reset failed", e);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
