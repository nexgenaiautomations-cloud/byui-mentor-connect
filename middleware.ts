// Content-Security-Policy middleware. Mode is controlled by the `CSP_MODE`
// environment variable:
//
//   CSP_MODE=disabled      — no header. Use this in local dev when HMR or a
//                             devtool fights the policy.
//   CSP_MODE=report-only   — sends `Content-Security-Policy-Report-Only`.
//                             Default in any non-development environment so the
//                             policy can be validated before enforcement.
//   CSP_MODE=enforce       — sends `Content-Security-Policy`. Use only after
//                             the report-only run has come back clean.
//
// The policy uses a per-request nonce on script-src and style-src + `strict-
// dynamic` so Next.js's framework scripts execute while ad-hoc inline scripts
// stay blocked. The nonce is forwarded to the page via the `x-nonce` request
// header; server components that need to render a `<Script nonce={...}>` can
// read it through `headers().get("x-nonce")`.
//
// Edge-runtime safe: no `next/headers`, no DB, no `auth()` — we don't have
// access to those from middleware anyway and the CSP nonce doesn't need them.

import { NextResponse, type NextRequest } from "next/server";

type CspMode = "disabled" | "report-only" | "enforce";

function resolveMode(): CspMode {
  const raw = (process.env.CSP_MODE ?? "").toLowerCase();
  if (raw === "enforce" || raw === "report-only" || raw === "disabled") {
    return raw;
  }
  // Dev default: disabled so HMR's eval'd modules don't trip CSP and produce
  // a noisy console. Prod default: report-only so we can see violations
  // before we start blocking them.
  return process.env.NODE_ENV === "development" ? "disabled" : "report-only";
}

// External browser-side hosts the app needs to reach. Server-only egress
// (Resend, Neon, Upstash) doesn't need to appear here because it's not done
// from the browser.
const IMG_SRC_HOSTS = [
  "https://api.dicebear.com", // generated initials avatars
  "https://images.unsplash.com", // landing imagery
];

// Google Fonts: the `<link>` stylesheet lives at fonts.googleapis.com, the
// actual .woff2 files live at fonts.gstatic.com.
const STYLE_SRC_HOSTS = ["https://fonts.googleapis.com"];
const FONT_SRC_HOSTS = ["https://fonts.gstatic.com"];

// connect-src is intentionally minimal — only same-origin and Vercel
// Analytics' beacon (which Vercel injects via inline `<Script>` it provides).
const CONNECT_SRC_HOSTS = [
  "https://vitals.vercel-insights.com",
];

function buildPolicy(nonce: string): string {
  // script-src: 'strict-dynamic' + nonce. Next 16's App Router auto-applies
  // the nonce to its framework scripts when `x-nonce` is on the request.
  // 'strict-dynamic' lets those nonce'd loaders bring in their children.
  //
  // style-src-elem / style-src-attr split: CSP3 silently ignores
  // `'unsafe-inline'` whenever a nonce is present in the source list. We
  // need inline style attributes for Tailwind's progress-bar widths and
  // React inline-style props, so we drop the nonce on style-src-attr and
  // accept 'unsafe-inline' there. Inline `<style>` blocks still require a
  // nonce via style-src-elem — those are framework-emitted and Next
  // auto-nonces them.
  const directives: Array<[string, string]> = [
    ["default-src", "'self'"],
    ["base-uri", "'self'"],
    ["object-src", "'none'"],
    ["frame-ancestors", "'none'"],
    ["form-action", "'self'"],
    ["script-src", `'self' 'nonce-${nonce}' 'strict-dynamic'`],
    [
      "style-src-elem",
      `'self' 'nonce-${nonce}' 'unsafe-inline' ${STYLE_SRC_HOSTS.join(" ")}`,
    ],
    ["style-src-attr", "'unsafe-inline'"],
    ["img-src", `'self' data: blob: ${IMG_SRC_HOSTS.join(" ")}`],
    ["font-src", `'self' data: ${FONT_SRC_HOSTS.join(" ")}`],
    ["connect-src", `'self' ${CONNECT_SRC_HOSTS.join(" ")}`],
    ["frame-src", "'none'"],
    ["worker-src", "'self' blob:"],
    ["manifest-src", "'self'"],
    ["report-uri", "/api/security/csp-report"],
  ];
  let value = directives.map(([k, v]) => `${k} ${v}`).join("; ");
  if (process.env.NODE_ENV === "production") {
    value += "; upgrade-insecure-requests";
  }
  return value;
}

export function middleware(request: NextRequest) {
  const mode = resolveMode();
  if (mode === "disabled") return NextResponse.next();

  // Edge crypto is available in all Vercel runtimes.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = buildPolicy(nonce);
  const headerName =
    mode === "enforce"
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only";

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(headerName, policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(headerName, policy);
  return response;
}

// Apply CSP to all HTML responses but skip the noise: static assets, image
// optimizer, the auth/api endpoints (those don't render scripts), and the
// CSP-report endpoint itself (would be circular). API routes return JSON
// without inline scripts, so they don't need a nonce.
//
// The `missing` clause excludes router-prefetch RSC fetches — those don't
// render new HTML and reusing a stale nonce would be pointless.
export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon\\.ico|manifest\\.json|icon-.+\\.png|byui-.+\\.png|byui-.+\\.jpg|byuican-.+\\.png|.+\\.(?:png|jpg|jpeg|svg|webp|ico|css|js|woff|woff2|ttf|map)).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
