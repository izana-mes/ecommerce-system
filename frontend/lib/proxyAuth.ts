import { NextResponse } from "next/server";

/** Forward session cookies from the browser to Spring backend calls in Next.js route handlers. */
export function getCookieHeader(request: Request): string | null {
  return request.headers.get("cookie");
}

/** Spring sends multiple Set-Cookie headers (access, refresh, XSRF); get() only keeps one. */
export function forwardSetCookies(source: Response, target: NextResponse): void {
  const cookies =
    typeof source.headers.getSetCookie === "function"
      ? source.headers.getSetCookie()
      : [];
  if (cookies.length > 0) {
    for (const cookie of cookies) {
      target.headers.append("set-cookie", cookie);
    }
    return;
  }
  const single = source.headers.get("set-cookie");
  if (single) {
    target.headers.set("set-cookie", single);
  }
}

export function backendAuthHeaders(
  request: Request,
  extra?: Record<string, string>
): Record<string, string> {
  const cookie = getCookieHeader(request);
  const csrf = request.headers.get("x-xsrf-token");
  return {
    "Content-Type": "application/json",
    ...(cookie ? { Cookie: cookie } : {}),
    ...(csrf ? { "X-XSRF-TOKEN": csrf } : {}),
    ...extra,
  };
}
