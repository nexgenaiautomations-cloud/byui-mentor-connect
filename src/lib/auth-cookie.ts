// Issue an Auth.js JWT session cookie for a user. Used from signup and
// password-reset routes so the user is logged in immediately after the action.
//
// Mirrors NextAuth's own cookie/JWT shape so the auth() helper picks it up
// transparently. Salt must equal the cookie name — Auth.js v5 derives the
// encryption key from secret + salt.
//
// Cookie is set on the NextResponse the caller hands back, not via cookies()
// from next/headers — the latter doesn't reliably propagate to the response
// in Next.js 16 Route Handlers.
//
// IMPORTANT: import from next-auth/jwt, not @auth/core/jwt. next-auth bundles
// its own @auth/core inside its node_modules, and the JWE keys derived by the
// two copies don't match — so a token encoded with the top-level @auth/core
// cannot be decoded by auth() which uses the bundled copy.
import type { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";

// Cookie name + secure flag are pinned to NODE_ENV so they match what
// auth.ts configures Auth.js to read. Don't switch to AUTH_URL-protocol
// detection — see auth.ts cookies.sessionToken comment for why.
function useSecureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}

export function sessionCookieName(): string {
  return useSecureCookies()
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

// 14 days — must match auth.ts session.maxAge so password sign-ins get the
// same session lifetime as magic-link sign-ins (documented policy in
// docs/security/retention-policy.md).
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 14;

export async function attachSessionCookie(
  res: NextResponse,
  opts: {
    userId: string;
    email: string;
    name?: string | null;
    ttlSeconds?: number;
  }
): Promise<NextResponse> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET not configured");
  const ttl = opts.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const cookieName = sessionCookieName();

  const token = await encode({
    token: {
      sub: opts.userId,
      email: opts.email,
      name: opts.name ?? undefined,
    },
    secret,
    salt: cookieName,
    maxAge: ttl,
  });

  res.cookies.set({
    name: cookieName,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies(),
    path: "/",
    expires: new Date(Date.now() + ttl * 1000),
  });

  return res;
}
