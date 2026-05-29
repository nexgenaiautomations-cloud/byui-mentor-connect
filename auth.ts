import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db/client";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";

const BYUI_DOMAIN = "@byui.edu";

// Throw clearly at startup if a required env var is missing — better than
// the provider silently dropping emails.
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    // During `next build` we don't have real secrets — emit a placeholder so
    // the build doesn't fail, but log so a misconfigured runtime is obvious.
    if (process.env.NEXT_PHASE === "phase-production-build") return "build-placeholder";
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

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
      from: process.env.EMAIL_FROM ?? "BYUI CAN Mentor Connect <onboarding@resend.dev>",
      apiKey: requireEnv("AUTH_RESEND_KEY"),
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
