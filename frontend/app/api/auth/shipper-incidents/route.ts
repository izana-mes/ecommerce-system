import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

export async function GET(request: Request) {
  try {
        const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") || "").trim();
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const response = await fetch(`${API_URL}/v1/shipper/incidents${query}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"},
      cache: "no-store"});
    const raw = await response.text();
    const payload = raw ? JSON.parse(raw) : null;
    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error || payload?.message || "Failed to load incidents" },
        { status: response.status }
      );
    }
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load incidents", details: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
        const body = await request.json();
    const response = await fetch(`${API_URL}/v1/shipper/incidents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"},
      body: JSON.stringify(body)});
    const raw = await response.text();
    const payload = raw ? JSON.parse(raw) : null;
    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error || payload?.message || "Failed to create incident" },
        { status: response.status }
      );
    }
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to create incident", details: message }, { status: 500 });
  }
}
