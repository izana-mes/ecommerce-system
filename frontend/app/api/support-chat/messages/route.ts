import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_BASE_URL = backendApiBaseUrl().replace(/\/+$/, "");

function getCookieHeader(request: Request) {
  return request.headers.get("cookie");
}

function getAuthHeader(request: Request) {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

function getGuestIdHeader(request: Request) {
  return request.headers.get("x-guest-id");
}

async function parseJsonOrText(response: Response) {
  const text = await response.text();
  if (!text) return { details: "Empty response from backend" };
  try {
    return JSON.parse(text);
  } catch {
    return { details: text };
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.search;
    
    const response = await fetch(`${API_BASE_URL}/support-chat/messages${query}`, {
      headers: {
        "Content-Type": "application/json",
        ...(getAuthHeader(request) ? { Authorization: getAuthHeader(request)! } : {}),
        ...(getCookieHeader(request) ? { Cookie: getCookieHeader(request)! } : {}),
        ...(getGuestIdHeader(request) ? { "x-guest-id": getGuestIdHeader(request)! } : {})},
      cache: "no-store"});

    const data = await parseJsonOrText(response);
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json({ error: "Failed connecting to backend", details: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    
    const response = await fetch(`${API_BASE_URL}/support-chat/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(getAuthHeader(request) ? { Authorization: getAuthHeader(request)! } : {}),
        ...(getCookieHeader(request) ? { Cookie: getCookieHeader(request)! } : {}),
        ...(getGuestIdHeader(request) ? { "x-guest-id": getGuestIdHeader(request)! } : {})},
      body: JSON.stringify(body),
      cache: "no-store"});

    const data = await parseJsonOrText(response);
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json({ error: "Failed connecting to backend", details: String(error) }, { status: 500 });
  }
}
