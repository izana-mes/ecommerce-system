import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function PUT(request: Request, context: { params: Promise<{ productId: string }> }) {
  try {
        const { productId } = await context.params;
    const body = await request.json();

    const response = await fetch(`${API_URL}/v1/seller/products/${encodeURIComponent(productId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"},
      body: JSON.stringify(body)});

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Failed to update seller product", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ productId: string }> }) {
  try {
        const { productId } = await context.params;

    const response = await fetch(`${API_URL}/v1/seller/products/${encodeURIComponent(productId)}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"}});

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Failed to delete seller product", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
