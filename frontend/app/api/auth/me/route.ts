import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const response = await fetch(`${API_URL}/v1/auth/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {})}});

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
