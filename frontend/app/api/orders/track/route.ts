import { NextRequest, NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_BASE_URL = backendApiBaseUrl().replace(/\/+$/, "");

async function parseJsonOrText(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function GET(request: NextRequest) {
  const token = (request.nextUrl.searchParams.get("token") || "").trim();
  if (!token) {
    return NextResponse.json({ success: false, message: "token is required" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/orders/track?token=${encodeURIComponent(token)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    );
    const data = await parseJsonOrText(response);
    return NextResponse.json(data ?? { success: response.ok }, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: "Failed connecting to backend", details: String(error) },
      { status: 500 }
    );
  }
}
