import { NextResponse, after } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { schoolInquiries } from "@/db/schema";
import { limitSchoolInquiry } from "@/lib/rate-limit";
import { schoolInquirySchema, renderSchoolInquiryEmail } from "@/lib/school-inquiry";
import { sendEmail } from "@/lib/email";

// Where school inquiries are delivered. Defaults to the program owner's
// public contact address (also listed on /privacy).
const INQUIRY_TO = process.env.SCHOOL_INQUIRY_TO ?? "GabrielD@nexgenaiintegrations.com";

// Public "bring ICAN to your school" form. Stored so nothing is lost if the
// notification email is delayed, then forwarded to the ICAN team.
export async function POST(req: Request) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;

  const rl = await limitSchoolInquiry(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests from this network. Please try again in an hour." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schoolInquirySchema.safeParse(body);
  if (!parsed.success) {
    const first =
      Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "Please check the form and try again.";
    return NextResponse.json({ error: first }, { status: 400 });
  }
  const { website: _honeypot, ...inquiry } = parsed.data;

  await db.insert(schoolInquiries).values({
    contactName: inquiry.contactName,
    contactEmail: inquiry.contactEmail,
    schoolName: inquiry.schoolName,
    role: inquiry.role || null,
    emailDomain: inquiry.emailDomain || null,
    message: inquiry.message || null,
  });

  after(async () => {
    const { subject, html, text } = renderSchoolInquiryEmail(inquiry);
    const res = await sendEmail({
      to: INQUIRY_TO,
      subject,
      html,
      text,
      replyTo: inquiry.contactEmail,
      refId: `ican-school-inquiry-${Date.now()}`,
    });
    if (!res.ok) console.error("[school-inquiry] notification failed:", res.error);
  });

  return NextResponse.json({ ok: true });
}
