import { NextResponse } from "next/server";
import {
  dbFailureResponse,
  isStaffOrAdmin,
  listConversationsForStaff,
  resolveViewerProfile,
} from "../_shared";

export async function GET(request: Request) {
  try {
    const profile = await resolveViewerProfile(request);
    if (!isStaffOrAdmin(profile)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 30);

    const conversations = await listConversationsForStaff(limit);
    return NextResponse.json({ conversations });
  } catch (error: unknown) {
    return NextResponse.json(dbFailureResponse(error), { status: 500 });
  }
}
