import { redirect } from "next/navigation";
import { Sidebar, MobileBar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { PendingRequestBanner } from "@/components/pending-request-banner";
import { getCurrentUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="relative flex min-h-screen">
      {/* Fixed campus photo behind everything */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/byui-campus.jpg"
        alt=""
        aria-hidden
        className="fixed inset-0 -z-20 h-full w-full object-cover"
      />
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-navy-900/75 via-navy-900/72 to-navy-900/85" />

      {user.isMentor && <PendingRequestBanner userId={user.id} />}
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} />
        {/* Content panel: light surface so dark text has full contrast.
            Campus shows in the margin around it. */}
        <main className="flex-1 p-3 pb-24 lg:p-5 lg:pb-6">
          <div className="rounded-3xl bg-slate-50 px-5 py-8 shadow-lift lg:px-8 lg:py-10">
            <div className="mx-auto max-w-6xl">{children}</div>
          </div>
        </main>
      </div>
      <MobileBar user={user} />
    </div>
  );
}
