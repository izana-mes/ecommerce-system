import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Number(searchParams.get("limit") ?? 8) || 8);
    const response = await fetch(`${API_URL}/products/search-history?limit=${limit}`, {
      method: "GET",
      headers: backendAuthHeaders(request),
      cache: "no-store",
    });

    const data = await response.json().catch(() => []);
    if (!response.ok) {
      return NextResponse.json([]);
    }
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch {
    return NextResponse.json([]);
  }
}

export async function DELETE(request: Request) {
  try {
    const response = await fetch(`${API_URL}/products/search-history`, {
      method: "DELETE",
      headers: backendAuthHeaders(request),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Failed to clear history" }));
      return NextResponse.json(data, { status: response.status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to clear search history",
        details: message,
      },
      { status: 500 }
    );
  }
}
