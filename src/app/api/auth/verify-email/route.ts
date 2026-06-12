import { NextResponse } from "next/server";
import { consumeVerifyToken } from "@/lib/email-verification";

// Verification link the user clicks in their inbox. Single-use, expires
// after VERIFY_TOKEN_TTL_MS. Lands the user on the login page with a
// status query param so the form can show the right banner.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const email = url.searchParams.get("email") ?? "";
  const origin = url.origin;

  if (!token || !email) {
    return NextResponse.redirect(`${origin}/login?verify=invalid`);
  }

  const result = await consumeVerifyToken(email, token);
  if (!result.ok) {
    if (result.reason === "expired") {
      return NextResponse.redirect(`${origin}/login?verify=expired&email=${encodeURIComponent(email)}`);
    }
    return NextResponse.redirect(`${origin}/login?verify=invalid&email=${encodeURIComponent(email)}`);
  }

  return NextResponse.redirect(
    `${origin}/login?verify=ok&email=${encodeURIComponent(result.email)}`
  );
}
