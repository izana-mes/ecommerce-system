import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;
    if (!requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }

    const response = await fetch(
      `${API_URL}/products/change-requests/${encodeURIComponent(requestId)}/resubmit`,
      {
        method: "POST",
        headers: backendAuthHeaders(request),
        cache: "no-store",
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "Failed to resubmit product change request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
