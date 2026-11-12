import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  primaryKey,
  pgEnum,
  uuid,
  index,
  uniqueIndex,
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
// Who recorded an activity log. "system" is for auto-logs generated when a
// student crosses a KPI threshold (weekly/monthly goal met).
export const logAuthor = pgEnum("log_author", [
  "mentee",
  "mentor",
  "admin",
  "system",
]);
// Grouping for accomplishment checkboxes on the Log an Activity form. Stored
// alongside each log so KPI queries don't need to string-parse topics.
export const accomplishmentGroup = pgEnum("accomplishment_group", [
  "career_tasks",
  "industry_experiences",
  "career_chats",
]);

// Append-only audit log severity bucket. `info` = routine, expected events
// (sign-up, sign-in OK). `warning` = anomalous but not necessarily malicious
// (sign-in failed, rate-limit triggered, CSP violation). `critical` = active
// security incident (unauthorized admin attempt, role-cookie rejected,
// rejected promotion).
// What a meeting_log row actually is (docs/specs/accountability-upgrade.md §1).
// Only mentor_meeting + touchpoint count as mentor engagement.
export const logEventKind = pgEnum("log_event_kind", [
  "mentor_meeting",
  "touchpoint",
  "independent_activity",
  "system_event",
  "unverified",
]);

export const auditSeverity = pgEnum("audit_severity", [
  "info",
  "warning",
  "critical",
]);

