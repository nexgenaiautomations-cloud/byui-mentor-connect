import { redirect } from "next/navigation";
import { Sidebar, MobileBar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { PendingRequestBanner } from "@/components/pending-request-banner";
import { getCurrentUser } from "@/lib/session";
import { availableRoles } from "@/lib/roles";
import { readActiveRole } from "@/lib/roles-server";
import { IndependenceNotice } from "@/components/independence-notice";
import { needsAgreement } from "@/lib/agreements";
import { isPlatformAdmin } from "@/lib/platform-admin";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Disclaimers are acknowledged before any profile setup or app use.
  if (needsAgreement(user)) redirect("/agreements");
  const activeRole = await readActiveRole(user);
  const roles = availableRoles(user);
  return (
    <div className="relative min-h-screen">
      {/* Full-viewport mountain backdrop with the brand-purple tint baked in.
          Anchored toward the top so the summit clears the white content card. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/app-backdrop.jpg"
        alt=""
        aria-hidden
        className="fixed inset-0 -z-10 h-full w-full object-cover"
        style={{ objectPosition: "36% top" }}
      />

      {user.isMentor && activeRole === "mentor" && (
        <PendingRequestBanner userId={user.id} />
      )}

      {/* Sidebar — pinned to viewport so sign out is always reachable */}
      <Sidebar
        user={user}
        activeRole={activeRole}
        availableRoles={roles}
        isPlatformAdmin={isPlatformAdmin(user)}
      />

      {/* Right column — offset for the pinned sidebar on lg+ */}
      <div className="flex min-h-screen min-w-0 flex-col lg:pl-64">
        <TopBar user={user} activeRole={activeRole} availableRoles={roles} />
        <main className="flex-1 p-2 pb-24 lg:p-6 lg:pb-8">
          <div className="rounded-2xl bg-slate-50 px-4 py-5 shadow-lift lg:rounded-3xl lg:px-8 lg:py-6">
            <div className="mx-auto max-w-6xl">{children}</div>
          </div>
          <IndependenceNotice
            tone="dark"
            className="mx-auto mt-4 max-w-3xl px-2 text-center [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]"
          />
        </main>
      </div>

      <MobileBar activeRole={activeRole} />
    </div>
  );
}
