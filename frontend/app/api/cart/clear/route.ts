import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();

async function parseJsonOrText(response: Response) {
  const text = await response.text();
  if (!text) return { details: "Empty response from backend" };

  try {
    return JSON.parse(text);
  } catch {
    return { details: text };
  }
}

export async function DELETE(request: Request) {
  try {
    const response = await fetch(`${API_URL}/cart/clear`, {
      method: "DELETE",
      headers: backendAuthHeaders(request)});

    const data = await parseJsonOrText(response);

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error clearing cart:", error?.message || error);
    return NextResponse.json(
      {
        error: "Failed to clear cart",
        details: error?.message || String(error)},
      { status: 500 }
    );
  }
}
