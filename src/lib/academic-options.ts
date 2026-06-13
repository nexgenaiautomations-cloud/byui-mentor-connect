// Shared dropdown options for academic profile fields.
// Used by signup/onboarding, profile edit, and any validation paths.
//
// Majors and minors are the BYU-Idaho College of Business and Communication
// catalog. "Other" is supported on both lists — the profile UI shows a
// free-text input so students can type a major/minor we haven't listed.

// CBC majors — kept in the order the program shares them publicly so the
// UI matches the printed catalog. Communication tracks render as the
// "Communication: <track>" parent + track combination students see in
// CCB advising materials.
export const MAJOR_OPTIONS = [
  "Accounting",
  "Agribusiness",
  "Business Analytics",
  "Business Management",
  "Communication: Digital and Social Media",
  "Communication: Journalism",
  "Communication: Organizational Leadership",
  "Communication: Public Relations",
  "Communication: Video Production",
  "Communication: Visual Communication",
  "Economics",
  "Finance",
  "Financial Economics",
  "Marketing",
  "Supply Chain Operations",
  "Other",
] as const;

// CBC minors — alphabetized so the dropdown is easy to scan. "None" is the
// default for students with no declared minor, and "Other" stays at the
// bottom so the free-text path is the obvious fallback.
export const MINOR_OPTIONS = [
  "None",
  "Accounting",
  "Agribusiness",
  "Business Analytics",
  "Business Management",
  "Communication Theory",
  "Construction Management",
  "Digital and Social Media",
  "Economics",
  "Finance",
  "Financial Planning",
  "Healthcare Administration",
  "Investments",
  "Journalism",
  "Marketing",
  "Organizational Leadership",
  "Public Relations",
  "Small Business Innovation and Management",
  "Supply Chain Management",
  "Video Production",
  "Visual Communication",
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
