// Minimal bootstrap seed. The only account this provisions is the head
// admin (Harrelld). Every other user — admins, mentors, and members —
// arrives through the regular signup + email-verification flow, and
// extra admins are promoted from the Manage admins page.
//
// Run: `npm run db:seed`
import "dotenv/config";
import { db } from "./client";
import { users, type NewUser } from "./schema";
import { eq } from "drizzle-orm";

const HEAD_ADMIN: NewUser = {
  email: "harrelld@byui.edu",
  name: "Harrelld",
  firstName: "",
  lastName: "Harrelld",
  major: "Business Management",
  semesterLevel: "Graduate",
  expectedGraduation: "",
  preferredContactMethod: "email",
  bio: "Head admin for BYUI CAN. Runs the program day-to-day and promotes new admins from the Manage admins page.",
  isAdmin: true,
  isHeadAdmin: true,
  isMentor: false,
  onboardedAt: new Date(),
};

async function upsertUser(u: NewUser) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, u.email))
    .limit(1);
  if (existing) {
    await db.update(users).set(u).where(eq(users.email, u.email));
    return existing.id;
  }
  const [inserted] = await db
    .insert(users)
    .values({ ...u, emailVerified: new Date() } as NewUser)
    .returning({ id: users.id });
  return inserted.id;
}

export async function seedStarterData() {
  const id = await upsertUser(HEAD_ADMIN);
  console.log(`Seeded head admin: ${HEAD_ADMIN.email} (${id})`);
}

// Run as a CLI only when invoked directly (npm run db:seed). Importing
// this file from anywhere else should not trigger a seed.
if (process.argv[1] && process.argv[1].includes("seed.ts")) {
  seedStarterData().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
