import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { CAREER_OPTIONS, SEMESTER_LEVELS } from "@/lib/careers";
import { OnboardingForm } from "../onboarding/form";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold text-navy-800">Your profile</h1>
        <p className="mt-1 text-slate-600">Update what mentors and admins see.</p>
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
        />
      </div>
    </div>
  );
}
