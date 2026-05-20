import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const response = await fetch(`${API_URL}/v1/auth/csrf`, {
    method: "GET",
    headers: {
      ...(cookieHeader ? { Cookie: cookieHeader } : {})}});

  const data = await response.json().catch(() => ({}));
  const out = NextResponse.json(data, { status: response.status });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) out.headers.set("set-cookie", setCookie);
  return out;
}
