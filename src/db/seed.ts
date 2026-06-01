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

const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=200&h=200&q=80`;

// -------- Main demo accounts --------
const DEMO: NewUser[] = [
  {
    email: "admin.demo@byui.edu",
    name: "Avery Admin",
    firstName: "Avery",
    lastName: "Admin",
    image: photo("1494790108377-be9c29b29330"),
    major: "Computer Science",
    semesterLevel: "Senior",
    expectedGraduation: "Spring 2026",
    phone: "(208) 555-0100",
    preferredContactMethod: "email",
    bio: "Run the Career Action Network on the admin side. Spent two semesters as a peer mentor before this. Always trying to make the match flow less awkward.",
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
    image: photo("1438761681033-6461ffad8d80"),
    major: "Business Analytics",
    minor: "Statistics",
    semesterLevel: "Senior",
    expectedGraduation: "Fall 2026",
    phone: "(208) 555-0123",
    preferredContactMethod: "teams",
    bio: "Three analytics internships (one at a fintech, two at consumer brands). Open evenings Tue/Thu. Best at SQL/Tableau and case interview prep — not your person for finance modeling, sorry.",
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
    image: photo("1500648767791-00dcc994a43e"),
    major: "Marketing",
    semesterLevel: "Sophomore",
    expectedGraduation: "Spring 2028",
    phone: "(208) 555-0188",
    preferredContactMethod: "email",
    bio: "Sophomore, just declared Marketing. Trying to figure out brand vs digital before junior year — would love to talk to someone who has worked agency side.",
    careerInterests: ["Brand Management — Consumer Marketing", "Digital Marketing / Social Media", "E-Commerce"],
    isAdmin: false,
    isMentor: false,
    onboardedAt: new Date(),
  },
];

// -------- Extra mentors --------
const EXTRA_MENTORS: NewUser[] = [
  {
    email: "jordan.chen@byui.edu",
    name: "Jordan Chen",
    firstName: "Jordan",
    lastName: "Chen",
    image: photo("1472099645785-5658abf4ff4e"),
    major: "Computer Science",
    minor: "Mathematics",
    semesterLevel: "Senior",
    expectedGraduation: "Spring 2026",
    phone: "(208) 555-0201",
    preferredContactMethod: "teams",
    bio: "CS '26. Interned on the Acrobat web team at Adobe last summer — return offer for full-time. Available evenings for intern app strategy or course planning.",
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
    image: photo("1531123897727-8f129e1688ce"),
    major: "Accounting",
    semesterLevel: "Senior",
    expectedGraduation: "Fall 2025",
    phone: "(208) 555-0202",
    preferredContactMethod: "email",
    bio: "CPA-track, KPMG audit intern '24 and Deloitte tax '25. Sitting for FAR in February. Happy to walk through Big-Four recruiting from sophomore networking to offer.",
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
    image: photo("1500648767791-00dcc994a43e"),
    major: "Marketing",
    minor: "Communications",
    semesterLevel: "Senior",
    expectedGraduation: "Spring 2026",
    phone: "(208) 555-0203",
    preferredContactMethod: "phone",
    bio: "Brand strategy intern at P&G summer of '25, working on Pampers. Can talk through creative briefs, agency vs in-house tradeoffs, and how to actually answer 'why brand?' in interviews.",
    careerInterests: ["Brand Management — Consumer Marketing", "Digital Marketing / Social Media", "Advertising / Graphic Design"],
    isMentor: true,
    mentorCapacity: 5,
    mentorTopics: ["Brand strategy", "Creative briefs", "Portfolio reviews", "Interview prep"],
    mentorAvailable: true,
    onboardedAt: new Date(),
  },
  {
    email: "sarah.patel@byui.edu",
    name: "Sarah Patel",
    firstName: "Sarah",
    lastName: "Patel",
    image: photo("1544005313-94ddf0286df2"),
    major: "Biology",
    minor: "Chemistry",
    semesterLevel: "Senior",
    expectedGraduation: "Spring 2026",
    phone: "(208) 555-0204",
    preferredContactMethod: "email",
    bio: "Pre-med, MCAT 518. Applied to 24 med schools this cycle — currently sitting on 3 interview invites. I have very specific opinions about personal statements.",
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
    image: photo("1539571696357-5a69c17a67c6"),
    major: "Mechanical Engineering",
    semesterLevel: "Senior",
    expectedGraduation: "Fall 2026",
    phone: "(208) 555-0205",
    preferredContactMethod: "teams",
    bio: "ME, FE passed first try. Two manufacturing internships and currently lead the robotics club. SolidWorks is the hill I will die on.",
    careerInterests: ["Supply Chain", "Entrepreneurship"],
    isMentor: true,
    mentorCapacity: 5,
    mentorTopics: ["FE exam", "CAD (SolidWorks)", "Manufacturing internships", "Robotics"],
    mentorAvailable: true,
    onboardedAt: new Date(),
  },
];

// -------- Extra members --------
const EXTRA_MEMBERS: NewUser[] = [
  {
    email: "olivia.brown@byui.edu",
    name: "Olivia Brown",
    firstName: "Olivia",
    lastName: "Brown",
    image: photo("1573496359142-b8d87734a5a2"),
    major: "Marketing",
    semesterLevel: "Sophomore",
    expectedGraduation: "Spring 2028",
    phone: "(208) 555-0301",
    preferredContactMethod: "email",
    bio: "Looking for someone who has done brand work at a CPG. Mostly trying to figure out if I should be applying to agencies for sophomore summer or wait.",
    careerInterests: ["Brand Management — Consumer Marketing", "Digital Marketing / Social Media"],
    onboardedAt: new Date(),
  },
  {
    email: "liam.anderson@byui.edu",
    name: "Liam Anderson",
    firstName: "Liam",
    lastName: "Anderson",
    image: photo("1507003211169-0a1dd7228f2d"),
    major: "Computer Science",
    semesterLevel: "Freshman",
    expectedGraduation: "Spring 2029",
    phone: "(208) 555-0302",
    preferredContactMethod: "teams",
    bio: "Freshman, completely new to CS. Currently in CS 142. Want to figure out which electives matter for a software job vs grad school.",
    careerInterests: ["Entrepreneurship", "Graduate School"],
    onboardedAt: new Date(),
  },
  {
    email: "sophia.martinez@byui.edu",
    name: "Sophia Martinez",
    firstName: "Sophia",
    lastName: "Martinez",
    image: photo("1487412720507-e7ab37603c6f"),
    major: "Accounting",
    semesterLevel: "Junior",
    expectedGraduation: "Fall 2027",
    phone: "(208) 555-0303",
    preferredContactMethod: "email",
    bio: "Junior. Going through Big-Four recruiting this fall. Strongly considering tax vs audit and could use a sanity check.",
    careerInterests: ["Public Accounting", "Tax Planning"],
    onboardedAt: new Date(),
  },
  {
    email: "noah.wilson@byui.edu",
    name: "Noah Wilson",
    firstName: "Noah",
    lastName: "Wilson",
    image: photo("1545167622-3a6ac756afa4"),
    major: "Mechanical Engineering",
    semesterLevel: "Sophomore",
    expectedGraduation: "Spring 2028",
    phone: "(208) 555-0304",
    preferredContactMethod: "phone",
    bio: "Picking between robotics and manufacturing. Joined the FSAE team but not sure if it's the right time investment.",
    careerInterests: ["Supply Chain", "Entrepreneurship"],
    onboardedAt: new Date(),
  },
  {
    email: "ava.thompson@byui.edu",
    name: "Ava Thompson",
    firstName: "Ava",
    lastName: "Thompson",
    image: photo("1517841905240-472988babdf9"),
    major: "Biology",
    semesterLevel: "Junior",
    expectedGraduation: "Spring 2027",
    phone: "(208) 555-0305",
    preferredContactMethod: "email",
    bio: "Pre-med, started MCAT prep this semester (3 months in). 506 on a half-length, need to get serious. Looking for a study cadence.",
    careerInterests: ["Graduate School", "Hospital Administration"],
    onboardedAt: new Date(),
  },
  {
    email: "ethan.garcia@byui.edu",
    name: "Ethan Garcia",
    firstName: "Ethan",
    lastName: "Garcia",
    image: photo("1502685104226-ee32379fefbe"),
    major: "Computer Science",
    semesterLevel: "Sophomore",
    expectedGraduation: "Spring 2028",
    phone: "(208) 555-0306",
    preferredContactMethod: "teams",
    bio: "Trying to break into web dev internships for summer '26. Built one Next.js side project — not sure if that's enough for the resume.",
    careerInterests: ["Entrepreneurship", "E-Commerce"],
    onboardedAt: new Date(),
  },
  {
    email: "mia.rodriguez@byui.edu",
    name: "Mia Rodriguez",
    firstName: "Mia",
    lastName: "Rodriguez",
    image: photo("1463453091185-61582044d556"),
    major: "Marketing",
    semesterLevel: "Junior",
    expectedGraduation: "Fall 2027",
    phone: "(208) 555-0307",
    preferredContactMethod: "email",
    bio: "Junior, decided I want agency over in-house. Applying to summer creative-strategist roles. Could use someone to red-team my pitch.",
    careerInterests: ["Advertising / Graphic Design", "Brand Management — Consumer Marketing"],
    onboardedAt: new Date(),
  },
  {
    email: "james.lee@byui.edu",
    name: "James Lee",
    firstName: "James",
    lastName: "Lee",
    image: photo("1564564321837-a57b7070ac4f"),
    major: "Business Analytics",
    semesterLevel: "Sophomore",
    expectedGraduation: "Spring 2028",
    phone: "(208) 555-0308",
    preferredContactMethod: "teams",
    bio: "Picked up SQL last semester, working on a Tableau cert. Need help picking a portfolio project that isn't another COVID-data dashboard.",
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

export async function seedDemo() {
  await clearActivity();

  const ids: Record<string, string> = {};
  for (const u of [...DEMO, ...EXTRA_MENTORS, ...EXTRA_MEMBERS]) {
    ids[u.email] = await upsertUser(u);
  }

  // Mentor applications — written like a student wrote them, not like AI
  await db.insert(mentorApplications).values([
    {
      userId: ids["sophia.martinez@byui.edu"],
      motivation:
        "I went through Big-Four recruiting twice — once as a sophomore where I bombed every behavioral, and again this fall where I got to second rounds at 3 of the 4. The difference was mostly knowing what to expect. I want to spare freshmen and sophomores the first version of that experience.",
      topics: ["Resume reviews", "Behavioral interviews", "Big Four recruiting timeline"],
      capacity: 4,
      status: "pending",
      submittedAt: daysAgo(3),
    },
    {
      userId: ids["ethan.garcia@byui.edu"],
      motivation:
        "Just wrapped my first dev internship at a small Boise startup. It wasn't FAANG but I learned more in 10 weeks than my first two semesters of CS. Happy to help freshmen pick their first language and build a starter project that doesn't look like a tutorial.",
      topics: ["Web dev basics", "First portfolio projects", "Picking a language"],
      capacity: 3,
      status: "pending",
      submittedAt: daysAgo(1),
    },
  ]);

  // Pending requests for mentor.demo (banner!)
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

  const [pendingForMorgan] = await db
    .insert(requests)
    .values({
      mentorId: morgan,
      menteeId: james,
      message:
        "Hey Morgan — picked up SQL last semester but I'm stuck picking a portfolio project that isn't yet another COVID-data dashboard. Would love your take.",
      status: "pending",
      requestedAt: daysAgo(1),
    })
    .returning();

  await db.insert(requests).values({
    mentorId: morgan,
    menteeId: mia,
    message: "Saw you did brand at P&G — I'm trying to figure out agency vs in-house and could use a real opinion.",
    status: "pending",
    requestedAt: daysAgo(2),
  });

  const accepted: { mentorId: string; menteeId: string; daysOld: number; msg: string }[] = [
    { mentorId: morgan, menteeId: olivia, daysOld: 45, msg: "Sophomore Marketing, looking for someone who has worked brand. Two years out from job apps but want to start now." },
    { mentorId: jordan, menteeId: liam, daysOld: 28, msg: "Freshman CS, first time touching mentorship — I just want to talk through which electives actually matter." },
    { mentorId: david, menteeId: noah, daysOld: 22, msg: "Sophomore ME, picking between robotics and manufacturing. Could use a second opinion." },
    { mentorId: morgan, menteeId: mason, daysOld: 12, msg: "Sophomore Marketing, sibling app. Want to figure out brand vs digital before junior year." },
    { mentorId: emma, menteeId: sophia, daysOld: 60, msg: "Going through Big-Four recruiting this fall and would love your read on tax vs audit." },
  ];

  const matchIds: string[] = [];
  for (const a of accepted) {
    const [req] = await db
      .insert(requests)
      .values({
        mentorId: a.mentorId,
        menteeId: a.menteeId,
        status: "accepted",
        message: a.msg,
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

  // One declined for the admin activity feed
  await db.insert(requests).values({
    mentorId: sarah,
    menteeId: ava,
    status: "declined",
    message: "Pre-med, started MCAT prep — would love a study cadence.",
    requestedAt: daysAgo(20),
    respondedAt: daysAgo(18),
  });

  // Meeting logs — written like a mentor's notes, not a template
  const TOPICS = [
    "Resume top-to-bottom. Cut from 1.5 pages to 1, moved internship to top, killed the GPA line since it's not adding anything.",
    "LinkedIn pass. New headline ('Marketing @ BYU-I · seeking brand internships'), reordered featured to lead with the campaign project.",
    "Mock behavioral, 4 questions. 'Tell me about yourself' was the rough one — we rewrote it twice.",
    "Walked through summer '26 internship targets. Settled on 12 apps: 4 reach, 6 fit, 2 safety.",
    "Elevator pitch. Got it down to 45 seconds without sounding rehearsed. Almost.",
    "Picked a starter project: a Next.js gradebook clone with auth. GitHub repo set up, README first.",
    "Talked through CS 246 vs 240 for spring. Going with 246 + lighter overall load.",
    "Reviewed the personal statement draft. Cut the opening anecdote, expanded the research paragraph.",
  ];
  const ACTIONS = [
    "Resubmit resume to me by Friday.",
    "Connect with 3 alumni in CPG marketing on LinkedIn this week.",
    "Apply to 5 internships before Sunday.",
    "Re-record the elevator pitch by next meeting.",
    "Read the STAR-method article I sent — apply to one answer.",
    "First commit to the project repo by next Tuesday.",
    "Drop CS 240, register for CS 246.",
    "Rewrite the opening of the personal statement.",
  ];

  const [m1, m2, m3, m4, m5] = matchIds;
  const meetings: Array<{
    matchId: string; mentorId: string; menteeId: string;
    daysAgo: number; duration: number;
    type: "video" | "in_person" | "phone";
    topic: number; action: number;
  }> = [
    // Olivia ↔ Morgan
    { matchId: m1, mentorId: morgan, menteeId: olivia, daysAgo: 40, duration: 45, type: "video",     topic: 0, action: 0 },
    { matchId: m1, mentorId: morgan, menteeId: olivia, daysAgo: 30, duration: 30, type: "video",     topic: 2, action: 2 },
    { matchId: m1, mentorId: morgan, menteeId: olivia, daysAgo: 17, duration: 45, type: "in_person", topic: 4, action: 3 },
    { matchId: m1, mentorId: morgan, menteeId: olivia, daysAgo: 5,  duration: 30, type: "video",     topic: 1, action: 1 },
    // Liam ↔ Jordan
    { matchId: m2, mentorId: jordan, menteeId: liam,   daysAgo: 25, duration: 60, type: "video",     topic: 6, action: 6 },
    { matchId: m2, mentorId: jordan, menteeId: liam,   daysAgo: 10, duration: 45, type: "video",     topic: 5, action: 5 },
    // Noah ↔ David
    { matchId: m3, mentorId: david,  menteeId: noah,   daysAgo: 18, duration: 60, type: "in_person", topic: 5, action: 5 },
    { matchId: m3, mentorId: david,  menteeId: noah,   daysAgo: 3,  duration: 30, type: "phone",     topic: 3, action: 2 },
    // Mason ↔ Morgan
    { matchId: m4, mentorId: morgan, menteeId: mason,  daysAgo: 8,  duration: 30, type: "video",     topic: 0, action: 0 },
    { matchId: m4, mentorId: morgan, menteeId: mason,  daysAgo: 1,  duration: 30, type: "video",     topic: 4, action: 3 },
    // Sophia ↔ Emma
    { matchId: m5, mentorId: emma,   menteeId: sophia, daysAgo: 55, duration: 45, type: "video",     topic: 3, action: 2 },
    { matchId: m5, mentorId: emma,   menteeId: sophia, daysAgo: 40, duration: 45, type: "video",     topic: 2, action: 0 },
    { matchId: m5, mentorId: emma,   menteeId: sophia, daysAgo: 25, duration: 60, type: "in_person", topic: 0, action: 1 },
  ];

  for (const mt of meetings) {
    await db.insert(meetingLogs).values({
      matchId: mt.matchId,
      mentorId: mt.mentorId,
      menteeId: mt.menteeId,
      meetingDate: daysAgo(mt.daysAgo),
      meetingType: mt.type,
      durationMinutes: mt.duration,
      topicsDiscussed: TOPICS[mt.topic],
      actionItems: ACTIONS[mt.action],
      nextMeetingDate: daysAgo(mt.daysAgo - 14),
      mentorNotes: mt.daysAgo > 10 ? "Strong engagement; keep stretching." : null,
    });
  }

  // Monthly feedback
  const now = new Date();
  const fb = [
    { matchId: m1, userId: olivia, role: "mentee", rating: 5 },
    { matchId: m1, userId: morgan, role: "mentor", rating: 5 },
    { matchId: m2, userId: liam,   role: "mentee", rating: 5 },
    { matchId: m2, userId: jordan, role: "mentor", rating: 4 },
    { matchId: m3, userId: noah,   role: "mentee", rating: 4 },
    { matchId: m4, userId: mason,  role: "mentee", rating: 5 },
    { matchId: m5, userId: sophia, role: "mentee", rating: 5 },
    { matchId: m5, userId: emma,   role: "mentor", rating: 4 },
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
  console.log(`  matches:       ${matchIds.length}`);
  console.log(`  meeting_logs:  ${meetings.length}`);
  console.log(`  pending for mentor.demo: ${pendingForMorgan?.id ? "yes" : "no"}`);
}

// Run as a CLI only when invoked directly (npm run db:seed). Importing this
// file from an API route should not re-run the seed on import.
if (process.argv[1] && process.argv[1].includes("seed.ts")) {
  seedDemo().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
