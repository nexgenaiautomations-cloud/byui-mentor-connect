import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  primaryKey,
  pgEnum,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const requestStatus = pgEnum("request_status", [
  "pending",
  "accepted",
  "declined",
  "cancelled",
]);
export const matchStatus = pgEnum("match_status", [
  "active",
  "completed",
  "cancelled",
]);
export const applicationStatus = pgEnum("application_status", [
  "pending",
  "approved",
  "rejected",
]);
export const meetingType = pgEnum("meeting_type", [
  "in_person",
  "video",
  "phone",
  "other",
]);

// Auth.js users table — also our "members". Everyone who registers is a member.
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  name: text("name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  image: text("image"),
  emailVerified: timestamp("email_verified", { mode: "date" }),

  // Profile fields
  major: text("major"),
  minor: text("minor"),
  semesterLevel: text("semester_level"), // freshman | sophomore | junior | senior | graduate
  expectedGraduation: text("expected_graduation"), // e.g. "Spring 2027"
  phone: text("phone"),
  preferredContactMethod: text("preferred_contact_method"), // email | phone | teams
  bio: text("bio"),
  careerInterests: text("career_interests").array(),

  // Mentor flag — set true after approved mentor application
  isMentor: boolean("is_mentor").notNull().default(false),
  mentorCapacity: integer("mentor_capacity").default(5),
  mentorTopics: text("mentor_topics").array(),
  mentorAvailable: boolean("mentor_available").notNull().default(true),

  isAdmin: boolean("is_admin").notNull().default(false),
  onboardedAt: timestamp("onboarded_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    pk: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({ pk: primaryKey({ columns: [vt.identifier, vt.token] }) })
);

// Mentor applications — anyone who wants to mentor applies, admin approves.
export const mentorApplications = pgTable("mentor_application", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  motivation: text("motivation").notNull(),
  topics: text("topics").array().notNull(),
  capacity: integer("capacity").notNull().default(5),
  status: applicationStatus("status").notNull().default("pending"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewNotes: text("review_notes"),
  submittedAt: timestamp("submitted_at", { mode: "date" })
    .notNull()
    .defaultNow(),
  reviewedAt: timestamp("reviewed_at", { mode: "date" }),
});

export const requests = pgTable("request", {
  id: uuid("id").defaultRandom().primaryKey(),
  mentorId: text("mentor_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  menteeId: text("mentee_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  message: text("message"),
  status: requestStatus("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at", { mode: "date" })
    .notNull()
    .defaultNow(),
  respondedAt: timestamp("responded_at", { mode: "date" }),
});

export const matches = pgTable("match", {
  id: uuid("id").defaultRandom().primaryKey(),
  mentorId: text("mentor_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  menteeId: text("mentee_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  requestId: uuid("request_id").references(() => requests.id),
  startedAt: timestamp("started_at", { mode: "date" }).notNull().defaultNow(),
  // Bumped on every meeting log or check-in. Drives the 30-day reminder and
  // 6-month auto-disconnect.
  lastActivityAt: timestamp("last_activity_at", { mode: "date" }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { mode: "date" }),
  status: matchStatus("status").notNull().default("active"),
});

export const meetingLogs = pgTable("meeting_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  mentorId: text("mentor_id")
    .notNull()
    .references(() => users.id),
  menteeId: text("mentee_id")
    .notNull()
    .references(() => users.id),
  meetingDate: timestamp("meeting_date", { mode: "date" }).notNull(),
  meetingType: meetingType("meeting_type").notNull().default("video"),
  durationMinutes: integer("duration_minutes"),
  topicsDiscussed: text("topics_discussed"),
  actionItems: text("action_items"),
  nextMeetingDate: timestamp("next_meeting_date", { mode: "date" }),
  mentorNotes: text("mentor_notes"),
  menteeConfirmed: boolean("mentee_confirmed").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const monthlyFeedback = pgTable("monthly_feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  submittedByUserId: text("submitted_by_user_id")
    .notNull()
    .references(() => users.id),
  submittedByRole: text("submitted_by_role").notNull(), // "mentor" | "mentee"
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  rating: integer("rating").notNull(), // 1-5
  answers: text("answers"), // JSON-encoded
  submittedAt: timestamp("submitted_at", { mode: "date" }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type MentorApplication = typeof mentorApplications.$inferSelect;
export type Request = typeof requests.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MeetingLog = typeof meetingLogs.$inferSelect;
export type MonthlyFeedback = typeof monthlyFeedback.$inferSelect;
