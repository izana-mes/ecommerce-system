import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_URL}/v1/auth/register`, {
      method: "POST",
      headers: backendAuthHeaders(request),
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error registering user:", error?.message || error);
    return NextResponse.json(
      {
        error: "Failed to register user",
        details: error?.message || String(error)},
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    
    const response = await fetch(`${API_URL}/v1/users`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"}});

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching users:", error?.message || error);
    return NextResponse.json(
      {
        error: "Failed to fetch users",
        details: error?.message || String(error)},
      { status: 500 }
    );
  }
}



