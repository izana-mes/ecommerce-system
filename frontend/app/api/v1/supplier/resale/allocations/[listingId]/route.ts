import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";
export async function GET(request: Request, context: { params: Promise<{ listingId: string }> }) {
  try { const { listingId } = await context.params; const response = await fetch(`${backendApiBaseUrl()}/v1/supplier/resale/allocations/${encodeURIComponent(listingId)}/history`, { headers: backendAuthHeaders(request), cache: "no-store" }); return NextResponse.json(await response.json(), { status: response.status }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}
export async function PUT(request: Request, context: { params: Promise<{ listingId: string }> }) {
  try { const { listingId } = await context.params; const response = await fetch(`${backendApiBaseUrl()}/v1/supplier/resale/allocations/${encodeURIComponent(listingId)}`, { method: "PUT", headers: { ...backendAuthHeaders(request), "Content-Type": "application/json" }, body: await request.text(), cache: "no-store" }); return NextResponse.json(await response.json(), { status: response.status }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}
