import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getAuthHeader(request: Request): string | null {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

function getCookieHeader(request: Request): string | null {
  return request.headers.get("cookie");
}

function toInt(input: string | null, fallback: number): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function normalizeEmail(value: string | undefined | null): string {
  return String(value || "").trim().toLowerCase();
}

export async function GET(request: Request) {
  const authHeader = getAuthHeader(request);
  const cookieHeader = getCookieHeader(request);

  if (!authHeader && !cookieHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const meResponse = await fetch(`${API_URL}/v1/auth/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });
    const meData = await meResponse.json().catch(() => null);
    const email = normalizeEmail(meData?.data?.email as string | undefined);

    if (!meResponse.ok || !email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = toInt(searchParams.get("page"), 0);
    const size = Math.min(50, Math.max(1, toInt(searchParams.get("size"), 10)));
    const limit = (page + 1) * size;

    const historyResponse = await fetch(`${API_URL.replace(/\/+$/, "")}/orders/history?limit=${limit}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });
    const historyData = await historyResponse.json().catch(() => null);

    if (!historyResponse.ok) {
      return NextResponse.json(
        { error: historyData?.message || historyData?.error || "Failed to fetch order history" },
        { status: historyResponse.status }
      );
    }

    const allOrders = Array.isArray(historyData?.data) ? historyData.data : [];
    const start = page * size;
    const content = allOrders.slice(start, start + size);
    const totalElements = allOrders.length;

    return NextResponse.json({
      content,
      totalElements,
      totalPages: Math.max(1, Math.ceil(totalElements / size)),
      number: page,
      size,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching order history:", message);
    return NextResponse.json(
      { error: "Failed to fetch order history", details: message },
      { status: 500 }
    );
  }
}
