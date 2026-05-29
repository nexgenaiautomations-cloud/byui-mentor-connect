import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { CAREER_OPTIONS, SEMESTER_LEVELS } from "@/lib/careers";
import { OnboardingForm } from "./form";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-bold text-navy-800">Welcome aboard.</h1>
      <p className="mt-2 text-slate-600">
        A few quick details so we can match you with the right people.
      </p>
      <div className="card mt-8">
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
