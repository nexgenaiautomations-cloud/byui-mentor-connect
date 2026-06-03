// "Possible Actions" — concrete things a mentor + mentee can do together.
// Surfaces on each mentee card so the mentor has a menu of obvious next steps.
// Source: BYUI CAN program.
export const POSSIBLE_ACTIONS = [
  "Explore Careers, Companies, Industries",
  "Share professional connections and relationships",
  "Help with Informational Interview preparation",
  "Go to a Career Fair or other Career Event together",
  "Go to a Society Meeting together",
  "Go do something else awesome together",
  "Help with LinkedIn or Other Platforms",
  "Work on Resumes",
  "Work on Cover Letters",
  "Work on Interviewing Skills",
  "Role Play Interviewing",
  "Work on Elevator Pitch",
  "Help apply to an internship or job",
  "Help with Grad School Preparation/Application",
  "Course planning",
];

// "Other" sentinel — when this is checked on the log form, the mentor must
// also fill in the free-text "otherAccomplishment" input.
export const OTHER_ACCOMPLISHMENT = "Other";

// Full list shown on the Log an Activity form: the 15 POSSIBLE_ACTIONS plus
// outcome items (offer received) and the Other sentinel. Order matters and
// is asserted by tests.
export const LOG_ACCOMPLISHMENT_OPTIONS = [
  ...POSSIBLE_ACTIONS,
  "My mentee got an internship offer",
  "My mentee got a career-related, part-time job offer",
  "My mentee got a career-related, full-time job offer",
  OTHER_ACCOMPLISHMENT,
] as const;

// BYUI CAN program cadence — "1 Career Task weekly · 2 Internships before
// senior year · 3 Career Chats each month".
export const CAN_CADENCE = [
  { n: 1, label: "Career Task", cadence: "weekly" },
  { n: 2, label: "Internships / Industry Experiences", cadence: "before senior year" },
  { n: 3, label: "Career Chats", cadence: "each month" },
];

// Activity thresholds
export const INACTIVITY_WARN_DAYS = 30;
export const INACTIVITY_DISCONNECT_DAYS = 180;
