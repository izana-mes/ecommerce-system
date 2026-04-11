import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getAuthHeader(request: Request) {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

function getCookieHeader(request: Request) {
  return request.headers.get("cookie");
}

export async function GET(request: Request) {
  try {
    const authHeader = getAuthHeader(request);
    const cookieHeader = getCookieHeader(request);

    const response = await fetch(`${API_URL}/v1/auth/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Error fetching auth me:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        error: "Failed to fetch auth me",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
