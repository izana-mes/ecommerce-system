import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();
function getErrorMessage(e: unknown) { return e instanceof Error ? e.message : String(e); }

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sellerId: string }> }
) {
  try {
    const { sellerId } = await params;
    const res = await fetch(`${API_URL}/v1/admin/resale/sellers/${encodeURIComponent(sellerId)}/profile`, {
      method: "GET",
      headers: backendAuthHeaders(request),
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
