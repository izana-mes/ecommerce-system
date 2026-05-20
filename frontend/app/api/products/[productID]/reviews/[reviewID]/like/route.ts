import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_BASE_URL = backendApiBaseUrl().replace(/\/+$/, "");

function getCookieHeader(request: Request) {
  return request.headers.get("cookie");
}

async function parseJsonOrText(response: Response) {
  const text = await response.text();
  if (!text) return { details: "Empty response from backend" };
  try {
    return JSON.parse(text);
  } catch {
    return { details: text };
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ productID: string; reviewID: string }> }
) {
  try {
    const { productID, reviewID } = await context.params;
        const cookieHeader = getCookieHeader(request);

    const response = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productID)}/reviews/${encodeURIComponent(reviewID)}/like`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",        ...(cookieHeader ? { Cookie: cookieHeader } : {})},
      cache: "no-store"});

    const data = await parseJsonOrText(response);
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to toggle review like",
        details},
      { status: 500 }
    );
  }
}
