import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

// Route segment config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API_URL = backendApiBaseUrl();

function getAuthHeader(request: Request) {
  return (
    request.headers.get("authorization") || request.headers.get("Authorization")
  );
}

function fallbackDeals() {
  const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(); // +3 days
  return [
    {
      id: 1,
      name: "Demo deal",
      price: 100,
      discount_price: 79,
      end_time: end,
      image: "/placeholder.png",
    },
  ];
}

// GET - Proxy to backend deals endpoint
export async function GET() {
  try {
    const response = await fetch(`${API_URL}/deals`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status === 404) {
      return NextResponse.json(fallbackDeals());
    }

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(fallbackDeals());
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching deals:", error?.message || error);
    return NextResponse.json(fallbackDeals());
  }
}

// POST - Proxy to backend deals endpoint
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const authHeader = getAuthHeader(request);

    const response = await fetch(`${API_URL}/deals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error creating deal:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to create deal", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

// PUT - Proxy to backend deals endpoint
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;
    const authHeader = getAuthHeader(request);

    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_URL}/deals/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error updating deal:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to update deal", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

// DELETE - Proxy to backend deals endpoint
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;
    const authHeader = getAuthHeader(request);

    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_URL}/deals/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error deleting deal:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to delete deal", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}