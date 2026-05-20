import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function GET(request: Request) {
  try {
        const { searchParams } = new URL(request.url);

    const qs = new URLSearchParams();
    const days = searchParams.get("days");
    const lowStockThreshold = searchParams.get("lowStockThreshold");
    if (days) qs.set("days", days);
    if (lowStockThreshold) qs.set("lowStockThreshold", lowStockThreshold);

    const url = `${API_URL}/v1/seller/dashboard${qs.toString() ? `?${qs.toString()}` : ""}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"},
      cache: "no-store"});

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Failed to fetch seller dashboard", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

