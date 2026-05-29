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
      {/* Full-viewport clock tower bg. Anchored so the tower lands inside
          the sidebar column (left) and the navy sky frames the main panel. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/byui-bg.jpg"
        alt=""
        aria-hidden
        className="fixed inset-0 -z-10 h-full w-full object-cover"
        style={{ objectPosition: "12% center" }}
      />

      {user.isMentor && <PendingRequestBanner userId={user.id} />}
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} />
        {/* Cards/content panel — opaque cream so dark text reads. Generous
            margin so navy sky shows around the panel like in the PDF. */}
        <main className="flex-1 p-4 pb-24 lg:p-8 lg:pb-10">
          <div className="rounded-3xl bg-slate-50 px-5 py-8 shadow-lift lg:px-10 lg:py-10">
            <div className="mx-auto max-w-6xl">{children}</div>
          </div>
        </main>
      </div>
      <MobileBar user={user} />
    </div>
  );
}
