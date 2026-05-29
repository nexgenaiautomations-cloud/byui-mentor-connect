// "Possible Actions" — concrete things a mentor + mentee can do together.
// Surfaces on the match-confirmed screen so they have immediate first steps.
// Source: BYUI CAN program.
export const POSSIBLE_ACTIONS = [
  "Explore Careers, Companies, Industries",
  "Help with LinkedIn or Other Platforms",
  "Work on Resumes",
  "Work on Cover Letters",
  "Work on Interviewing Skills / Practice Interviewing questions",
  "Work on Elevator Pitch",
  "Practice Interviewing",
  "Go to a Society Meeting together",
  "Go to a Career Fair or other Career Event together",
  "Help with Informational Interview preparation",
  "Share professional connections and relationships",
  "Help apply to an internship or job",
  "Help with Grad School Preparation/Application",
];

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
