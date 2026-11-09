import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const response = await fetch(`${backendApiBaseUrl()}/v1/admin/resale/requests/${encodeURIComponent(requestId)}/approve`, { method: "POST", headers: { ...backendAuthHeaders(request), "Content-Type": "application/json" }, body: JSON.stringify(await request.json()) });
  return NextResponse.json(await response.json(), { status: response.status });
}
