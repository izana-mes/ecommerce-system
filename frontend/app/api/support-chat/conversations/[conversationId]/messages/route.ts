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

type RouteParams = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function GET(request: Request, context: RouteParams) {
  try {
    const { conversationId } = await context.params;
    
    // We proxy this to /api/support-chat/messages?conversationId=...
    const response = await fetch(`${API_BASE_URL}/support-chat/messages?conversationId=${encodeURIComponent(conversationId)}`, {
      headers: {
        "Content-Type": "application/json",
        ...(getAuthHeader(request) ? { Authorization: getAuthHeader(request)! } : {}),
        ...(getCookieHeader(request) ? { Cookie: getCookieHeader(request)! } : {})},
      cache: "no-store"});

    const data = await parseJsonOrText(response);
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json({ error: "Failed connecting to backend", details: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteParams) {
  try {
    const { conversationId } = await context.params;
    const body = await request.json().catch(() => ({}));
    
    const response = await fetch(`${API_BASE_URL}/support-chat/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(getAuthHeader(request) ? { Authorization: getAuthHeader(request)! } : {}),
        ...(getCookieHeader(request) ? { Cookie: getCookieHeader(request)! } : {})},
      body: JSON.stringify({
        ...body,
        conversationId}),
      cache: "no-store"});

    const data = await parseJsonOrText(response);
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json({ error: "Failed connecting to backend", details: String(error) }, { status: 500 });
  }
}
