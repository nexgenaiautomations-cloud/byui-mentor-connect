import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db/client";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";

const BYUI_DOMAIN = "@byui.edu";

// We don't throw if the Resend key is missing at startup — that crashes every
// page render via the middleware/layout import chain. Instead the provider is
// initialised with an empty key; the magic-link send path will reject with a
// clear Resend API error if you try to use it without configuring.
const RESEND_KEY = process.env.AUTH_RESEND_KEY ?? "";

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
      apiKey: RESEND_KEY,
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
