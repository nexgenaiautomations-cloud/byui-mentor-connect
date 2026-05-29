import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { eq } from "drizzle-orm";

const DEMO_EMAILS: Record<string, string> = {
  admin: "admin.demo@byui.edu",
  mentor: "mentor.demo@byui.edu",
  member: "member.demo@byui.edu",
};

const SESSION_COOKIE = process.env.NODE_ENV === "production"
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";

export async function POST(req: Request) {
  if (process.env.DEMO_ENABLED !== "true") {
    return NextResponse.json({ error: "Demo login disabled" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const email = DEMO_EMAILS[body?.role];
  if (!email) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return NextResponse.json(
      { error: "Demo user not found — run `npm run db:seed`" },
      { status: 404 }
    );
  }

  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

  await db.insert(sessions).values({
    sessionToken: token,
    userId: user.id,
    expires,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });

  return NextResponse.json({ ok: true, redirectTo: "/dashboard" });
}
