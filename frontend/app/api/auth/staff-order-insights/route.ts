import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

export async function GET(request: Request) {
  try {
        const response = await fetch(`${API_URL}/v1/staff/order-insights`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"},
      cache: "no-store"});

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(data ?? { error: "Failed to load insights" }, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load order insights", details: message }, { status: 500 });
  }
}
