// Shared dropdown options for academic profile fields.
// Used by signup/onboarding, profile edit, and any validation paths.
//
// Majors and minors cover the BYU-Idaho College of Business and Communication.
// "Other" is supported on both lists — the profile UI shows a free-text input
// so students can type a major/minor we haven't listed.

export const MAJOR_OPTIONS = [
  "Accounting",
  "Agribusiness",
  "Applied Business Management",
  "Business Analytics",
  "Business Finance",
  "Business Management",
  "Communication",
  "Computer Science",
  "Data Science",
  "Economics",
  "Entrepreneurship",
  "Experience Design and Management",
  "Financial Economics",
  "Healthcare Administration",
  "Marketing",
  "Operations Management",
  "Public Relations",
  "Software Engineering",
  "Supply Chain Management",
  "Other",
] as const;

// Minors mirror majors plus a "None" option for students with no minor.
export const MINOR_OPTIONS = [
  "None",
  "Accounting",
  "Advertising",
  "Agribusiness",
  "Business",
  "Business Analytics",
  "Business Management",
  "Communication",
  "Computer Science",
  "Data Science",
  "Digital and Social Media",
  "Economics",
  "Entrepreneurship",
  "Event Management",
  "Finance",
  "Healthcare Administration",
  "Human Resource Management",
  "International Business",
  "Marketing",
  "Operations Management",
  "Public Relations",
  "Social Media Marketing",
  "Software Engineering",
  "Supply Chain Management",
  "Other",
] as const;

// Semester-based graduation terms. Kept manual (not generated) so admins can
// see exactly what students will see in the dropdown.
export const GRADUATION_OPTIONS = [
  "Winter 2026",
  "Spring 2026",
  "Fall 2026",
  "Winter 2027",
  "Spring 2027",
  "Fall 2027",
  "Winter 2028",
  "Spring 2028",
  "Fall 2028",
  "Winter 2029",
  "Spring 2029",
  "Fall 2029",
  "Winter 2030",
  "Spring 2030",
  "Fall 2030",
] as const;

export type MajorOption = (typeof MAJOR_OPTIONS)[number];
export type MinorOption = (typeof MINOR_OPTIONS)[number];
export type GraduationOption = (typeof GRADUATION_OPTIONS)[number];
