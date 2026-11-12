import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { issueReportReceipts, issueReports, users } from "@/db/schema";
import type { User } from "@/db/schema";
import { auditEvent } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { categoryLabel } from "@/lib/issues";
import { emailInScope, emailInScopeJs, type AdminScope } from "@/lib/admin-scope";
import { schoolOf } from "@/lib/school-scope";
import { sql } from "drizzle-orm";

// An issue belongs to its reporter's school. Issues whose reporter account
// is gone have no school and are visible to platform admins only.
function issueScopeCond(scope: AdminScope) {
  return scope.school === null ? sql`true` : emailInScope(users.email, scope);
}

export async function listAdmins(scope?: AdminScope) {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.isAdmin, true), scope ? emailInScope(users.email, scope) : sql`true`))
    .orderBy(asc(users.name));
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function roleOf(u: Pick<User, "isAdmin" | "isMentor">) {
  return u.isAdmin ? "Admin" : u.isMentor ? "Mentor" : "Member";
}

// Email every admin (and the optional ISSUE_REPORT_TO inbox) about a new
// issue. Best-effort: the report is already saved and will pop up for every
// admin in-app regardless of email delivery.
export async function notifyAdminsOfIssue(
  issue: { id: string; category: string; message: string; createdAt: Date },
  reporter: Pick<User, "name" | "email" | "isAdmin" | "isMentor">,
  origin: string
) {
  // Only the reporter's own school's admins (plus ISSUE_REPORT_TO, which is
  // the platform operator's inbox) hear about it.
  const school = schoolOf(reporter.email);
  const admins = school ? await listAdmins({ school, platform: false }) : [];
  const recipients = new Set(admins.map((a) => a.email.toLowerCase()));
  if (process.env.ISSUE_REPORT_TO) {
    for (const e of process.env.ISSUE_REPORT_TO.split(",")) {
      if (e.trim()) recipients.add(e.trim().toLowerCase());
    }
  }

  const label = categoryLabel(issue.category);
  const who = `${reporter.name ?? reporter.email} <${reporter.email}>`;
  const link = `${origin}/admin/issues`;
  const subject = `ICAN issue reported: ${label}`;
  const text = [
    `A new issue was reported in ICAN. Every admin must acknowledge it.`,
    "",
    `Category: ${label}`,
    `From: ${who} (${roleOf(reporter)})`,
    `Reported at: ${issue.createdAt.toISOString()}`,
    "",
    "Message:",
    issue.message,
    "",
    `Review and acknowledge: ${link}`,
  ].join("\n");
  const html = `
    <p>A new issue was reported in ICAN. <strong>Every admin must acknowledge it.</strong></p>
    <p><strong>Category:</strong> ${escapeHtml(label)}<br/>
    <strong>From:</strong> ${escapeHtml(who)} (${roleOf(reporter)})<br/>
    <strong>Reported at:</strong> ${issue.createdAt.toISOString()}</p>
    <p style="white-space:pre-wrap;border-left:3px solid #5b2a86;padding-left:12px">${escapeHtml(issue.message)}</p>
    <p><a href="${escapeHtml(link)}">Review and acknowledge the issue</a></p>`;

  const results = await Promise.allSettled(
    [...recipients].map((to) =>
      sendEmail({
        to,
        subject,
        text,
        html,
        replyTo: reporter.email,
        refId: `ican-issue-${issue.id}`,
      })
    )
  );
  const failed = results.filter(
    (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)
  ).length;
  if (failed) console.error(`issue ${issue.id}: ${failed}/${results.length} admin emails failed`);
}

// Issues this admin has not acknowledged, oldest first, for the login popup.
export async function pendingIssuesForAdmin(adminId: string, scope: AdminScope) {
  const reporter = users;
  return db
    .select({
      id: issueReports.id,
      category: issueReports.category,
      message: issueReports.message,
      status: issueReports.status,
      createdAt: issueReports.createdAt,
      reporterName: reporter.name,
      reporterEmail: reporter.email,
    })
    .from(issueReports)
    .leftJoin(reporter, eq(reporter.id, issueReports.userId))
    .leftJoin(
      issueReportReceipts,
      and(
        eq(issueReportReceipts.issueId, issueReports.id),
        eq(issueReportReceipts.adminId, adminId)
      )
    )
    .where(and(isNull(issueReportReceipts.issueId), issueScopeCond(scope)))
    .orderBy(asc(issueReports.createdAt));
}

export async function listIssuesNewestFirst(scope: AdminScope) {
  return db
    .select({
      id: issueReports.id,
      category: issueReports.category,
      message: issueReports.message,
      status: issueReports.status,
      createdAt: issueReports.createdAt,
      addressedAt: issueReports.addressedAt,
      addressedById: issueReports.addressedById,
      resolutionNote: issueReports.resolutionNote,
      reporterId: users.id,
      reporterName: users.name,
      reporterEmail: users.email,
      reporterIsAdmin: users.isAdmin,
      reporterIsMentor: users.isMentor,
    })
    .from(issueReports)
    .leftJoin(users, eq(users.id, issueReports.userId))
    .where(issueScopeCond(scope))
    .orderBy(desc(issueReports.createdAt));
}

export async function listReceipts(scope: AdminScope) {
  return db
    .select({
      issueId: issueReportReceipts.issueId,
      adminId: issueReportReceipts.adminId,
      seenAt: issueReportReceipts.seenAt,
      adminName: users.name,
      adminEmail: users.email,
    })
    .from(issueReportReceipts)
    .leftJoin(users, eq(users.id, issueReportReceipts.adminId))
    .where(scope.school === null ? sql`true` : emailInScope(users.email, scope));
}

export type AcknowledgeResult = "ok" | "not_found";

// Record that `admin` saw the issue; with `addressed`, also mark the issue
// addressed. Idempotent: a second "seen" keeps the original time.
export async function acknowledgeIssue(
  issueId: string,
  admin: Pick<User, "id">,
  action: "seen" | "addressed",
  note: string | null,
  request: Request | undefined,
  scope: AdminScope
): Promise<AcknowledgeResult> {
  const [issue] = await db
    .select({ id: issueReports.id, category: issueReports.category, status: issueReports.status, reporterEmail: users.email })
    .from(issueReports)
    .leftJoin(users, eq(users.id, issueReports.userId))
    .where(eq(issueReports.id, issueId))
    .limit(1);
  if (!issue) return "not_found";
  if (scope.school !== null && !emailInScopeJs(issue.reporterEmail, scope)) return "not_found";

  const inserted = await db
    .insert(issueReportReceipts)
    .values({ issueId, adminId: admin.id })
    .onConflictDoNothing()
    .returning({ issueId: issueReportReceipts.issueId });
  if (inserted.length) {
    await auditEvent({
      actorUserId: admin.id,
      eventType: "ADMIN_ACKNOWLEDGED_ISSUE",
      request,
      metadata: { issueId, category: issue.category },
    });
  }

  if (action === "addressed" && issue.status !== "addressed") {
    await db
      .update(issueReports)
      .set({
        status: "addressed",
        addressedAt: new Date(),
        addressedById: admin.id,
        resolutionNote: note,
      })
      .where(eq(issueReports.id, issueId));
    await auditEvent({
      actorUserId: admin.id,
      eventType: "ADMIN_ADDRESSED_ISSUE",
      request,
      metadata: { issueId, category: issue.category },
    });
  }
  return "ok";
}
