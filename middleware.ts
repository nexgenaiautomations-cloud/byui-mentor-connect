import { auth } from "./auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/login/check-email", "/about"];
const PUBLIC_PREFIXES = ["/api/auth", "/_next", "/favicon"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return;
  if (PUBLIC_PATHS.includes(pathname)) return;

  if (!req.auth) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
