// Career interest options — controlled vocabulary for the registration form
// (Question 7: "What career paths are you interested in (choose all that apply)?")
export const CAREER_OPTIONS = [
  "Advertising / Graphic Design",
  "Agribusiness",
  "Asset Management & Investment Banking",
  "Brand Management — Consumer Marketing",
  "Business Analytics",
  "Central Banking",
  "Corporate Accounting",
  "Corporate Finance",
  "Digital Marketing / Social Media",
  "E-Commerce",
  "Entrepreneurship",
  "Graduate School",
  "Hospital Administration",
  "Journalism",
  "Organizational Leadership / Human Resources",
  "Private Equity & Venture Capital",
  "Professional Sales",
  "Public Accounting",
  "Public Policy",
  "Public Relations",
  "Real Estate",
  "Small Business Management",
  "Supply Chain",
  "Tax Planning",
  "Video Production",
  "Wealth Management",
  "Other",
] as const;

export type CareerOption = (typeof CAREER_OPTIONS)[number];

export const SEMESTER_LEVELS = [
  "Freshman",
  "Sophomore",
  "Junior",
  "Senior",
  "Graduate",
] as const;
