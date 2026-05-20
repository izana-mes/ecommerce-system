import { NextRequest, NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { forwardSetCookies } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();

export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  const csrf = request.headers.get("x-xsrf-token");

  const response = await fetch(`${API_URL}/v1/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(csrf ? { "X-XSRF-TOKEN": csrf } : {})}});

  const out = NextResponse.json({ success: response.ok }, { status: response.status });
  forwardSetCookies(response, out);
  return out;
}
