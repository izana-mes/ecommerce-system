import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_BASE_URL = backendApiBaseUrl().replace(/\/+$/, "");

function getCookieHeader(request: Request): string | null {
  return request.headers.get("cookie");
}

async function parseJsonOrText(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

type RouteParams = {
  params: Promise<{
    orderNumber: string;
  }>;
};

export async function POST(request: Request, context: RouteParams) {
  try {
    const { orderNumber } = await context.params;
        const cookieHeader = getCookieHeader(request);

    const response = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderNumber)}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",        ...(cookieHeader ? { Cookie: cookieHeader } : {})},
      cache: "no-store"});

    const data = await parseJsonOrText(response);
    return NextResponse.json(data ?? { success: response.ok }, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Failed connecting to backend", details: String(error) },
      { status: 500 }
    );
  }
}
