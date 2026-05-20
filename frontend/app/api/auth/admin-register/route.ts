import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_URL}/v1/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"},
      body: JSON.stringify(body)});

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error creating admin:", error?.message || error);
    return NextResponse.json(
      {
        error: "Failed to create admin",
        details: error?.message || String(error)},
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    return NextResponse.json(
      { error: "Not implemented for this backend" },
      { status: 501 }
    );
  } catch (error: any) {
    console.error("Error fetching admins:", error?.message || error);
    return NextResponse.json(
      {
        error: "Failed to fetch admins",
        details: error?.message || String(error)},
      { status: 500 }
    );
  }
}


