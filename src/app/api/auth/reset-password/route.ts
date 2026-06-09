import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { passwordIssues } from "@/lib/password";
import { resetPasswordWithToken } from "@/lib/password-reset";
import { attachSessionCookie } from "@/lib/auth-cookie";

const schema = z.object({
  token: z.string().min(16).max(200),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = body ? schema.safeParse(body) : null;
  if (!parsed || !parsed.success) {
    return NextResponse.json(
      { error: "Invalid reset link or password" },
      { status: 400 }
    );
  }
  const { token, password } = parsed.data;

  const pwIssues = passwordIssues(password);
  if (pwIssues.length) {
    return NextResponse.json({ error: pwIssues[0] }, { status: 400 });
  }

  const result = await resetPasswordWithToken(token, password);
  if (!result.ok) {
    const msg =
      result.reason === "expired"
        ? "This reset link has expired. Request a new one."
        : "This reset link is invalid or already used. Request a new one.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Sign the user in so they go straight to the dashboard after resetting.
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, result.userId))
    .limit(1);
  if (!user) {
    return NextResponse.json(
      { error: "Account not found after reset" },
      { status: 500 }
    );
  }
  const res = NextResponse.json({
    ok: true,
    redirectTo: "/dashboard",
  });
  return attachSessionCookie(res, {
    userId: user.id,
    email: user.email,
    name: user.name,
  });
}
