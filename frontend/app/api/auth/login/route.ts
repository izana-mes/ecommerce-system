import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { forwardSetCookies } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();

export async function POST(request: Request) {
  const body = await request.json();
  const response = await fetch(`${API_URL}/v1/auth/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)});

  const data = await response.json().catch(() => ({}));
  const out = NextResponse.json(data, { status: response.status });
  forwardSetCookies(response, out);
  return out;
}
