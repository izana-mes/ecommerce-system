import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function GET(request: Request) {
  try {
    const cookie = request.headers.get("cookie") ?? "";
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const query = new URLSearchParams();
    if (status) query.set("status", status);

    const response = await fetch(`${API_URL}/v1/seller-access/requests${query.toString() ? `?${query.toString()}` : ""}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {})},
      cache: "no-store"});

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Failed to fetch seller requests", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
        const body = await request.json();
    const requestId = String(body?.requestId || "").trim();
    const action = String(body?.action || "").trim().toLowerCase();
    const note = typeof body?.note === "string" ? body.note : undefined;

    if (!requestId || (action !== "approve" && action !== "reject")) {
      return NextResponse.json(
        { error: "Missing required fields: requestId, action" },
        { status: 400 }
      );
    }

    const cookie = request.headers.get("cookie") ?? "";
    const response = await fetch(`${API_URL}/v1/seller-access/requests/${encodeURIComponent(requestId)}/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {})},
      body: JSON.stringify({ note })});

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Failed to review seller request", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
