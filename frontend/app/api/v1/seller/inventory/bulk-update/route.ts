import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** POST /api/v1/seller/inventory/bulk-update */
export async function POST(request: Request) {
  try {
        const body = await request.json();
    const response = await fetch(`${API_URL}/v1/seller/inventory/bulk-update`, {
      method: "POST",
      headers: backendAuthHeaders(request),
      body: JSON.stringify(body),
      cache: "no-store"});
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Failed to bulk update stock", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
