import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();
function getErrorMessage(e: unknown) { return e instanceof Error ? e.message : String(e); }

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = new URLSearchParams();
    ["status", "productId", "page", "size"].forEach(k => {
      const v = searchParams.get(k);
      if (v !== null) query.set(k, v);
    });
    const res = await fetch(`${API_URL}/v1/supplier/resale/requests?${query}`, {
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
