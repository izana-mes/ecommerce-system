import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getAuthHeader(request: Request) {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function PUT(request: Request, context: { params: Promise<{ productId: string }> }) {
  try {
    const authHeader = getAuthHeader(request);
    const { productId } = await context.params;
    const body = await request.json();

    const response = await fetch(`${API_URL}/v1/seller/inventory/${encodeURIComponent(productId)}/stock`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Failed to update seller stock", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

