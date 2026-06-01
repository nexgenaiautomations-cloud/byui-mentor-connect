import { redirect } from "next/navigation";
import { Sidebar, MobileBar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { PendingRequestBanner } from "@/components/pending-request-banner";
import { getCurrentUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="relative min-h-screen">
      {/* Full-viewport clock tower bg. Anchored so the tower lands inside
          the sidebar column (left). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/byui-bg.jpg"
        alt=""
        aria-hidden
        className="fixed inset-0 -z-10 h-full w-full object-cover"
        style={{ objectPosition: "12% center" }}
      />

      {user.isMentor && <PendingRequestBanner userId={user.id} />}

      {/* Sidebar — pinned to viewport so sign out is always reachable */}
      <Sidebar user={user} />

      {/* Right column — offset for the pinned sidebar on lg+ */}
      <div className="flex min-h-screen min-w-0 flex-col lg:pl-64">
        <TopBar user={user} />
        <main className="flex-1 p-2 pb-20 lg:p-6 lg:pb-8">
          <div className="rounded-2xl bg-slate-50 px-4 py-5 ring-2 ring-gold-400 lg:rounded-3xl lg:px-8 lg:py-6 lg:ring-4">
            <div className="mx-auto max-w-6xl">{children}</div>
          </div>
        </main>
      </div>

      <MobileBar user={user} />
    </div>
  );
}
