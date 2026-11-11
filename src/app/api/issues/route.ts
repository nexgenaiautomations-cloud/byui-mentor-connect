import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { issueReports } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { auditEvent } from "@/lib/audit";
import { ISSUE_CATEGORIES } from "@/lib/issues";
import { notifyAdminsOfIssue } from "@/lib/issues-server";

const schema = z.object({
  category: z.enum(ISSUE_CATEGORIES),
  message: z.string().trim().min(5).max(4000),
});

// Any signed-in user can report an issue. The report is saved, audited,
// emailed to every admin, and pops up for every admin until each one
// acknowledges it (see docs/specs/admin-issue-reports.md).
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = body ? schema.safeParse(body) : null;
  if (!parsed || !parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed?.error?.issues?.[0]?.message ||
          "Tell us a bit more about the issue (at least 5 characters).",
      },
      { status: 400 }
    );
  }
  const { category, message } = parsed.data;

  const [row] = await db
    .insert(issueReports)
    .values({
      userId: me.id,
      category,
      message,
      contactEmail: me.email,
    })
    .returning();

  await auditEvent({
    actorUserId: me.id,
    eventType: "ISSUE_REPORTED",
    request: req,
    metadata: { issueId: row.id, category },
  });

  try {
    await notifyAdminsOfIssue(row, me, new URL(req.url).origin);
  } catch (e) {
    // Non-fatal: the report is saved and will pop up for every admin.
    console.error("issue-report admin email failed:", e);
  }

  return NextResponse.json({ ok: true, id: row.id });
}
