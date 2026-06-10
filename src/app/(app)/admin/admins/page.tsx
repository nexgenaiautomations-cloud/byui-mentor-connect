import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { AdminManager } from "./manager";

export default async function ManageAdminsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");
  if (!me.isHeadAdmin) {
    // Non-head admins can see the admin overview but not this page.
    redirect("/admin");
  }

  const admins = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      isHeadAdmin: users.isHeadAdmin,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.isAdmin, true))
    .orderBy(desc(users.isHeadAdmin), desc(users.createdAt));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Head admin
        </p>
        <h1 className="mt-1 font-display text-2xl font-black text-navy-800 sm:text-3xl">
          Manage admins
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Promote new admins by BYU-I email, demote anyone who&apos;s stepping
          down, or pass the head-admin role to a successor.
        </p>
      </header>

      <AdminManager
        currentUserId={me.id}
        admins={admins.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
