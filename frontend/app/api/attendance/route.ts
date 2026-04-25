import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

type AttendancePostRequest = {
  action?: "clock_in" | "clock_out" | "start_break" | "end_break";
  note?: string;
};

async function proxyAttendance(request: Request, init?: RequestInit) {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const cookieHeader = request.headers.get("cookie");

  const response = await fetch(`${backendApiBaseUrl()}/attendance`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}

export async function GET(request: Request) {
  try {
    return await proxyAttendance(request, { method: "GET" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch attendance snapshot.";
    console.error("GET /api/attendance error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as AttendancePostRequest;
    return await proxyAttendance(request, {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Attendance action failed.";
    console.error("POST /api/attendance error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
