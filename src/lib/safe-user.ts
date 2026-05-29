import type { User } from "@/db/schema";

// Public-safe projection of a user record. Strips fields that should never
// leak over the wire to the user themselves (raw role flags can be inferred
// safely, but PII like phone is only visible post-match via /api/matches).
export type SafeMe = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  image: string | null;
  major: string | null;
  minor: string | null;
  semesterLevel: string | null;
  expectedGraduation: string | null;
  preferredContactMethod: string | null;
  bio: string | null;
  careerInterests: string[] | null;
  isMentor: boolean;
  isAdmin: boolean;
  mentorCapacity: number | null;
  mentorTopics: string[] | null;
  mentorAvailable: boolean;
  onboardedAt: Date | null;
};

export function toSafeMe(u: User): SafeMe {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    firstName: u.firstName,
    lastName: u.lastName,
    image: u.image,
    major: u.major,
    minor: u.minor,
    semesterLevel: u.semesterLevel,
    expectedGraduation: u.expectedGraduation,
    preferredContactMethod: u.preferredContactMethod,
    bio: u.bio,
    careerInterests: u.careerInterests,
    isMentor: u.isMentor,
    isAdmin: u.isAdmin,
    mentorCapacity: u.mentorCapacity,
    mentorTopics: u.mentorTopics,
    mentorAvailable: u.mentorAvailable,
    onboardedAt: u.onboardedAt,
  };
}
