import { NextResponse } from "next/server";
// See lib/auth-cookie.ts for why we import from next-auth/jwt, not @auth/core/jwt.
import { encode } from "next-auth/jwt";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sessionCookieName } from "@/lib/auth-cookie";

const DEMO_EMAILS: Record<string, string> = {
  admin: "admin.demo@byui.edu",
  mentor: "mentor.demo@byui.edu",
  member: "member.demo@byui.edu",
};

const SESSION_TTL_SECONDS = 60 * 60; // 1h — demo sessions stay short-lived.

export async function POST(req: Request) {
  if (process.env.DEMO_ENABLED !== "true") {
    return NextResponse.json({ error: "Demo login disabled" }, { status: 403 });
  }
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "AUTH_SECRET not configured" },
      { status: 500 }
    );
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

  // Cookie name + secure flag tracked by sessionCookieName() so we match
  // Auth.js's own logic (which uses AUTH_URL's protocol, not NODE_ENV).
  const cookieName = sessionCookieName();
  const token = await encode({
    token: { sub: user.id, email: user.email, name: user.name ?? undefined },
    secret,
    salt: cookieName,
    maxAge: SESSION_TTL_SECONDS,
  });

  const res = NextResponse.json({ ok: true, redirectTo: "/dashboard" });
  res.cookies.set({
    name: cookieName,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    // Match secure flag to cookie name: __Secure- prefix requires Secure=true.
    secure: cookieName.startsWith("__Secure-"),
    path: "/",
    expires: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
  });
  return res;
}
