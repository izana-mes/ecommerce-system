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

function getBackendErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const item = payload as Record<string, unknown>;
  if (typeof item.message === "string") {
    return item.message;
  }
  if (typeof item.error === "string") {
    return item.error;
  }
  if (typeof item.details === "string") {
    return item.details;
  }
  return "";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ productID: string }> }
) {
  try {
    const { productID } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = (searchParams.get("limit") || "10").trim();

        const cookieHeader = getCookieHeader(request);

    const response = await fetch(
      `${API_BASE_URL}/products/${encodeURIComponent(productID)}/reviews?limit=${encodeURIComponent(limit)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",          ...(cookieHeader ? { Cookie: cookieHeader } : {})},
        cache: "no-store"}
    );

    const data = await parseJsonOrText(response);
    if (!response.ok) {
      const message = getBackendErrorMessage(data);
      if (response.status === 404 && message.includes("Resource not found:")) {
        return NextResponse.json({
          productID,
          averageRating: 0,
          reviewCount: 0,
          reviews: []});
      }
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to fetch product reviews",
        details},
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ productID: string }> }
) {
  try {
    const { productID } = await context.params;
    const body = await request.json();
        const cookieHeader = getCookieHeader(request);

    const response = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productID)}/reviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",        ...(cookieHeader ? { Cookie: cookieHeader } : {})},
      body: JSON.stringify(body),
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
        error: "Failed to submit product review",
        details},
      { status: 500 }
    );
  }
}
