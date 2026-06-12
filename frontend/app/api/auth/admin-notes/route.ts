import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();

function toPositiveNumber(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

async function readJson(response: Response) {
  const raw = await response.text();
  return raw ? JSON.parse(raw) : null;
}

function backendError(payload: any, fallback: string) {
  return payload?.message || payload?.error || fallback;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = new URLSearchParams({
      page: String(toPositiveNumber(searchParams.get("page"), 1)),
      size: String(Math.min(50, toPositiveNumber(searchParams.get("size"), 20))),
    });

    const response = await fetch(`${API_URL}/v1/admin/notes?${query}`, {
      method: "GET",
      headers: backendAuthHeaders(request),
      cache: "no-store",
    });
    const payload = await readJson(response);

    if (!response.ok) {
      return NextResponse.json(
        { error: backendError(payload, "Failed to fetch admin notes") },
        { status: response.status }
      );
    }

    return NextResponse.json(payload?.data ?? payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching admin notes:", message);
    return NextResponse.json(
      { error: "Failed to fetch admin notes", details: message },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${API_URL}/v1/admin/notes`, {
      method: "POST",
      headers: backendAuthHeaders(request),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = await readJson(response);

    if (!response.ok) {
      return NextResponse.json(
        { error: backendError(payload, "Failed to create note") },
        { status: response.status }
      );
    }

    return NextResponse.json({
      message: payload?.message ?? "Note created",
      id: payload?.data?.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error creating admin note:", message);
    return NextResponse.json(
      { error: "Failed to create note", details: message },
      { status: 502 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${API_URL}/v1/admin/notes`, {
      method: "PUT",
      headers: backendAuthHeaders(request),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = await readJson(response);

    if (!response.ok) {
      return NextResponse.json(
        { error: backendError(payload, "Failed to update note") },
        { status: response.status }
      );
    }

    return NextResponse.json({ message: payload?.data ?? payload?.message ?? "Note updated" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error updating admin note:", message);
    return NextResponse.json(
      { error: "Failed to update note", details: message },
      { status: 502 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${API_URL}/v1/admin/notes`, {
      method: "DELETE",
      headers: backendAuthHeaders(request),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = await readJson(response);

    if (!response.ok) {
      return NextResponse.json(
        { error: backendError(payload, "Failed to delete note") },
        { status: response.status }
      );
    }

    return NextResponse.json({ message: payload?.data ?? payload?.message ?? "Note deleted" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error deleting admin note:", message);
    return NextResponse.json(
      { error: "Failed to delete note", details: message },
      { status: 502 }
    );
  }
}
