import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// Lazily initialized so missing env vars don't crash at import time. If
// Upstash isn't configured, rate limiting silently no-ops (returns success).
let cachedClient: { redis: Redis; magicLinkPerEmail: Ratelimit; magicLinkPerIp: Ratelimit } | null = null;

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
