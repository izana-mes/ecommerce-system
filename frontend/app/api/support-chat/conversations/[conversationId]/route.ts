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

type RouteParams = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteParams) {
  try {
    const { conversationId } = await context.params;
    const body = await request.json().catch(() => ({}));

    const response = await fetch(`${API_BASE_URL}/support-chat/conversations/${encodeURIComponent(conversationId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(getAuthHeader(request) ? { Authorization: getAuthHeader(request)! } : {}),
        ...(getCookieHeader(request) ? { Cookie: getCookieHeader(request)! } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await parseJsonOrText(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json({ error: "Failed connecting to backend", details: String(error) }, { status: 500 });
  }
}
