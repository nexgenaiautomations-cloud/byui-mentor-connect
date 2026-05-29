import "dotenv/config";
import { db } from "./client";
import {
  users,
  mentorApplications,
  requests,
  matches,
  meetingLogs,
  monthlyFeedback,
  type NewUser,
} from "./schema";
import { eq } from "drizzle-orm";

const avatar = (name: string, bg = "1B3A6B") =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=${bg}&textColor=ffffff`;

// -------- Main demo accounts (the ones the login screen surfaces) --------
const DEMO: NewUser[] = [
  {
    email: "admin.demo@byui.edu",
    name: "Avery Admin",
    firstName: "Avery",
    lastName: "Admin",
    image: avatar("Avery Admin"),
    major: "Computer Science",
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
    image: avatar("Morgan Mentor", "047857"),
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
    mentorCapacity: 5,
    mentorTopics: ["Resume reviews", "Internship prep", "SQL / Tableau", "Case interviews"],
    mentorAvailable: true,
    onboardedAt: new Date(),
  },
  {
    email: "member.demo@byui.edu",
    name: "Mason Member",
    firstName: "Mason",
    lastName: "Member",
    image: avatar("Mason Member", "7c3aed"),
    major: "Marketing",
    semesterLevel: "Sophomore",
    expectedGraduation: "Spring 2028",
    phone: "(208) 555-0188",
    preferredContactMethod: "email",
    bio: "Sophomore exploring brand management and digital marketing. Looking for someone who's been there.",
    careerInterests: ["Brand Management — Consumer Marketing", "Digital Marketing / Social Media", "E-Commerce"],
    isAdmin: false,
    isMentor: false,
    onboardedAt: new Date(),
  },
];

// -------- Additional mentors (so the directory feels populated) --------
const EXTRA_MENTORS: NewUser[] = [
  {
    email: "jordan.chen@byui.edu",
    name: "Jordan Chen",
    firstName: "Jordan",
    lastName: "Chen",
    image: avatar("Jordan Chen", "047857"),
    major: "Computer Science",
    minor: "Mathematics",
    semesterLevel: "Senior",
    expectedGraduation: "Spring 2026",
    phone: "(208) 555-0201",
    preferredContactMethod: "teams",
    bio: "Software engineer interning at Adobe. Always down to help with internship apps or CS coursework.",
    careerInterests: ["Entrepreneurship", "Graduate School"],
    isMentor: true,
    mentorCapacity: 5,
    mentorTopics: ["Web development", "Internship apps", "Algorithms", "Open source"],
    mentorAvailable: true,
    onboardedAt: new Date(),
  },
  {
    email: "emma.davis@byui.edu",
    name: "Emma Davis",
    firstName: "Emma",
    lastName: "Davis",
    image: avatar("Emma Davis", "be185d"),
    major: "Accounting",
    semesterLevel: "Senior",
    expectedGraduation: "Fall 2025",
    phone: "(208) 555-0202",
    preferredContactMethod: "email",
    bio: "CPA candidate, two Big-Four internships. Happy to help with public accounting recruiting.",
    careerInterests: ["Public Accounting", "Corporate Accounting", "Tax Planning"],
    isMentor: true,
    mentorCapacity: 4,
    mentorTopics: ["Public accounting recruiting", "CPA exam prep", "Internship apps"],
    mentorAvailable: true,
    onboardedAt: new Date(),
  },
  {
    email: "marcus.johnson@byui.edu",
    name: "Marcus Johnson",
    firstName: "Marcus",
    lastName: "Johnson",
    image: avatar("Marcus Johnson", "b45309"),
    major: "Marketing",
    minor: "Communications",
    semesterLevel: "Senior",
    expectedGraduation: "Spring 2026",
    phone: "(208) 555-0203",
    preferredContactMethod: "phone",
    bio: "Brand strategy intern at P&G last summer. Down to talk through campaigns, content, and creative briefs.",
    careerInterests: ["Brand Management — Consumer Marketing", "Digital Marketing / Social Media", "Advertising / Graphic Design"],
    isMentor: true,
    mentorCapacity: 5,
    mentorTopics: ["Brand strategy", "Social media campaigns", "Creative briefs", "Portfolio reviews"],
    mentorAvailable: true,
    onboardedAt: new Date(),
  },
  {
    email: "sarah.patel@byui.edu",
    name: "Sarah Patel",
    firstName: "Sarah",
    lastName: "Patel",
    image: avatar("Sarah Patel", "0891b2"),
    major: "Biology",
    minor: "Chemistry",
    semesterLevel: "Senior",
    expectedGraduation: "Spring 2026",
    phone: "(208) 555-0204",
    preferredContactMethod: "email",
    bio: "Pre-med, applying to med school this cycle. MCAT tutor and research assistant.",
    careerInterests: ["Graduate School", "Hospital Administration"],
    isMentor: true,
    mentorCapacity: 3,
    mentorTopics: ["MCAT prep", "Med school apps", "Research positions", "Personal statements"],
    mentorAvailable: true,
    onboardedAt: new Date(),
  },
  {
    email: "david.kim@byui.edu",
    name: "David Kim",
    firstName: "David",
    lastName: "Kim",
    image: avatar("David Kim", "1B3A6B"),
    major: "Mechanical Engineering",
    semesterLevel: "Senior",
    expectedGraduation: "Fall 2026",
    phone: "(208) 555-0205",
    preferredContactMethod: "teams",
    bio: "ME, FE exam passed. Two manufacturing internships and a robotics project lead role.",
    careerInterests: ["Supply Chain", "Entrepreneurship"],
    isMentor: true,
    mentorCapacity: 5,
    mentorTopics: ["FE exam", "CAD (SolidWorks)", "Manufacturing internships", "Robotics"],
    mentorAvailable: true,
    onboardedAt: new Date(),
  },
];

// -------- Additional members (mentees and the broader population) --------
const EXTRA_MEMBERS: NewUser[] = [
  {
    email: "olivia.brown@byui.edu",
    name: "Olivia Brown",
    firstName: "Olivia",
    lastName: "Brown",
    image: avatar("Olivia Brown", "7c3aed"),
    major: "Marketing",
    semesterLevel: "Sophomore",
    expectedGraduation: "Spring 2028",
    phone: "(208) 555-0301",
    preferredContactMethod: "email",
    bio: "Looking for someone who has done brand work — would love mock interviews.",
    careerInterests: ["Brand Management — Consumer Marketing", "Digital Marketing / Social Media"],
    onboardedAt: new Date(),
  },
  {
    email: "liam.anderson@byui.edu",
    name: "Liam Anderson",
    firstName: "Liam",
    lastName: "Anderson",
    image: avatar("Liam Anderson", "047857"),
    major: "Computer Science",
    semesterLevel: "Freshman",
    expectedGraduation: "Spring 2029",
    phone: "(208) 555-0302",
    preferredContactMethod: "teams",
    bio: "Freshman CS — completely new to the program. Need help picking a focus area.",
    careerInterests: ["Entrepreneurship", "Graduate School"],
    onboardedAt: new Date(),
  },
  {
    email: "sophia.martinez@byui.edu",
    name: "Sophia Martinez",
    firstName: "Sophia",
    lastName: "Martinez",
    image: avatar("Sophia Martinez", "be185d"),
    major: "Accounting",
    semesterLevel: "Junior",
    expectedGraduation: "Fall 2027",
    phone: "(208) 555-0303",
    preferredContactMethod: "email",
    bio: "Junior accounting — interested in Big Four recruiting timeline.",
    careerInterests: ["Public Accounting", "Tax Planning"],
    onboardedAt: new Date(),
  },
  {
    email: "noah.wilson@byui.edu",
    name: "Noah Wilson",
    firstName: "Noah",
    lastName: "Wilson",
    image: avatar("Noah Wilson", "1B3A6B"),
    major: "Mechanical Engineering",
    semesterLevel: "Sophomore",
    expectedGraduation: "Spring 2028",
    phone: "(208) 555-0304",
    preferredContactMethod: "phone",
    bio: "Considering robotics vs manufacturing. Need help picking electives.",
    careerInterests: ["Supply Chain", "Entrepreneurship"],
    onboardedAt: new Date(),
  },
  {
    email: "ava.thompson@byui.edu",
    name: "Ava Thompson",
    firstName: "Ava",
    lastName: "Thompson",
    image: avatar("Ava Thompson", "0891b2"),
    major: "Biology",
    semesterLevel: "Junior",
    expectedGraduation: "Spring 2027",
    phone: "(208) 555-0305",
    preferredContactMethod: "email",
    bio: "Pre-med, started studying for MCAT.",
    careerInterests: ["Graduate School", "Hospital Administration"],
    onboardedAt: new Date(),
  },
  {
    email: "ethan.garcia@byui.edu",
    name: "Ethan Garcia",
    firstName: "Ethan",
    lastName: "Garcia",
    image: avatar("Ethan Garcia", "047857"),
    major: "Computer Science",
    semesterLevel: "Sophomore",
    expectedGraduation: "Spring 2028",
    phone: "(208) 555-0306",
    preferredContactMethod: "teams",
    bio: "Want to break into web dev internships.",
    careerInterests: ["Entrepreneurship", "E-Commerce"],
    onboardedAt: new Date(),
  },
  {
    email: "mia.rodriguez@byui.edu",
    name: "Mia Rodriguez",
    firstName: "Mia",
    lastName: "Rodriguez",
    image: avatar("Mia Rodriguez", "7c3aed"),
    major: "Marketing",
    semesterLevel: "Junior",
    expectedGraduation: "Fall 2027",
    phone: "(208) 555-0307",
    preferredContactMethod: "email",
    bio: "Interested in agency vs in-house tradeoffs.",
    careerInterests: ["Advertising / Graphic Design", "Brand Management — Consumer Marketing"],
    onboardedAt: new Date(),
  },
  {
    email: "james.lee@byui.edu",
    name: "James Lee",
    firstName: "James",
    lastName: "Lee",
    image: avatar("James Lee", "b45309"),
    major: "Business Analytics",
    semesterLevel: "Sophomore",
    expectedGraduation: "Spring 2028",
    phone: "(208) 555-0308",
    preferredContactMethod: "teams",
    bio: "Picked up SQL but stuck on what to build for a portfolio.",
    careerInterests: ["Business Analytics", "Corporate Finance"],
    onboardedAt: new Date(),
  },
];

async function upsertUser(u: NewUser) {
  const [existing] = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
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

async function clearActivity() {
  // Wipe demo activity so re-runs produce a deterministic state.
  await db.delete(monthlyFeedback);
  await db.delete(meetingLogs);
  await db.delete(matches);
  await db.delete(requests);
  await db.delete(mentorApplications);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  await clearActivity();

  const ids: Record<string, string> = {};
  for (const u of [...DEMO, ...EXTRA_MENTORS, ...EXTRA_MEMBERS]) {
    ids[u.email] = await upsertUser(u);
    console.log("user", u.email);
  }

  // ---- Pending mentor applications (so admin has a queue) ----
  await db.insert(mentorApplications).values([
    {
      userId: ids["sophia.martinez@byui.edu"],
      motivation:
        "I've gone through two semesters of accounting recruiting and want to help underclassmen avoid the mistakes I made. Happy to walk through resume tweaks, behavioral prep, and the Big Four interview funnel.",
      topics: ["Resume reviews", "Behavioral interviews", "Big Four recruiting timeline"],
      capacity: 4,
      status: "pending",
      submittedAt: daysAgo(3),
    },
    {
      userId: ids["ethan.garcia@byui.edu"],
      motivation:
        "Got my first dev internship last summer and want to pay it forward. Can help freshmen pick their first language and build a starter portfolio.",
      topics: ["Web dev basics", "First portfolio projects", "Picking a language"],
      capacity: 3,
      status: "pending",
      submittedAt: daysAgo(1),
    },
  ]);

  // ---- Requests (mix of pending / accepted / declined) ----
  const olivia = ids["olivia.brown@byui.edu"];
  const liam = ids["liam.anderson@byui.edu"];
  const sophia = ids["sophia.martinez@byui.edu"];
  const noah = ids["noah.wilson@byui.edu"];
  const mia = ids["mia.rodriguez@byui.edu"];
  const ava = ids["ava.thompson@byui.edu"];
  const james = ids["james.lee@byui.edu"];
  const mason = ids["member.demo@byui.edu"];

  const morgan = ids["mentor.demo@byui.edu"];
  const jordan = ids["jordan.chen@byui.edu"];
  const emma = ids["emma.davis@byui.edu"];
  const marcus = ids["marcus.johnson@byui.edu"];
  const sarah = ids["sarah.patel@byui.edu"];
  const david = ids["david.kim@byui.edu"];

  // PENDING for mentor.demo so the floating banner shows up on demo login
  const [pendingForMorgan] = await db
    .insert(requests)
    .values({
      mentorId: morgan,
      menteeId: james,
      message:
        "Picked up SQL last semester but I'm stuck on portfolio ideas. Could you help me pick a project?",
      status: "pending",
      requestedAt: daysAgo(1),
    })
    .returning();

  // PENDING for mentor.demo from another mentee — adds a queue
  await db.insert(requests).values({
    mentorId: morgan,
    menteeId: mia,
    message: "Would love your take on agency vs in-house brand work.",
    status: "pending",
    requestedAt: daysAgo(2),
  });

  // ACCEPTED requests → matches
  const accepted: { mentorId: string; menteeId: string; daysOld: number }[] = [
    { mentorId: morgan, menteeId: olivia, daysOld: 45 },
    { mentorId: jordan, menteeId: liam, daysOld: 28 },
    { mentorId: david, menteeId: noah, daysOld: 22 },
    { mentorId: morgan, menteeId: mason, daysOld: 12 },
    { mentorId: emma, menteeId: sophia, daysOld: 60 },
  ];

  const matchIds: string[] = [];
  for (const a of accepted) {
    const [req] = await db
      .insert(requests)
      .values({
        mentorId: a.mentorId,
        menteeId: a.menteeId,
        status: "accepted",
        message: "Looking forward to chatting.",
        requestedAt: daysAgo(a.daysOld + 2),
        respondedAt: daysAgo(a.daysOld + 1),
      })
      .returning();
    const [match] = await db
      .insert(matches)
      .values({
        mentorId: a.mentorId,
        menteeId: a.menteeId,
        requestId: req.id,
        startedAt: daysAgo(a.daysOld),
        lastActivityAt: daysAgo(Math.max(0, a.daysOld - 7)),
        status: "active",
      })
      .returning();
    matchIds.push(match.id);
  }

  // DECLINED — adds a row to the admin activity feed and to mentee outgoing
  await db.insert(requests).values({
    mentorId: sarah,
    menteeId: ava,
    status: "declined",
    message: "Hoping for a research mentor — would you have capacity this semester?",
    requestedAt: daysAgo(20),
    respondedAt: daysAgo(18),
  });

  // ---- Meeting logs ----
  const TOPIC_BANK = [
    "Reviewed resume top-to-bottom; reordered work experience by impact.",
    "Walked through LinkedIn — added 'Open to' tag and reworked headline.",
    "Mock behavioral interview, 4 questions, candid feedback notes.",
    "Talked through internship application timeline and target companies.",
    "Practiced elevator pitch; trimmed it to 45 seconds.",
    "Outlined a portfolio project — scope, stack, GitHub plan.",
  ];
  const ACTION_BANK = [
    "Resubmit resume by Friday.",
    "Connect with 3 alumni in target industry via LinkedIn.",
    "Apply to 5 internships this week.",
    "Draft elevator pitch v2 by next meeting.",
    "Read article on STAR-method behavioral answers.",
    "Push starter project to GitHub.",
  ];

  // Olivia ↔ Morgan: 4 meetings spaced over 6 weeks
  const oliviaMatch = matchIds[0];
  const jordanLiamMatch = matchIds[1];
  const davidNoahMatch = matchIds[2];
  const morganMasonMatch = matchIds[3];
  const emmaSophiaMatch = matchIds[4];

  const meetings: Array<{
    matchId: string;
    mentorId: string;
    menteeId: string;
    daysAgo: number;
    duration: number;
    type: "video" | "in_person" | "phone";
    topicIdx: number;
    actionIdx: number;
  }> = [
    { matchId: oliviaMatch, mentorId: morgan, menteeId: olivia, daysAgo: 40, duration: 45, type: "video", topicIdx: 0, actionIdx: 0 },
    { matchId: oliviaMatch, mentorId: morgan, menteeId: olivia, daysAgo: 30, duration: 30, type: "video", topicIdx: 2, actionIdx: 2 },
    { matchId: oliviaMatch, mentorId: morgan, menteeId: olivia, daysAgo: 17, duration: 45, type: "in_person", topicIdx: 4, actionIdx: 3 },
    { matchId: oliviaMatch, mentorId: morgan, menteeId: olivia, daysAgo: 5, duration: 30, type: "video", topicIdx: 1, actionIdx: 1 },

    { matchId: jordanLiamMatch, mentorId: jordan, menteeId: liam, daysAgo: 25, duration: 60, type: "video", topicIdx: 5, actionIdx: 5 },
    { matchId: jordanLiamMatch, mentorId: jordan, menteeId: liam, daysAgo: 10, duration: 45, type: "video", topicIdx: 3, actionIdx: 2 },

    { matchId: davidNoahMatch, mentorId: david, menteeId: noah, daysAgo: 18, duration: 60, type: "in_person", topicIdx: 5, actionIdx: 5 },
    { matchId: davidNoahMatch, mentorId: david, menteeId: noah, daysAgo: 3, duration: 30, type: "phone", topicIdx: 3, actionIdx: 2 },

    { matchId: morganMasonMatch, mentorId: morgan, menteeId: mason, daysAgo: 8, duration: 30, type: "video", topicIdx: 0, actionIdx: 0 },
    { matchId: morganMasonMatch, mentorId: morgan, menteeId: mason, daysAgo: 1, duration: 30, type: "video", topicIdx: 4, actionIdx: 3 },

    { matchId: emmaSophiaMatch, mentorId: emma, menteeId: sophia, daysAgo: 55, duration: 45, type: "video", topicIdx: 3, actionIdx: 2 },
    { matchId: emmaSophiaMatch, mentorId: emma, menteeId: sophia, daysAgo: 40, duration: 45, type: "video", topicIdx: 2, actionIdx: 0 },
    { matchId: emmaSophiaMatch, mentorId: emma, menteeId: sophia, daysAgo: 25, duration: 60, type: "in_person", topicIdx: 0, actionIdx: 1 },
  ];

  for (const m of meetings) {
    await db.insert(meetingLogs).values({
      matchId: m.matchId,
      mentorId: m.mentorId,
      menteeId: m.menteeId,
      meetingDate: daysAgo(m.daysAgo),
      meetingType: m.type,
      durationMinutes: m.duration,
      topicsDiscussed: TOPIC_BANK[m.topicIdx],
      actionItems: ACTION_BANK[m.actionIdx],
      nextMeetingDate: daysAgo(m.daysAgo - 14),
      mentorNotes: m.daysAgo > 10 ? "Strong engagement; keep stretching." : null,
    });
  }

  // ---- Monthly feedback (a few entries; admin dashboard avg rating) ----
  const now = new Date();
  const fb = [
    { matchId: oliviaMatch, userId: olivia, role: "mentee", rating: 5 },
    { matchId: oliviaMatch, userId: morgan, role: "mentor", rating: 5 },
    { matchId: jordanLiamMatch, userId: liam, role: "mentee", rating: 5 },
    { matchId: jordanLiamMatch, userId: jordan, role: "mentor", rating: 4 },
    { matchId: davidNoahMatch, userId: noah, role: "mentee", rating: 4 },
    { matchId: morganMasonMatch, userId: mason, role: "mentee", rating: 5 },
    { matchId: emmaSophiaMatch, userId: sophia, role: "mentee", rating: 5 },
    { matchId: emmaSophiaMatch, userId: emma, role: "mentor", rating: 4 },
  ];
  for (const f of fb) {
    await db.insert(monthlyFeedback).values({
      matchId: f.matchId,
      submittedByUserId: f.userId,
      submittedByRole: f.role,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      rating: f.rating,
      answers: JSON.stringify({
        frequency: "About every other week.",
        value: "Concrete next steps each time.",
        blockers: "None right now.",
      }),
    });
  }

  console.log("Seeded:");
  console.log(`  users:         ${Object.keys(ids).length}`);
  console.log(`  mentors:       ${EXTRA_MENTORS.length + 1}`);
  console.log(`  applications:  2 pending`);
  console.log(`  requests:      ${accepted.length + 3}`);
  console.log(`  matches:       ${matchIds.length} active`);
  console.log(`  meeting_logs:  ${meetings.length}`);
  console.log(`  feedback:      ${fb.length}`);
  console.log(`  pending req for mentor.demo: ${pendingForMorgan?.id ? "yes" : "no"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
