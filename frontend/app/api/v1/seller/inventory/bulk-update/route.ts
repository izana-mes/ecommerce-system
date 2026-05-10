import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getAuthHeader(request: Request) {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** POST /api/v1/seller/inventory/bulk-update */
export async function POST(request: Request) {
  try {
    const authHeader = getAuthHeader(request);
    const body = await request.json();
    const response = await fetch(`${API_URL}/v1/seller/inventory/bulk-update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Failed to bulk update stock", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
