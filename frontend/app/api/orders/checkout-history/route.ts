import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Math.min(10, Number(searchParams.get("limit") ?? 6) || 6));
    const response = await fetch(`${API_URL}/orders/checkout-history?limit=${limit}`, {
      method: "GET",
      headers: backendAuthHeaders(request),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json({ entries: [] });
    }

    const entries = Array.isArray(data?.data) ? data.data : [];
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ entries: [] });
  }
}

export async function DELETE(request: Request) {
  try {
    const response = await fetch(`${API_URL}/orders/checkout-history`, {
      method: "DELETE",
      headers: backendAuthHeaders(request),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Failed to clear checkout history" }));
      return NextResponse.json(data, { status: response.status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to clear checkout history", details: message }, { status: 500 });
  }
}
