import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getCookieHeader(request: Request) {
  return request.headers.get("cookie");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
        const cookieHeader = getCookieHeader(request);
    const response = await fetch(`${API_URL}/admin/attendance?${searchParams.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",        ...(cookieHeader ? { Cookie: cookieHeader } : {})},
      cache: "no-store"});
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch attendance dashboard.";
    console.error("GET /api/auth/admin-attendance error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
        const cookieHeader = getCookieHeader(request);
    const body = await request.json().catch(() => ({}));
    const response = await fetch(`${API_URL}/admin/attendance/reviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",        ...(cookieHeader ? { Cookie: cookieHeader } : {})},
      body: JSON.stringify(body)});
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create performance review.";
    console.error("POST /api/auth/admin-attendance error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
        const cookieHeader = getCookieHeader(request);
    const body = (await request.json().catch(() => ({}))) as { reviewId?: string };
    if (!body.reviewId) {
      return NextResponse.json({ error: "Missing reviewId." }, { status: 400 });
    }

    const response = await fetch(`${API_URL}/admin/attendance/reviews/${encodeURIComponent(body.reviewId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",        ...(cookieHeader ? { Cookie: cookieHeader } : {})},
      body: JSON.stringify(body)});
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update performance review.";
    console.error("PATCH /api/auth/admin-attendance error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
