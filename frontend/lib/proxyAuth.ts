import { NextResponse } from "next/server";

/** Forward session cookies from the browser to Spring backend calls in Next.js route handlers. */
export function getCookieHeader(request: Request): string | null {
  return request.headers.get("cookie");
}

/** Read Spring CSRF cookie when the browser did not send X-XSRF-TOKEN on the BFF request. */
function readCsrfFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith("XSRF-TOKEN=")) {
      return decodeURIComponent(trimmed.slice("XSRF-TOKEN=".length));
    }
  }
  return null;
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
  const csrf =
    request.headers.get("x-xsrf-token") ??
    request.headers.get("X-XSRF-TOKEN") ??
    readCsrfFromCookieHeader(cookie);
  return {
    "Content-Type": "application/json",
    ...(cookie ? { Cookie: cookie } : {}),
    ...(csrf ? { "X-XSRF-TOKEN": csrf } : {}),
    ...extra,
  };
}

/** Clear Spring auth cookies on the browser when ending a session from a BFF route. */
export function clearSessionCookies(response: NextResponse): void {
  const secure = process.env.AUTH_COOKIE_SECURE === "true";
  const common = {
    maxAge: 0,
    path: "/",
    sameSite: "lax" as const,
    secure,
  };
  response.cookies.set("access_token", "", { ...common, httpOnly: true });
  response.cookies.set("refresh_token", "", {
    ...common,
    httpOnly: true,
    path: "/api/v1/auth",
  });
  response.cookies.set("XSRF-TOKEN", "", { ...common, httpOnly: false });
}
