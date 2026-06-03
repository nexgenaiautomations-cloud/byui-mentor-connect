import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { CAREER_OPTIONS, SEMESTER_LEVELS } from "@/lib/careers";
import {
  MAJOR_OPTIONS,
  MINOR_OPTIONS,
  GRADUATION_OPTIONS,
} from "@/lib/academic-options";
import { OnboardingForm } from "../onboarding/form";
import { signOutAction } from "@/lib/actions";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardedAt) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black text-navy-800 sm:text-3xl">Your profile</h1>
          <p className="mt-1 text-sm text-slate-600">Update what mentors and admins see.</p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 cursor-pointer"
          >
            Sign out →
          </button>
        </form>
      </header>
      <div className="card">
        <OnboardingForm
          initial={{
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? "",
            major: user.major ?? "",
            minor: user.minor ?? "",
            semesterLevel: user.semesterLevel ?? "",
            expectedGraduation: user.expectedGraduation ?? "",
            phone: user.phone ?? "",
            preferredContactMethod: user.preferredContactMethod ?? "email",
            bio: user.bio ?? "",
            image: user.image ?? "",
            careerInterests: user.careerInterests ?? [],
          }}
          careerOptions={[...CAREER_OPTIONS]}
          semesterLevels={[...SEMESTER_LEVELS]}
          majorOptions={[...MAJOR_OPTIONS]}
          minorOptions={[...MINOR_OPTIONS]}
          graduationOptions={[...GRADUATION_OPTIONS]}
        />
      </div>
    </div>
  );
}
