import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_BASE_URL = backendApiBaseUrl().replace(/\/+$/, "");

function getAuthHeader(request: Request) {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

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
    const authHeader = getAuthHeader(request);
    const cookieHeader = getCookieHeader(request);
    const body = await request.text();

    const response = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productID)}/reviews/${encodeURIComponent(reviewID)}/replies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body,
      cache: "no-store",
    });

    const data = await parseJsonOrText(response);
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to add review reply",
        details,
      },
      { status: 500 }
    );
  }
}