// Strict event-type enum. ADD NEW VALUES HERE before logging them — Postgres
// will reject inserts with values not in this list. Keep the union in
// `src/lib/audit.ts` in lockstep with this enum.
export const auditEventType = pgEnum("audit_event_type", [
  "ADMIN_PROMOTED_USER",
  "ADMIN_DEMOTED_USER",
  "ADMIN_TRANSFERRED_HEAD",
  "ADMIN_APPROVED_MENTOR",
  "ADMIN_REJECTED_MENTOR",
  "ADMIN_CREATED_MATCH",
  "ADMIN_REMOVED_MATCH",
  "ADMIN_DELETED_USER",
  "ADMIN_CLEANED_USER_DATA",
  "USER_SIGNUP_CREATED",
  "USER_EMAIL_VERIFIED",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_RESET_COMPLETED",
  "LOGIN_SUCCEEDED",
  "LOGIN_FAILED",
  "MAGIC_LINK_REQUESTED",
  "RATE_LIMIT_TRIGGERED",
  "ROLE_COOKIE_REJECTED",
  "UNAUTHORIZED_ADMIN_ATTEMPT",
  "CSP_VIOLATION_REPORTED",
  "USER_ACCEPTED_TERMS",
  "SCHOOL_DOMAIN_CHANGED",
  "ISSUE_REPORTED",
  "ADMIN_ACKNOWLEDGED_ISSUE",
  "ADMIN_ADDRESSED_ISSUE",
  "ADMIN_CHANGED_ROLE",
  "ADMIN_REMOVED_USER",
  "ADMIN_RESTORED_USER",
  "USER_SIGNED_PLEDGE",
  "ADMIN_SET_STEWARDSHIP",
  "ADMIN_CHANGED_POD",
  "ADMIN_UPDATED_INTERVENTION",
  "ADMIN_UPDATED_PROGRAM_SETTINGS",
  "ADMIN_VERIFIED_CAREER_MILESTONE",
  "RETENTION_RUN",
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

  // Executive mentors steward a group of other mentors (see
  // mentor_stewardship). Always also a mentor.
  isExecutiveMentor: boolean("is_executive_mentor").notNull().default(false),

  isAdmin: boolean("is_admin").notNull().default(false),
  // Single user at a time — enforced in code, not the DB, so transferring is
  // a single UPDATE. The head admin can promote/demote other admins and
  // elect a successor.
  isHeadAdmin: boolean("is_head_admin").notNull().default(false),
  onboardedAt: timestamp("onboarded_at", { mode: "date" }),

  // Hashed password for Credentials provider (Phase 2). Null for magic-link
  // and demo accounts.
  passwordHash: text("password_hash"),

  // Prior career-chat experience bucket — populated by Phase 2 signup.
  // Values: "0" | "1-10" | "11-25" | "26-50" | "51-100" | "100+"
  priorCareerChats: text("prior_career_chats"),
  // Prior internship / career-related work bucket — populated by Phase 2.
  // Values: "None" | "1" | "2" | "3 or more"
  priorInternshipExperience: text("prior_internship_experience"),

  // Which Terms of Use / disclaimer version the user acknowledged at profile
  // setup (see src/lib/disclaimers.ts TERMS_VERSION), and when. Null until
  // the user completes the /agreements step.
  termsAcceptedVersion: text("terms_accepted_version"),
  termsAcceptedAt: timestamp("terms_accepted_at", { mode: "date" }),

  // 321 pledge: the name the user typed to sign it, and when. Null until
  // signed during profile setup (src/lib/pledge.ts).
  pledgeSignedName: text("pledge_signed_name"),
  pledgeSignedAt: timestamp("pledge_signed_at", { mode: "date" }),

  // Team ("pod") for the monthly leaderboard. Defaults to the pod for the
  // user's major; users can switch. FK added in the migration script.
  podId: uuid("pod_id"),

  // Set when an admin removes the account from ICAN. Removed accounts can't
  // sign in and are hidden from lists; rows are kept for the record and an
  // admin can restore them.
  deactivatedAt: timestamp("deactivated_at", { mode: "date" }),
  deactivatedById: text("deactivated_by_id"),
  deactivationReason: text("deactivation_reason"),

  // Mentor waitlist: set when a member found no mentor with an open spot;
  // notified-at throttles "a mentor in your major is available" emails.
  // See docs/specs/mentor-waitlist.md.
  mentorWaitlistedAt: timestamp("mentor_waitlisted_at", { mode: "date" }),
  mentorWaitNotifiedAt: timestamp("mentor_wait_notified_at", { mode: "date" }),

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
  // Legacy field kept for old rows; new applications leave it null. The
  // application form no longer asks for it.
  topics: text("topics").array(),
  // Bucketed self-report: 1-10 / 11-25 / 26-50 / 51-100 / 100+
  informationalInterviews: text("informational_interviews"),
  // Bucketed self-report: None / 1 / 2 / 3 or more
  internshipsCount: text("internships_count"),
  capacity: integer("capacity").notNull().default(5),
  status: applicationStatus("status").notNull().default("pending"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewNotes: text("review_notes"),
  submittedAt: timestamp("submitted_at", { mode: "date" })
    .notNull()
    .defaultNow(),
  reviewedAt: timestamp("reviewed_at", { mode: "date" }),
});

export const requests = pgTable(
  "request",
  {
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
  },
  (t) => ({
    mentorStatusIdx: index("request_mentor_status_idx").on(t.mentorId, t.status),
    menteeIdx: index("request_mentee_idx").on(t.menteeId),
  })
);

export const matches = pgTable(
  "match",
  {
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
    // Accountability timestamps (docs/specs/accountability-upgrade.md §2).
    // Recomputed from classified logs; independent student activity never
    // moves the interaction timestamps.
    firstMeetingAt: timestamp("first_meeting_at", { mode: "date" }),
    lastMeetingAt: timestamp("last_meeting_at", { mode: "date" }),
    lastInteractionAt: timestamp("last_interaction_at", { mode: "date" }),
    lastStudentActivityAt: timestamp("last_student_activity_at", { mode: "date" }),
    endedAt: timestamp("ended_at", { mode: "date" }),
    status: matchStatus("status").notNull().default("active"),
  },
  (t) => ({
    mentorStatusIdx: index("match_mentor_status_idx").on(t.mentorId, t.status),
    menteeStatusIdx: index("match_mentee_status_idx").on(t.menteeId, t.status),
    activityIdx: index("match_activity_idx").on(t.lastActivityAt),
  })
);

// Renamed conceptually to "activity logs" — table name stays meeting_log to
// avoid a destructive rename. The student is now the primary author; mentor
// and match are optional so a student can log without a mentor.
export const meetingLogs = pgTable(
  "meeting_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Nullable so a student with no active match can still log activity.
    matchId: uuid("match_id").references(() => matches.id, {
      onDelete: "cascade",
    }),
    // Nullable for the same reason — set when a match exists.
    mentorId: text("mentor_id").references(() => users.id),
    // Legacy field kept in sync with studentId; older code paths still read it.
    menteeId: text("mentee_id").references(() => users.id),
    // The student this log belongs to. Required from now on; code always sets
    // it. Old rows are backfilled by scripts/backfill-activity-logs.ts.
    studentId: text("student_id").references(() => users.id),
    createdBy: logAuthor("created_by").default("mentor"),
    lastEditedBy: text("last_edited_by").references(() => users.id),
    isSystemGenerated: boolean("is_system_generated").notNull().default(false),
    accomplishmentGroup: accomplishmentGroup("accomplishment_group"),
    meetingDate: timestamp("meeting_date", { mode: "date" }).notNull(),
    meetingType: meetingType("meeting_type").notNull().default("video"),
    durationMinutes: integer("duration_minutes"),
    topicsDiscussed: text("topics_discussed"),
    actionItems: text("action_items"),
    nextMeetingDate: timestamp("next_meeting_date", { mode: "date" }),
    mentorNotes: text("mentor_notes"),
    menteeConfirmed: boolean("mentee_confirmed").notNull().default(false),
    // Nullable only for legacy rows before the backfill runs; new rows always
    // set it (docs/specs/accountability-upgrade.md §1).
    eventKind: logEventKind("event_kind"),
    mentorConfirmed: boolean("mentor_confirmed").notNull().default(false),
    // Optional time-of-day (HH:MM) + IANA zone for nextMeetingDate, so
    // reminders are only time-precise when a time was actually given.
    nextMeetingTime: text("next_meeting_time"),
    nextMeetingTimezone: text("next_meeting_timezone"),
    actionItemsDoneAt: timestamp("action_items_done_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }),
  },
  (t) => ({
    matchIdx: index("meeting_log_match_idx").on(t.matchId),
    mentorIdx: index("meeting_log_mentor_idx").on(t.mentorId),
    studentIdx: index("meeting_log_student_idx").on(t.studentId),
    studentDateIdx: index("meeting_log_student_date_idx").on(
      t.studentId,
      t.meetingDate
    ),
  })
);

export const monthlyFeedback = pgTable(
  "monthly_feedback",
  {
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
  },
  (t) => ({
    // One feedback per (match, user, month, year) — prevents accidental dupes.
    uniqMonth: uniqueIndex("monthly_feedback_uniq").on(
      t.matchId,
      t.submittedByUserId,
      t.month,
      t.year
    ),
  })
);

// Password-reset tokens — stored hashed so a DB leak doesn't let an attacker
// reset accounts. The plain token only lives in the email link.
//
// `tokenHash` is SHA-256(rawToken) hex. Lookups go through the hash, never
// the raw token. `expiresAt` is enforced at consume time, not by a TTL trigger.
// Tokens are deleted on consume (single-use).
export const passwordResetTokens = pgTable(
  "password_reset_token",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tokenIdx: uniqueIndex("password_reset_token_hash_uniq").on(t.tokenHash),
    userIdx: index("password_reset_token_user_idx").on(t.userId),
  })
);

