import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function GET(request: Request) {
  try {
        const response = await fetch(`${API_URL}/v1/seller-access/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"},
      cache: "no-store"});

    if (response.status === 204) {
      return NextResponse.json(null);
    }

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Failed to fetch seller access request", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
        const body = await request.json().catch(() => ({}));
    const response = await fetch(`${API_URL}/v1/seller-access/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"},
      body: JSON.stringify(body)});

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Failed to submit seller access request", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
