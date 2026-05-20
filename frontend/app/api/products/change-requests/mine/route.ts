import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

export async function GET(request: Request) {
  try {
        const response = await fetch(`${API_URL}/products/change-requests/mine`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"},
      cache: "no-store"});

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Failed to fetch supplier product requests", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
