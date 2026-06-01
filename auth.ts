import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db/client";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";
import { buildMagicLinkEmail } from "@/lib/magic-link-email";

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
  session: { strategy: "database" },
  pages: { signIn: "/login", verifyRequest: "/login/check-email" },
  providers: [
    Resend({
      from: EMAIL_FROM,
      apiKey: RESEND_KEY,
      // Branded HTML + plain-text body. Replaces the auth.js default plain
      // template so the email looks like part of BYUI CAN, not a debug dump.
      async sendVerificationRequest({ identifier: email, url, provider }) {
        const { host } = new URL(url);
        const { subject, html, text } = buildMagicLinkEmail({
          url,
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
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const email = user.email.toLowerCase();
      if (!email.endsWith(BYUI_DOMAIN)) return false;
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        (session.user as { id?: string }).id = user.id;
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
