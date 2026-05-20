import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();

function toPositiveNumber(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export async function GET(request: Request) {
  
  try {
    const { searchParams } = new URL(request.url);
    // Convert 1-indexed page from client to 0-indexed for backend
    const page = Math.max(0, toPositiveNumber(searchParams.get("page"), 1) - 1);
    const size = Math.min(100, toPositiveNumber(searchParams.get("size"), 20));
    const eventType = (searchParams.get("eventType") || "").trim();
    const entityType = (searchParams.get("entityType") || "").trim();
    const dateFrom = (searchParams.get("dateFrom") || "").trim();
    const dateTo = (searchParams.get("dateTo") || "").trim();

    const query = new URLSearchParams({
      page: String(page),
      size: String(size),
      ...(eventType ? { eventType } : {}),
      ...(entityType ? { entityType } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {})});

    const response = await fetch(`${API_URL}/v1/admin/audit-events?${query}`, {
      method: "GET",
      headers: backendAuthHeaders(request),
      cache: "no-store"});

    const raw = await response.text();
    const payload = raw ? JSON.parse(raw) : null;

    if (!response.ok) {
      console.error("admin-audit backend error:", response.status, payload);
      return NextResponse.json(
        { error: payload?.message || payload?.error || "Failed to fetch audit events" },
        { status: response.status }
      );
    }

    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching audit events:", message);
    return NextResponse.json(
      { error: "Failed to fetch audit events", details: message },
      { status: 500 }
    );
  }
}
