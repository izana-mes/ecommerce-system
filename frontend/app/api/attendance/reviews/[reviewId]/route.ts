import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

function getAuthHeader(request: Request) {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

function getCookieHeader(request: Request) {
  return request.headers.get("cookie");
}

type RouteParams = {
  params: Promise<{
    reviewId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteParams) {
  try {
    const { reviewId } = await context.params;
    const authHeader = getAuthHeader(request);
    const cookieHeader = getCookieHeader(request);
    const body = await request.json().catch(() => ({}));

    const response = await fetch(`${backendApiBaseUrl()}/attendance/reviews/${encodeURIComponent(reviewId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update performance review.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