// User-submitted issue reports — the in-sidebar "Report an issue" button
// drops a row here (and optionally emails ISSUE_REPORT_TO via Resend).
// userId can be null if a logged-out user ever submits (none today; gated to
// signed-in users by the route handler).
export const issueReports = pgTable(
  "issue_report",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    category: text("category").notNull(), // "it" | "mentor" | "mentee" | "other"
    message: text("message").notNull(),
    contactEmail: text("contact_email"),
    // "open" | "addressed" — see src/lib/issues.ts. Every admin still has to
    // acknowledge an addressed issue (issue_report_receipt).
    status: text("status").notNull().default("open"),
    addressedAt: timestamp("addressed_at", { mode: "date" }),
    addressedById: text("addressed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    createdIdx: index("issue_report_created_idx").on(t.createdAt),
  })
);

// One row per (issue, admin) once that admin has acknowledged the issue —
// the durable record that each admin saw each report.
export const issueReportReceipts = pgTable(
  "issue_report_receipt",
  {
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issueReports.id, { onDelete: "cascade" }),
    adminId: text("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seenAt: timestamp("seen_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.issueId, t.adminId] }),
    adminIdx: index("issue_report_receipt_admin_idx").on(t.adminId),
  })
);

// Teams for the monthly points leaderboard (src/lib/pods.ts). Pods named
// after a major are created automatically; admins can add others.
export const pods = pgTable(
  "pod",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    major: text("major"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  }
);

