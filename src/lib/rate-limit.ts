import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// Lazily initialized so missing env vars don't crash at import time. If
// Upstash isn't configured, rate limiting silently no-ops (returns success).
let cachedClient: {
  redis: Redis;
  magicLinkPerEmail: Ratelimit;
  magicLinkPerIp: Ratelimit;
  signupPerIp: Ratelimit;
  passwordSignInPerEmail: Ratelimit;
  passwordSignInPerIp: Ratelimit;
  passwordResetPerEmail: Ratelimit;
  passwordResetPerIp: Ratelimit;
} | null = null;

function getClient() {
  if (cachedClient) return cachedClient;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const redis = new Redis({ url, token });
  cachedClient = {
    redis,
    // 3 magic-link sends per email per hour — generous, but prevents
    // someone using the form as a spam relay against a single inbox.
    magicLinkPerEmail: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "1 h"),
      prefix: "rl:mle",
    }),
    // 10 magic-link sends per IP per hour — catches scripts cycling many
    // @byui.edu addresses to enumerate or burn Resend quota.
    magicLinkPerIp: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 h"),
      prefix: "rl:mli",
    }),
    // 5 signups per IP per hour — prevents one host from creating fake
    // accounts in bulk against the seeded mentor pool.
    signupPerIp: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "rl:su",
    }),
    // 10 password-signin attempts per email per 5 min. Blocks online
    // password guessing without locking real users out for too long.
    passwordSignInPerEmail: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "5 m"),
      prefix: "rl:psie",
    }),
    passwordSignInPerIp: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, "5 m"),
      prefix: "rl:psii",
    }),
    // 3 password-reset emails per address per hour. Stops a stalker from
    // bombarding a victim's inbox with reset emails.
    passwordResetPerEmail: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "1 h"),
      prefix: "rl:pre",
    }),
    passwordResetPerIp: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 h"),
      prefix: "rl:pri",
    }),
  };
  return cachedClient;
}

export type LimitResult = {
  ok: boolean;
  reason?: "email" | "ip";
  resetAt?: number;
};

export async function limitMagicLink(
  email: string,
  ip: string | null
): Promise<LimitResult> {
  const client = getClient();
  if (!client) return { ok: true }; // No KV configured → no-op

  const [emailRes, ipRes] = await Promise.all([
    client.magicLinkPerEmail.limit(email),
    client.magicLinkPerIp.limit(ip ?? "unknown"),
  ]);

  if (!emailRes.success) return { ok: false, reason: "email", resetAt: emailRes.reset };
  if (!ipRes.success) return { ok: false, reason: "ip", resetAt: ipRes.reset };
  return { ok: true };
}

export async function limitSignup(ip: string | null): Promise<LimitResult> {
  const client = getClient();
  if (!client) return { ok: true };
  const res = await client.signupPerIp.limit(ip ?? "unknown");
  if (!res.success) return { ok: false, reason: "ip", resetAt: res.reset };
  return { ok: true };
}

export async function limitPasswordSignIn(
  email: string,
  ip: string | null
): Promise<LimitResult> {
  const client = getClient();
  if (!client) return { ok: true };
  const [emailRes, ipRes] = await Promise.all([
    client.passwordSignInPerEmail.limit(email),
    client.passwordSignInPerIp.limit(ip ?? "unknown"),
  ]);
  if (!emailRes.success) return { ok: false, reason: "email", resetAt: emailRes.reset };
  if (!ipRes.success) return { ok: false, reason: "ip", resetAt: ipRes.reset };
  return { ok: true };
}

export async function limitPasswordReset(
  email: string,
  ip: string | null
): Promise<LimitResult> {
  const client = getClient();
  if (!client) return { ok: true };
  const [emailRes, ipRes] = await Promise.all([
    client.passwordResetPerEmail.limit(email),
    client.passwordResetPerIp.limit(ip ?? "unknown"),
  ]);
  if (!emailRes.success) return { ok: false, reason: "email", resetAt: emailRes.reset };
  if (!ipRes.success) return { ok: false, reason: "ip", resetAt: ipRes.reset };
  return { ok: true };
}
