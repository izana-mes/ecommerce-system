import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();
function getErrorMessage(e: unknown) { return e instanceof Error ? e.message : String(e); }

export async function POST(
  request: Request,
  { params }: { params: Promise<{ authorizationId: string }> }
) {
  try {
    const { authorizationId } = await params;
    const body = await request.json().catch(() => ({}));
    const res = await fetch(`${API_URL}/v1/supplier/resale/authorizations/${encodeURIComponent(authorizationId)}/revoke`, {
      method: "POST",
      headers: backendAuthHeaders(request),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
