import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db/client";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildMagicLinkEmail } from "@/lib/magic-link-email";
import { verifyPassword } from "@/lib/password";
import { auditEvent } from "@/lib/audit";

const BYUI_DOMAIN = "@byui.edu";

// We don't throw if the Resend key is missing at startup — that crashes every
// page render via the middleware/layout import chain. Instead the provider is
// initialised with an empty key; the magic-link send path will reject with a
// clear Resend API error if you try to use it without configuring.
const RESEND_KEY = process.env.AUTH_RESEND_KEY ?? "";
const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "BYUI CAN Mentor Connect <noreply@byuican.com>";

// Match auth.js Resend provider's default token TTL (24h) — only used in the
// email copy. Bump if you change the underlying expiry.
const MAGIC_LINK_TTL_MIN = 60 * 24;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // JWT sessions so the Credentials (password) provider can coexist with the
  // Resend magic-link provider. Both write to the same `users` table via the
  // DrizzleAdapter; only the session storage differs.
  //
  // 14-day TTL: shorter than the auth.js default (30 days) so a stolen
  // session cookie has a smaller window of usefulness, and long enough that
  // regular weekly users don't get re-prompted every visit. The
  // active-role cookie's maxAge is independently set to 30 days in
  // src/lib/actions.ts so role preference outlives auth sessions.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  // Pin the session cookie name to NODE_ENV. Auth.js would otherwise pick the
  // `__Secure-` prefix whenever AUTH_URL is HTTPS — but in local dev (http on
  // localhost) the browser silently refuses to STORE a `__Secure-` cookie, so
  // auth() can never read it back. NODE_ENV-driven naming side-steps that.
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: { signIn: "/login", verifyRequest: "/login/check-email" },
  providers: [
    Resend({
      from: EMAIL_FROM,
      apiKey: RESEND_KEY,
      // Branded HTML + plain-text body. Replaces the auth.js default plain
      // template so the email looks like part of BYUI CAN, not a debug dump.
      async sendVerificationRequest({ identifier: email, url, provider }) {
        // Rewrite the magic link to a confirmation page so Outlook/Defender
        // Safe Links and Gmail link-preview can scan the URL without burning
        // the one-time verification token. The actual /api/auth/callback/resend
        // GET only fires when the user clicks the button on /login/verify.
        const original = new URL(url);
        const verifyUrl = new URL(`${original.origin}/login/verify`);
        for (const [k, v] of original.searchParams) verifyUrl.searchParams.set(k, v);
        const linkUrl = verifyUrl.toString();
        const { host } = original;
        const { subject, html, text } = buildMagicLinkEmail({
          url: linkUrl,
          email,
          host,
          expiresMinutes: MAGIC_LINK_TTL_MIN,
        });

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: provider.from,
            to: email,
            subject,
            html,
            text,
            // Helps inbox providers thread + de-prioritize as transactional.
            headers: {
              "X-Entity-Ref-ID": "byuican-magic-link",
            },
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Resend error: ${body}`);
        }

        // Best-effort audit log. We don't have a Request here (Auth.js
        // owns the callback context), so the row goes in without IP/UA.
        // We DO know the recipient email, so do a quick lookup to attach
        // a targetUserId — the audit becomes searchable per-user.
        let targetUserId: string | null = null;
        try {
          const [u] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email.trim().toLowerCase()))
            .limit(1);
          targetUserId = u?.id ?? null;
        } catch {
          // Lookup failure shouldn't block the audit row — we'll just
          // store it without a targetUserId.
        }
        await auditEvent({
          targetUserId,
          eventType: "MAGIC_LINK_REQUESTED",
          severity: "info",
          metadata: { kind: "auth_js_resend_provider" },
        });
      },
    }),
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const email = String(rawCredentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(rawCredentials?.password ?? "");
        if (!email || !password) return null;
        if (!email.endsWith(BYUI_DOMAIN)) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        if (!user || !user.passwordHash) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      const email = user.email.toLowerCase();
      if (!email.endsWith(BYUI_DOMAIN)) return false;

      // Magic-link sign-ins go through the Resend provider and bypass our
      // /api/auth/signin route entirely, so we audit them here. Password
      // sign-ins are already audited in that route — checking
      // account.provider keeps the row from being duplicated.
      //
      // Note on the threat model: anyone who clicks a magic link must
      // control the recipient's inbox. If a password-signup account exists
      // for the same email but is still emailVerified=null, this sign-in
      // implicitly verifies it (Auth.js sets emailVerified on the user
      // record). That's correct: proving email ownership at any point
      // should grant account access, and someone with inbox access could
      // do a password reset anyway.
      if (account?.provider === "resend" && user.id) {
        void auditEvent({
          actorUserId: user.id,
          targetUserId: user.id,
          eventType: "LOGIN_SUCCEEDED",
          severity: "info",
          metadata: { method: "magic_link" },
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      // First call after sign-in: user is present, persist its id on the token.
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}
