import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function GET(request: Request) {
  try {
        const response = await fetch(`${API_URL}/v1/seller/finance/balance`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"},
      cache: "no-store"});

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Failed to fetch seller balance", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

