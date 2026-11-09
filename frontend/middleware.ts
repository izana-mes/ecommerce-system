import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MANAGEMENT_HOME: Record<string, string> = {
  admin: "/admin",
  seller: "/seller/dashboard",
  supplier: "/supplier/dashboard",
  shipper: "/shipper/dashboard",
  employee: "/staff",
};
const MANAGEMENT_PREFIXES = ["/admin", "/seller", "/supplier", "/shipper", "/staff"];
const CUSTOMER_ONLY_PREFIXES = [
  "/shop", "/store", "/cart", "/wishlist", "/orders", "/track", "/coupons",
  "/payment", "/about", "/blog", "/blog-details", "/contact", "/terms", "/experience",
];
const ACCOUNT_PATHS = ["/profile", "/notifications"];

function under(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

async function readRole(request: NextRequest): Promise<string | null> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const base = (process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api").replace(/\/+$/, "");
  try {
    const response = await fetch(`${base}/v1/auth/me`, {
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const rawRole = typeof payload?.data?.role === "string" ? payload.data.role.toLowerCase() : "";
    const normalizedRole = rawRole.replace(/^role_/, "");
    if (MANAGEMENT_HOME[normalizedRole] || normalizedRole === "user") return normalizedRole;
    const roles = Array.isArray(payload?.data?.roles) ? payload.data.roles.map((item: unknown) => String(item).toLowerCase().replace(/^role_/, "")) : [];
    return roles.find((item: string) => MANAGEMENT_HOME[item]) || (roles.includes("user") ? "user" : null);
  } catch {
    return null;
  }
}

function redirect(request: NextRequest, pathname: string, requestId: string, correlationId: string) {
  const response = NextResponse.redirect(new URL(pathname, request.url));
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-correlation-id", correlationId);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = request.headers.get("x-correlation-id") ?? requestId;
  const hasSessionCookie = Boolean(request.cookies.get("access_token")?.value);
  const role = hasSessionCookie ? await readRole(request) : null;
  const isManagement = under(pathname, MANAGEMENT_PREFIXES);
  const isCustomerOnly = under(pathname, CUSTOMER_ONLY_PREFIXES);
  const isAuthPage = pathname === "/login" || pathname === "/resetPassword";

  if ((isManagement || ACCOUNT_PATHS.includes(pathname)) && !role) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return redirect(request, `${loginUrl.pathname}${loginUrl.search}`, requestId, correlationId);
  }

  if (role && MANAGEMENT_HOME[role]) {
    const sharedManagementPaths = ["/messages", "/workspace", "/support-chat"];
    const isSharedManagementPath = sharedManagementPaths.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
      (role === "shipper" && pathname.startsWith("/staff/support-chat"));
    if (isCustomerOnly || pathname === "/" || pathname === "/landing" || (!isManagement && !ACCOUNT_PATHS.includes(pathname) && !isSharedManagementPath)) {
      return redirect(request, MANAGEMENT_HOME[role], requestId, correlationId);
    }
    if (isManagement) {
      const ownPrefix = MANAGEMENT_HOME[role].split("/")[1];
      const roleAllowed = pathname === `/${ownPrefix}` || pathname.startsWith(`/${ownPrefix}/`) ||
        (role === "shipper" && pathname === "/staff/support-chat") ||
        (role === "admin" && ACCOUNT_PATHS.includes(pathname)) ||
        (role === "employee" && pathname.startsWith("/staff"));
      if (!roleAllowed) return redirect(request, MANAGEMENT_HOME[role], requestId, correlationId);
    }
    if (ACCOUNT_PATHS.includes(pathname) && role !== "admin" && role !== "employee") {
      // Account pages are rendered inside the management chrome for these roles.
    }
  } else if (role === "user" && isManagement) {
    return redirect(request, "/", requestId, correlationId);
  }

  if (isAuthPage && role) {
    if (role === "user") {
      const requested = request.nextUrl.searchParams.get("returnTo")?.trim() || "";
      const safeReturnTo = requested.startsWith("/") && !requested.startsWith("//") && !requested.startsWith("/login") ? requested : "/";
      return redirect(request, safeReturnTo, requestId, correlationId);
    }
    return redirect(request, MANAGEMENT_HOME[role] || "/", requestId, correlationId);
  }

  const requestHeaders = new Headers(request.headers);
  if (role) requestHeaders.set("x-app-role", role);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-correlation-id", correlationId);
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"] };
