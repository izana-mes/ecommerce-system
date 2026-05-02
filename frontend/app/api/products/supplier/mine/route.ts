import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

export async function GET(request: Request) {
  try {
    const authHeader =
      request.headers.get("authorization") || request.headers.get("Authorization");

    const response = await fetch(`${API_URL}/products/supplier/mine`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        { error: typeof data?.message === "string" ? data.message : "Failed to load supplier catalog" },
        { status: response.status }
      );
    }

    return NextResponse.json(Array.isArray(data) ? data : data?.data ?? data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load supplier catalog", details: message }, { status: 500 });
  }
}
