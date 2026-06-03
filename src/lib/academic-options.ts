// Shared dropdown options for academic profile fields.
// Used by signup/onboarding, profile edit, and any validation paths.

export const MAJOR_OPTIONS = [
  "Accounting",
  "Business Analytics",
  "Business Finance",
  "Business Management",
  "Computer Science",
  "Data Science",
  "Economics",
  "Marketing",
  "Software Engineering",
  "Supply Chain Management",
  "Other",
] as const;

// Minor list mirrors majors plus a "None" option for students with no minor.
export const MINOR_OPTIONS = [
  "None",
  "Accounting",
  "Business Analytics",
  "Business Finance",
  "Business Management",
  "Computer Science",
  "Data Science",
  "Economics",
  "Marketing",
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
