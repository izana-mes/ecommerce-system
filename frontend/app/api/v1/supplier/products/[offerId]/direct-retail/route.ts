import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";
export async function PUT(request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  try {
    const { offerId } = await params;
    const response = await fetch(`${backendApiBaseUrl()}/v1/supplier/products/${encodeURIComponent(offerId)}/direct-retail`, { method: "PUT", headers: backendAuthHeaders(request), body: await request.text() });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}
