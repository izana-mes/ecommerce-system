import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getAuthHeader(request: Request) {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function GET(request: Request) {
  try {
    const authHeader = getAuthHeader(request);
    const { searchParams } = new URL(request.url);

    const days = searchParams.get("days") || "7";
    const recentLimit = searchParams.get("recentLimit") || "8";
    const lowStockThreshold = searchParams.get("lowStockThreshold") || "5";
    const endpoint = `${API_URL}/v1/admin/dashboard?days=${encodeURIComponent(days)}&recentLimit=${encodeURIComponent(
      recentLimit
    )}&lowStockThreshold=${encodeURIComponent(lowStockThreshold)}`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    return NextResponse.json(
      {
        error: "Failed to fetch admin dashboard",
        details: message,
      },
      { status: 500 }
    );
  }
}
