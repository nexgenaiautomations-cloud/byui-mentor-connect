import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db/client";
import { issueReports } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

const ISSUE_CATEGORIES = ["it", "mentor", "mentee", "other"] as const;

const schema = z.object({
  category: z.enum(ISSUE_CATEGORIES),
  message: z.string().trim().min(5).max(4000),
});

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

  // Notify the admin inbox if ISSUE_REPORT_TO + AUTH_RESEND_KEY are set.
  // Failure here is non-fatal — the report is already saved.
  const apiKey = process.env.AUTH_RESEND_KEY;
  const to = process.env.ISSUE_REPORT_TO;
  if (apiKey && to) {
    try {
      const h = await headers();
      const host = h.get("host") ?? "byui-can";
      const from =
        process.env.EMAIL_FROM ?? "BYUI CAN <noreply@byuican.com>";
      const labelMap: Record<string, string> = {
        it: "IT issue",
        mentor: "Issue with my mentor",
        mentee: "Issue with a mentee",
        other: "Other",
      };
      const subject = `BYUI CAN issue report — ${labelMap[category] ?? category}`;
      const text = [
        `Category: ${labelMap[category] ?? category}`,
        `From: ${me.name ?? me.email} <${me.email}>`,
        `Role: ${me.isAdmin ? "Admin" : me.isMentor ? "Mentor" : "Member"}`,
        `Reported at: ${row.createdAt.toISOString()}`,
        `Host: ${host}`,
        "",
        "Message:",
        message,
      ].join("\n");
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to,
          reply_to: me.email,
          subject,
          text,
          headers: { "X-Entity-Ref-ID": "byuican-issue-report" },
        }),
      });
    } catch (e) {
      console.error("issue-report email failed:", e);
    }
  }

  return NextResponse.json({ ok: true, id: row.id });
}
