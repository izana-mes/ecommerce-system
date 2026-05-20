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

export async function GET(request: Request) {
    const cookieHeader = getCookieHeader(request);
  if (!cookieHeader) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") ?? "0";
  const size = searchParams.get("size") ?? "50";

  const response = await fetch(
    `${API_BASE}/v1/me/expenses?page=${encodeURIComponent(page)}&size=${encodeURIComponent(size)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",        ...(cookieHeader ? { Cookie: cookieHeader } : {})},
      cache: "no-store"}
  );
  const data = await parseJsonOrText(response);
  return NextResponse.json(data ?? { success: false, message: "Empty response" }, { status: response.status });
}

export async function POST(request: Request) {
    const cookieHeader = getCookieHeader(request);
  if (!cookieHeader) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.text();
  const response = await fetch(`${API_BASE}/v1/me/expenses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",      ...(cookieHeader ? { Cookie: cookieHeader } : {})},
    body,
    cache: "no-store"});
  const data = await parseJsonOrText(response);
  return NextResponse.json(data ?? { success: false, message: "Empty response" }, { status: response.status });
}
