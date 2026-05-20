import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/admin", "/dashboard", "/profile", "/seller", "/supplier", "/staff", "/shipper"];
const AUTH_PAGES = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = request.headers.get("x-correlation-id") ?? requestId;
  const hasSessionCookie = Boolean(request.cookies.get("access_token")?.value || request.cookies.get("refresh_token")?.value);

  const protectedPath = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (protectedPath && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("x-request-id", requestId);
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }

  const isAuthPage = AUTH_PAGES.some((prefix) => pathname.startsWith(prefix));
  if (isAuthPage && hasSessionCookie) {
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.headers.set("x-request-id", requestId);
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }

  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-correlation-id", correlationId);
  console.info(JSON.stringify({
    event: "frontend_request",
    requestId,
    correlationId,
    path: pathname,
    method: request.method
  }));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"]};
