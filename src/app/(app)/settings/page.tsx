import Link from "next/link";
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
import { InstallButton } from "@/components/install-button";
import { listAchievementsForStudent } from "@/lib/achievements";
import { TrophyBadge } from "@/components/trophy-badge";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardedAt) redirect("/onboarding");

  const isMentor = user.isMentor;
  const showTrophies = !isMentor && !user.isAdmin;

  const achievements = showTrophies
    ? await listAchievementsForStudent(user.id)
    : [];
  const earned = achievements.filter((a) => a.isEarned);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Settings
          </p>
          <h1 className="font-display text-2xl font-black text-navy-800 sm:text-3xl">
            Your account
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Update what mentors and admins see, install the app, and manage your
            account.
          </p>
        </div>
      </header>

      {/* Profile editor */}
      <section className="card">
        <h2 className="font-display text-lg font-bold text-byui-blue-dark">
          Profile
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Photo, major, minor, expected graduation, career interests, and contact.
        </p>
        <div className="mt-4">
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
              priorCareerChats: user.priorCareerChats ?? "",
              priorInternshipExperience: user.priorInternshipExperience ?? "",
            }}
            careerOptions={[...CAREER_OPTIONS]}
            semesterLevels={[...SEMESTER_LEVELS]}
            majorOptions={[...MAJOR_OPTIONS]}
            minorOptions={[...MINOR_OPTIONS]}
            graduationOptions={[...GRADUATION_OPTIONS]}
            showCareerChats
          />
        </div>
      </section>

      {/* Trophy mini-strip — mentees only */}
      {showTrophies && (
        <section className="card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-byui-blue-dark">
                Trophy Case
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {earned.length === 0
                  ? "No trophies yet — log an activity to start earning."
                  : `${earned.length} of ${achievements.length} earned`}
              </p>
            </div>
            <Link
              href="/trophy-case"
              className="text-xs font-semibold text-byui-blue hover:underline"
            >
              View all →
            </Link>
          </div>
          {achievements.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {achievements.slice(0, 8).map((a) => (
                <div
                  key={a.key}
                  className="flex w-16 shrink-0 flex-col items-center gap-1"
                  aria-label={`${a.title} — ${a.isEarned ? "earned" : "not yet earned"}`}
                  title={a.title}
                >
                  <TrophyBadge
                    achievementKey={a.key}
                    earned={a.isEarned}
                    size={48}
                  />
                  <p
                    className={
                      "w-full truncate text-center text-[10px] " +
                      (a.isEarned
                        ? "font-semibold text-byui-blue-dark"
                        : "text-slate-400")
                    }
                  >
                    {a.title.split(" ")[0]}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* PWA install */}
      <section className="card">
        <h2 className="font-display text-lg font-bold text-byui-blue-dark">
          Install the App
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Add BYUI CAN to your phone or desktop for faster access. Works offline
          for everything you&apos;ve already loaded.
        </p>
        <div className="mt-3">
          <InstallButton variant="primary" label="Install BYUI CAN" />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          If the button is hidden, your device may have already installed the app
          — or your browser doesn&apos;t support PWA installs.
        </p>
      </section>

      {/* Want to be a mentor? — only show for non-mentor, non-admin users */}
      {!isMentor && !user.isAdmin && (
        <section className="card">
          <h2 className="font-display text-lg font-bold text-byui-blue-dark">
            Want to be a mentor?
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            If you&apos;ve done internships, completed Big-Four recruiting, or have
            other professional experience, consider becoming a mentor and helping
            other students.
          </p>
          <Link
            href="/apply-mentor"
            className="mt-3 inline-flex items-center justify-center rounded-lg border border-byui-blue/40 bg-white px-4 py-2 text-sm font-bold text-byui-blue-dark transition hover:bg-byui-blue-light/20 cursor-pointer"
          >
            Apply to mentor →
          </Link>
        </section>
      )}

      {/* Career experience — what they told us at signup */}
      {(user.priorCareerChats || user.priorInternshipExperience) && (
        <section className="card">
          <h2 className="font-display text-lg font-bold text-byui-blue-dark">
            Career experience
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            From the questions you answered at signup. Used by admins to track
            program impact over time.
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            {user.priorCareerChats && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">
                  Informational interviews / career chats done
                </dt>
                <dd className="font-semibold text-slate-800">
                  {user.priorCareerChats}
                </dd>
              </div>
            )}
            {user.priorInternshipExperience && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-slate-500">
                  Internships or career-related jobs
                </dt>
                <dd className="font-semibold text-slate-800">
                  {user.priorInternshipExperience}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* Account / security stub */}
      <section className="card">
        <h2 className="font-display text-lg font-bold text-byui-blue-dark">
          Account
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <dt className="text-slate-500">Email</dt>
            <dd className="font-semibold text-slate-800">{user.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Sign-in method</dt>
            <dd className="font-semibold text-slate-800">
              {user.passwordHash ? "Email + password" : "Magic link"}
            </dd>
          </div>
        </dl>
        {!user.passwordHash && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            You currently sign in via a one-time magic link. To switch to a
            password, sign out and use the &ldquo;Create account&rdquo; flow with
            this same email.
          </p>
        )}
        <form action={signOutAction} className="mt-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 cursor-pointer"
          >
            Sign out →
          </button>
        </form>
      </section>
    </div>
  );
}