// Executive-mentor stewardship: each mentor is overseen by at most one
// executive mentor. Admins assign and rebalance it on /admin/stewardship.
export const mentorStewardship = pgTable(
  "mentor_stewardship",
  {
    mentorId: text("mentor_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    executiveId: text("executive_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedById: text("assigned_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedAt: timestamp("assigned_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    executiveIdx: index("mentor_stewardship_executive_idx").on(t.executiveId),
  })
);

// Schools whose email domain may register. byui.edu is the launch school;
// platform admins add others after a school signs on.
export const schoolDomains = pgTable("school_domain", {
  domain: text("domain").primaryKey(), // lowercase, e.g. "byui.edu"
  schoolName: text("school_name").notNull(),
  active: boolean("active").notNull().default(true),
  createdByUserId: text("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// "Bring ICAN to your school" requests from school staff. Public form, so
// every field is untrusted text; rate limited per IP.
export const schoolInquiries = pgTable(
  "school_inquiry",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    schoolName: text("school_name").notNull(),
    role: text("role"),
    emailDomain: text("email_domain"),
    message: text("message"),
    status: text("status").notNull().default("new"), // new | contacted | added | declined
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index("school_inquiry_created_idx").on(t.createdAt),
  })
);

// Earned-achievement rows. Each (student, achievementKey) is unique — a
// student earns each badge at most once.
export const achievements = pgTable(
  "achievement",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementKey: text("achievement_key").notNull(),
    earnedAt: timestamp("earned_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("achievement_student_key_uniq").on(
      t.studentId,
      t.achievementKey
    ),
    studentIdx: index("achievement_student_idx").on(t.studentId),
  })
);

// Append-only audit log. Writes happen via `auditEvent()` in `src/lib/audit.ts`
// and are best-effort — a failed insert never blocks the user-facing action.
// Reads are gated to admins at the API layer. UPDATE and DELETE are blocked
// at the database layer by Row Level Security (see scripts/apply-rls.ts and
// docs/security/rls-plan.md) so even a leaked DB credential cannot tamper
// with prior log entries.
//
// `actorUserId` is the user who caused the event (when known) — `null` for
// anonymous flows like password-reset requests by email.
// `targetUserId` is the user the event was about (when applicable).
// `ipHash` is SHA-256(ip + AUDIT_IP_HASH_SECRET), never the raw IP. Hashes
// are stored as hex so they can still be grouped without revealing addresses.
// `metadata` is a typed JSON column. The helper validates payloads before
// insert so passwords, raw tokens, magic links, and session JWTs never land
// here even by accident.
export const auditEvents = pgTable(
  "audit_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    targetUserId: text("target_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    eventType: auditEventType("event_type").notNull(),
    severity: auditSeverity("severity").notNull().default("info"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    // text + JSON.stringify rather than jsonb so a malformed payload never
    // hard-fails the insert at the column level.
    metadataJson: text("metadata_json"),
  },
  (t) => ({
    createdIdx: index("audit_event_created_idx").on(t.createdAt),
    typeIdx: index("audit_event_type_idx").on(t.eventType, t.createdAt),
    actorIdx: index("audit_event_actor_idx").on(t.actorUserId, t.createdAt),
    targetIdx: index("audit_event_target_idx").on(t.targetUserId, t.createdAt),
    severityIdx: index("audit_event_severity_idx").on(t.severity, t.createdAt),
  })
);

