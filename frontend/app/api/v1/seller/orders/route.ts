import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getAuthHeader(request: Request) {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function GET(request: Request) {
  try {
    const authHeader = getAuthHeader(request);
    const { searchParams } = new URL(request.url);

    const qs = new URLSearchParams();
    const limit = searchParams.get("limit");
    const status = searchParams.get("status");
    if (limit) qs.set("limit", limit);
    if (status) qs.set("status", status);

    const url = `${API_URL}/v1/seller/orders${qs.toString() ? `?${qs.toString()}` : ""}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      cache: "no-store",
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Failed to fetch seller orders", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

