import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getAuthHeader(request: Request): string | null {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = getAuthHeader(request);
    const { id } = await context.params;
    const response = await fetch(`${API_URL}/shipper/incidents/${encodeURIComponent(id)}/resolve`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });
    const raw = await response.text();
    const payload = raw ? JSON.parse(raw) : null;
    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error || payload?.message || "Failed to resolve incident" },
        { status: response.status }
      );
    }
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to resolve incident", details: message }, { status: 500 });
  }
}
