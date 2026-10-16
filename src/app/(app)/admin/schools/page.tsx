import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { schoolDomains, schoolInquiries } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { SchoolsManager } from "./manager";

// Platform-admin only (PLATFORM_ADMIN_EMAILS): which schools' email domains
// can register, plus the inbox of "bring ICAN to your school" requests.
export default async function SchoolsAdminPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!isPlatformAdmin(me)) redirect(me.isAdmin ? "/admin" : "/dashboard");

  const [domains, inquiries] = await Promise.all([
    db.select().from(schoolDomains).orderBy(desc(schoolDomains.createdAt)),
    db.select().from(schoolInquiries).orderBy(desc(schoolInquiries.createdAt)).limit(200),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Platform admin
        </p>
        <h1 className="mt-1 font-display text-2xl font-black text-plum-800 sm:text-3xl">Schools</h1>
        <p className="mt-1 text-sm text-slate-600">
          Add a school&apos;s email domain once they sign on, and follow up on schools that
          asked to join.
        </p>
      </header>
      <SchoolsManager
        domains={domains.map((d) => ({
          domain: d.domain,
          schoolName: d.schoolName,
          active: d.active,
          createdAt: d.createdAt.toISOString(),
        }))}
        inquiries={inquiries.map((q) => ({ ...q, createdAt: q.createdAt.toISOString() }))}
      />
    </div>
  );
}