// ---------------------------------------------------------------------------
// Accountability upgrade (docs/specs/accountability-upgrade.md)
// ---------------------------------------------------------------------------

// Per-user email preferences. A missing row means "all defaults on".
export const notificationPreferences = pgTable("notification_preference", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  meetingReminders: boolean("meeting_reminders").notNull().default(true),
  followUps: boolean("follow_ups").notNull().default(true),
  inactivityNudges: boolean("inactivity_nudges").notNull().default(true),
  timezone: text("timezone").notNull().default("America/Denver"),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// A planned meeting, created from a log's "next meeting" date. Drives the
// 24h / 1h reminders and the "did this happen?" follow-up.
export const scheduledMeetings = pgTable(
  "scheduled_meeting",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    sourceLogId: uuid("source_log_id").references(() => meetingLogs.id, {
      onDelete: "set null",
    }),
    scheduledById: text("scheduled_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Local calendar date YYYY-MM-DD in `timezone`.
    scheduledDate: text("scheduled_date").notNull(),
    // HH:MM local, or null when only a date is known.
    scheduledTime: text("scheduled_time"),
    timezone: text("timezone").notNull().default("America/Denver"),
    // Exact instant when a time is known; otherwise local midnight of the day.
    startsAt: timestamp("starts_at", { mode: "date" }).notNull(),
    // scheduled | completed | missed | cancelled
    status: text("status").notNull().default("scheduled"),
    completedLogId: uuid("completed_log_id").references(() => meetingLogs.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }),
  },
  (t) => ({
    matchIdx: index("scheduled_meeting_match_idx").on(t.matchId),
    statusStartsIdx: index("scheduled_meeting_status_starts_idx").on(t.status, t.startsAt),
    sourceUniq: uniqueIndex("scheduled_meeting_source_log_uniq").on(t.sourceLogId),
  })
);

// One row per notification the reminder job decided to send. The unique
// dedupe_key is the idempotency guard: the job claims a key before sending.
export const notificationDeliveries = pgTable(
  "notification_delivery",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dedupeKey: text("dedupe_key").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    matchId: uuid("match_id").references(() => matches.id, { onDelete: "set null" }),
    scheduledMeetingId: uuid("scheduled_meeting_id").references(() => scheduledMeetings.id, {
      onDelete: "set null",
    }),
    // pending | sent | failed | dry_run | skipped_optout | skipped_cap
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { mode: "date" }),
  },
  (t) => ({
    dedupeUniq: uniqueIndex("notification_delivery_dedupe_uniq").on(t.dedupeKey),
    userCreatedIdx: index("notification_delivery_user_created_idx").on(t.userId, t.createdAt),
    matchIdx: index("notification_delivery_match_idx").on(t.matchId, t.createdAt),
  })
);

// Program configuration (thresholds, ROI assumptions). `school` is an email
// domain, or "*" for the default every school inherits.
export const programSettings = pgTable(
  "program_setting",
  {
    school: text("school").notNull().default("*"),
    key: text("key").notNull(),
    valueJson: text("value_json").notNull(),
    updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.school, t.key] }) })
);

