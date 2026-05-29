import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { getCurrentUser } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="min-h-screen bg-slate-50">
      <Nav user={user} />
      <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
    </div>
  );
}
