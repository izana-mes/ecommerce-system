import { NextResponse } from "next/server";
import {
  applyAttendanceAction,
  AttendanceAction,
  getAttendanceSnapshot,
  resolveEmployeeFromRequest,
} from "@/lib/attendance";

type AttendancePostRequest = {
  action?: AttendanceAction;
  note?: string;
};

function getStatusCode(message: string): number {
  const normalized = message.toLowerCase();
  if (normalized.includes("forbidden")) return 403;
  if (normalized.includes("missing authentication") || normalized.includes("unable to resolve authenticated")) {
    return 401;
  }
  if (
    normalized.includes("already") ||
    normalized.includes("no active") ||
    normalized.includes("no active break")
  ) {
    return 409;
  }
  return 400;
}

export async function GET(request: Request) {
  try {
    const employee = await resolveEmployeeFromRequest(request);
    const snapshot = await getAttendanceSnapshot(employee);
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch attendance snapshot.";
    console.error("GET /api/attendance error:", message);
    return NextResponse.json({ error: message }, { status: getStatusCode(message) });
  }
}

export async function POST(request: Request) {
  try {
    const employee = await resolveEmployeeFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as AttendancePostRequest;
    const action = body.action;

    if (!action || !["clock_in", "clock_out", "start_break", "end_break"].includes(action)) {
      return NextResponse.json(
        {
          error: "Invalid action. Use one of: clock_in, clock_out, start_break, end_break.",
        },
        { status: 400 }
      );
    }

    const snapshot = await applyAttendanceAction(employee, action, body.note);
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Attendance action failed.";
    console.error("POST /api/attendance error:", message);
    return NextResponse.json({ error: message }, { status: getStatusCode(message) });
  }
}
