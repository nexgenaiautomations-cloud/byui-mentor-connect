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
      {/* Fixed campus background — sits behind everything */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/campus-hero.jpg"
        alt=""
        aria-hidden
        className="fixed inset-0 -z-20 h-full w-full object-cover"
      />
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-navy-900/85 via-navy-900/80 to-navy-900/90" />

      {user.isMentor && <PendingRequestBanner userId={user.id} />}
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} />
        <main className="flex-1 px-5 pb-24 pt-6 lg:px-10 lg:pb-10">{children}</main>
      </div>
      <MobileBar user={user} />
    </div>
  );
}
