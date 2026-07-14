import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();

async function readJson(response: Response) {
  const raw = await response.text();
  return raw ? JSON.parse(raw) : null;
}

function backendError(payload: any, fallback: string) {
  return payload?.message || payload?.error || fallback;
}

export async function GET(request: Request) {
  try {
    const response = await fetch(`${API_URL}/v1/admin/settings`, {
      method: "GET",
      headers: backendAuthHeaders(request),
      cache: "no-store",
    });
    const payload = await readJson(response);

    if (!response.ok) {
      return NextResponse.json(
        { error: backendError(payload, "Failed to fetch admin settings") },
        { status: response.status }
      );
    }

    return NextResponse.json({ settings: payload?.data ?? [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching admin settings:", message);
    return NextResponse.json(
      { error: "Failed to fetch admin settings", details: message },
      { status: 502 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${API_URL}/v1/admin/settings`, {
      method: "PUT",
      headers: backendAuthHeaders(request),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = await readJson(response);

    if (!response.ok) {
      return NextResponse.json(
        { error: backendError(payload, "Failed to update setting") },
        { status: response.status }
      );
    }

    return NextResponse.json({ message: payload?.data ?? payload?.message ?? "Setting updated" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error updating admin setting:", message);
    return NextResponse.json(
      { error: "Failed to update setting", details: message },
      { status: 502 }
    );
  }
}
