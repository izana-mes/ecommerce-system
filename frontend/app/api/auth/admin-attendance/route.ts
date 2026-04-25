import { NextResponse } from "next/server";
import { getAdminAttendanceSnapshot, resolveAdminFromRequest } from "@/lib/attendance";

function getStatusCode(message: string): number {
  const normalized = message.toLowerCase();
  if (normalized.includes("forbidden")) return 403;
  if (normalized.includes("missing authentication") || normalized.includes("unable to resolve authenticated")) {
    return 401;
  }
  return 400;
}

export async function GET(request: Request) {
  try {
    await resolveAdminFromRequest(request);

    const { searchParams } = new URL(request.url);
    const snapshot = await getAdminAttendanceSnapshot({
      query: searchParams.get("query") || "",
      status: (searchParams.get("status") || "all") as "all" | "active" | "on_break" | "closed",
      dateFrom: searchParams.get("dateFrom") || "",
      dateTo: searchParams.get("dateTo") || "",
      limit: Number(searchParams.get("limit") || 50),
    });

    return NextResponse.json(snapshot, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch attendance dashboard.";
    console.error("GET /api/auth/admin-attendance error:", message);
    return NextResponse.json({ error: message }, { status: getStatusCode(message) });
  }
}
