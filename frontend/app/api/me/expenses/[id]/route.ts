import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_BASE = backendApiBaseUrl().replace(/\/+$/, "");

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
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteParams) {
    const cookieHeader = getCookieHeader(request);
  if (!cookieHeader) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.text();

  const response = await fetch(`${API_BASE}/v1/me/expenses/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",      ...(cookieHeader ? { Cookie: cookieHeader } : {})},
    body,
    cache: "no-store"});
  const data = await parseJsonOrText(response);
  return NextResponse.json(data ?? { success: false, message: "Empty response" }, { status: response.status });
}

export async function DELETE(request: Request, context: RouteParams) {
    const cookieHeader = getCookieHeader(request);
  if (!cookieHeader) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const response = await fetch(`${API_BASE}/v1/me/expenses/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",      ...(cookieHeader ? { Cookie: cookieHeader } : {})},
    cache: "no-store"});
  const data = await parseJsonOrText(response);
  return NextResponse.json(data ?? { success: true, data: null }, { status: response.status });
}
