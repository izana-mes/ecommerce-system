import { NextRequest, NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import {
  backendAuthHeaders,
  clearSessionCookies,
  forwardSetCookies,
} from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();

export async function POST(request: NextRequest) {
  const response = await fetch(`${API_URL}/v1/auth/logout`, {
    method: "POST",
    headers: backendAuthHeaders(request),
  });

  const out = NextResponse.json({ success: true }, { status: 200 });
  forwardSetCookies(response, out);
  clearSessionCookies(out);
  return out;
}
