import "dotenv/config";
import { db } from "./client";
import { users, type NewUser } from "./schema";
import { eq } from "drizzle-orm";

const DEMO_USERS: NewUser[] = [
  {
    email: "admin.demo@byui.edu",
    name: "Avery Admin",
    firstName: "Avery",
    lastName: "Admin",
    image:
      "https://api.dicebear.com/9.x/initials/svg?seed=Avery%20Admin&backgroundColor=1B3A6B&textColor=ffffff",
    major: "Computer Science",
    minor: null,
    semesterLevel: "Senior",
    expectedGraduation: "Spring 2026",
    phone: "(208) 555-0100",
    preferredContactMethod: "email",
    bio: "Program admin for the BYU-I Career Action Network. Loves matching students with the right mentor.",
    careerInterests: ["Organizational Leadership / Human Resources", "Entrepreneurship"],
    isAdmin: true,
    isMentor: false,
    onboardedAt: new Date(),
  },
  {
    email: "mentor.demo@byui.edu",
    name: "Morgan Mentor",
    firstName: "Morgan",
    lastName: "Mentor",
    image:
      "https://api.dicebear.com/9.x/initials/svg?seed=Morgan%20Mentor&backgroundColor=047857&textColor=ffffff",
    major: "Business Analytics",
    minor: "Statistics",
    semesterLevel: "Senior",
    expectedGraduation: "Fall 2026",
    phone: "(208) 555-0123",
    preferredContactMethod: "teams",
    bio: "Three internships in analytics. Happy to help with SQL, Tableau, and case prep.",
    careerInterests: ["Business Analytics", "Corporate Finance", "Asset Management & Investment Banking"],
    isAdmin: false,
    isMentor: true,
    mentorCapacity: 3,
    mentorTopics: ["Resume reviews", "Internship prep", "SQL / Tableau", "Case interviews"],
    mentorAvailability: "Tue/Thu evenings; Sat mornings",
    mentorAvailable: true,
    onboardedAt: new Date(),
  },
  {
    email: "member.demo@byui.edu",
    name: "Mason Member",
    firstName: "Mason",
    lastName: "Member",
    image:
      "https://api.dicebear.com/9.x/initials/svg?seed=Mason%20Member&backgroundColor=7c3aed&textColor=ffffff",
    major: "Marketing",
    minor: null,
    semesterLevel: "Sophomore",
    expectedGraduation: "Spring 2028",
    phone: "(208) 555-0188",
    preferredContactMethod: "email",
    bio: "Sophomore exploring brand management and digital marketing. Looking for someone who's been there.",
    careerInterests: [
      "Brand Management — Consumer Marketing",
      "Digital Marketing / Social Media",
      "E-Commerce",
    ],
    isAdmin: false,
    isMentor: false,
    onboardedAt: new Date(),
  },
];

async function main() {
  for (const u of DEMO_USERS) {
    const [existing] = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
    if (existing) {
      await db.update(users).set(u).where(eq(users.email, u.email));
      console.log("updated", u.email);
    } else {
      await db.insert(users).values({ ...u, emailVerified: new Date() } as NewUser);
      console.log("inserted", u.email);
    }
  }
  console.log("Demo seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
