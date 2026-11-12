import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { adminScopeFor } from "@/lib/admin-scope";
import { detectInterventions } from "@/lib/interventions-server";

// "Refresh now" on the Intervention Center. The daily cron does the same
// for every school.
export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  const scope = adminScopeFor(admin)!;
  const result = await detectInterventions(new Date(), scope.school);
  return NextResponse.json(result);
}

