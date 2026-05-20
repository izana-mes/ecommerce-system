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

async function proxyReviewMutation(
  request: Request,
  context: { params: Promise<{ productID: string; reviewID: string }> },
  method: "PUT" | "DELETE"
) {
  try {
    const { productID, reviewID } = await context.params;
        const cookieHeader = getCookieHeader(request);

    const requestInit: RequestInit = {
      method,
      headers: {        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...(method === "PUT" ? { "Content-Type": "application/json" } : {})},
      cache: "no-store"};

    if (method === "PUT") {
      const body = await request.json();
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(
      `${API_BASE_URL}/products/${encodeURIComponent(productID)}/reviews/${encodeURIComponent(reviewID)}`,
      requestInit
    );

    const data = await parseJsonOrText(response);
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: method === "PUT" ? "Failed to update product review" : "Failed to delete product review",
        details},
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ productID: string; reviewID: string }> }
) {
  return proxyReviewMutation(request, context, "PUT");
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ productID: string; reviewID: string }> }
) {
  return proxyReviewMutation(request, context, "DELETE");
}
