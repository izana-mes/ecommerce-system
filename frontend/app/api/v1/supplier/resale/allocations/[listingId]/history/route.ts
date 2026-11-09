import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

export async function GET(request: Request, context: { params: Promise<{ listingId: string }> }) {
  try {
    const { listingId } = await context.params;
    const response = await fetch(
      `${backendApiBaseUrl()}/v1/supplier/resale/allocations/${encodeURIComponent(listingId)}/history`,
      { headers: backendAuthHeaders(request), cache: "no-store" }
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
