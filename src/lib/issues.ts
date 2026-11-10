// Pure helpers for user-submitted issue reports. Every admin must personally
// acknowledge every issue (a receipt row per admin per issue); "addressed" is
// a separate issue-level status. See docs/specs/admin-issue-reports.md.

export const ISSUE_CATEGORIES = ["it", "mentor", "mentee", "other"] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const ISSUE_STATUSES = ["open", "addressed"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  it: "IT issue",
  mentor: "Issue with a mentor",
  mentee: "Issue with a mentee",
  other: "Other",
};

export function categoryLabel(category: string): string {
  return isIssueCategory(category) ? CATEGORY_LABELS[category] : category;
}

export function isIssueCategory(v: string): v is IssueCategory {
  return (ISSUE_CATEGORIES as readonly string[]).includes(v);
}

export function isIssueStatus(v: string): v is IssueStatus {
  return (ISSUE_STATUSES as readonly string[]).includes(v);
}

type Receipt = { issueId: string; adminId: string };

// Issues this admin has not acknowledged yet, oldest first so the popup works
// through the backlog in the order things were reported. Addressed issues are
// included: every admin must confirm they saw every issue.
export function unacknowledgedFor<T extends { id: string; createdAt: Date }>(
  adminId: string,
  issues: T[],
  receipts: Receipt[]
): T[] {
  const seen = new Set(
    receipts.filter((r) => r.adminId === adminId).map((r) => r.issueId)
  );
  return issues
    .filter((i) => !seen.has(i.id))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

// Who has / hasn't seen one issue. `seen` keeps receipts from people who are
// no longer admins, since the record of them seeing it still matters.
export function acknowledgementSummary<
  A extends { id: string },
  R extends Receipt & { seenAt: Date },
>(issueId: string, admins: A[], receipts: R[]) {
  const seen = receipts
    .filter((r) => r.issueId === issueId)
    .sort((a, b) => a.seenAt.getTime() - b.seenAt.getTime());
  const seenIds = new Set(seen.map((r) => r.adminId));
  const notSeen = admins.filter((a) => !seenIds.has(a.id));
  return { seen, notSeen };
}
