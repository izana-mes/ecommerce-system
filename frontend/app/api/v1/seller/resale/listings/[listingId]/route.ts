import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

export async function PUT(request: Request, { params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const response = await fetch(`${backendApiBaseUrl()}/v1/seller/resale/listings/${encodeURIComponent(listingId)}`, { method: "PUT", headers: { ...backendAuthHeaders(request), "Content-Type": "application/json" }, body: JSON.stringify(await request.json()) });
  return NextResponse.json(await response.json(), { status: response.status });
}