// Career pipeline events (docs/specs/accountability-upgrade.md §4).
export const careerMilestones = pgTable(
  "career_milestone",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // exploring | preparing | applying | interviewing | offer_received |
    // offer_accepted | started
    stage: text("stage").notNull(),
    // internship | part_time | full_time | null
    opportunityType: text("opportunity_type"),
    careerField: text("career_field"),
    employer: text("employer"),
    positionTitle: text("position_title"),
    occurredOn: timestamp("occurred_on", { mode: "date" }).notNull().defaultNow(),
    // self_reported | activity_log | admin
    source: text("source").notNull().default("self_reported"),
    sourceLogId: uuid("source_log_id").references(() => meetingLogs.id, {
      onDelete: "cascade",
    }),
    // An acceptance / start points back at the offer it concerns so the
    // offer is never counted twice.
    relatedMilestoneId: uuid("related_milestone_id"),
    // self_reported | verified
    verification: text("verification").notNull().default("self_reported"),
    verifiedById: text("verified_by_id").references(() => users.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    studentIdx: index("career_milestone_student_idx").on(t.studentId, t.occurredOn),
    stageIdx: index("career_milestone_stage_idx").on(t.stage),
    sourceLogUniq: uniqueIndex("career_milestone_source_log_uniq").on(
      t.sourceLogId,
      t.opportunityType
    ),
  })
);

// Intervention Center cases. At most one open case per match (partial
// unique index created by the migration script).
export const interventions = pgTable(
  "intervention",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    studentId: text("student_id").references(() => users.id, { onDelete: "cascade" }),
    mentorId: text("mentor_id").references(() => users.id, { onDelete: "cascade" }),
    school: text("school").notNull(),
    reasons: text("reasons").array().notNull(),
    // new | reviewing | contacted | awaiting_response | resolved | closed
    status: text("status").notNull().default("new"),
    assignedToId: text("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
    followUpOn: timestamp("follow_up_on", { mode: "date" }),
    lastOutreachAt: timestamp("last_outreach_at", { mode: "date" }),
    lastOutreachById: text("last_outreach_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    openedAt: timestamp("opened_at", { mode: "date" }).notNull().defaultNow(),
    lastDetectedAt: timestamp("last_detected_at", { mode: "date" }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    schoolStatusIdx: index("intervention_school_status_idx").on(t.school, t.status),
    matchIdx: index("intervention_match_idx").on(t.matchId),
  })
);

// Append-only trail of everything done on a case.
export const interventionEvents = pgTable(
  "intervention_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    interventionId: uuid("intervention_id")
      .notNull()
      .references(() => interventions.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    // opened | redetected | status | assigned | note | outreach | follow_up |
    // reassign_recommended
    action: text("action").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    caseIdx: index("intervention_event_case_idx").on(t.interventionId, t.createdAt),
  })
);

// Legal / investigation holds. While a hold is open (released_at null) the
// retention job never treats that person's records as eligible.
export const retentionHolds = pgTable(
  "retention_hold",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    reason: text("reason").notNull(),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    releasedAt: timestamp("released_at", { mode: "date" }),
  },
  (t) => ({ userIdx: index("retention_hold_user_idx").on(t.userId) })
);

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type ScheduledMeeting = typeof scheduledMeetings.$inferSelect;
export type NotificationDelivery = typeof notificationDeliveries.$inferSelect;
export type CareerMilestone = typeof careerMilestones.$inferSelect;
export type Intervention = typeof interventions.$inferSelect;
export type InterventionEvent = typeof interventionEvents.$inferSelect;

export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type MentorApplication = typeof mentorApplications.$inferSelect;
export type Request = typeof requests.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MeetingLog = typeof meetingLogs.$inferSelect;
export type NewMeetingLog = typeof meetingLogs.$inferInsert;
export type MonthlyFeedback = typeof monthlyFeedback.$inferSelect;
export type Achievement = typeof achievements.$inferSelect;
export type NewAchievement = typeof achievements.$inferInsert;
export type IssueReport = typeof issueReports.$inferSelect;
export type NewIssueReport = typeof issueReports.$inferInsert;
export type IssueReportReceipt = typeof issueReportReceipts.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type SchoolDomain = typeof schoolDomains.$inferSelect;
export type SchoolInquiry = typeof schoolInquiries.$inferSelect;
