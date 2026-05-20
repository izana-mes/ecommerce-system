import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * PUT  /api/v1/seller/products/{productId}/promotion  → apply sale price
 * DELETE /api/v1/seller/products/{productId}/promotion → clear promotion
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  try {
        const body = await request.json();
    const response = await fetch(`${API_URL}/v1/seller/products/${productId}/promotion`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"},
      body: JSON.stringify(body),
      cache: "no-store"});
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Failed to apply promotion", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  try {
        const response = await fetch(`${API_URL}/v1/seller/products/${productId}/promotion`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"},
      cache: "no-store"});
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Failed to clear promotion", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
