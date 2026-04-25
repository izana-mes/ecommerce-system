import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const cookieHeader = request.headers.get("cookie");
    const response = await fetch(`${backendApiBaseUrl()}/admin/attendance?${searchParams.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch attendance dashboard.";
    console.error("GET /api/auth/admin-attendance error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
