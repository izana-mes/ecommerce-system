import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders, forwardSetCookies } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();

function cookieHeaderForRetry(request: Request, refreshResponse: Response): string | null {
  const baseCookie = request.headers.get("cookie") ?? "";
  const merged = new Map<string, string>();

  for (const part of baseCookie.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    merged.set(trimmed.slice(0, eqIndex), trimmed.slice(eqIndex + 1));
  }

  const setCookies =
    typeof refreshResponse.headers.getSetCookie === "function"
      ? refreshResponse.headers.getSetCookie()
      : [];
  for (const cookie of setCookies) {
    const firstPart = cookie.split(";")[0]?.trim();
    if (!firstPart) continue;
    const eqIndex = firstPart.indexOf("=");
    if (eqIndex <= 0) continue;
    merged.set(firstPart.slice(0, eqIndex), firstPart.slice(eqIndex + 1));
  }

  if (merged.size === 0) return null;
  return Array.from(merged.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

export async function GET(request: Request) {
  const response = await fetch(`${API_URL}/v1/auth/me`, {
    method: "GET",
    headers: backendAuthHeaders(request),
  });

  const initialPayload = await response.json().catch(() => ({}));
  const initialProfile = initialPayload?.data;
  if (response.ok && initialProfile?.email) {
    return NextResponse.json(initialPayload, { status: response.status });
  }

  const refreshResponse = await fetch(`${API_URL}/v1/auth/refresh`, {
    method: "POST",
    headers: backendAuthHeaders(request),
  });
  if (!refreshResponse.ok) {
    return NextResponse.json(initialPayload, { status: response.status });
  }

  const retryCookieHeader = cookieHeaderForRetry(request, refreshResponse);
  const retriedMeResponse = await fetch(`${API_URL}/v1/auth/me`, {
    method: "GET",
    headers: {
      ...backendAuthHeaders(request),
      ...(retryCookieHeader ? { Cookie: retryCookieHeader } : {}),
    },
  });
  const retriedPayload = await retriedMeResponse.json().catch(() => ({}));
  const out = NextResponse.json(retriedPayload, { status: retriedMeResponse.status });
  forwardSetCookies(refreshResponse, out);
  return out;
}
