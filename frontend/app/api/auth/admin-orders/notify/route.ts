import { NextResponse } from "next/server";

function backendOrigin(): string {
  const raw =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_API_BASE_URL ||
    "http://localhost:8080";
  return raw.replace(/\/api\/?$/, "").replace(/\/+$/, "");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = request.headers.get("Authorization") || "";

    const response = await fetch(`${backendOrigin()}/api/orders/status-changed`, {
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
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error publishing order status notification:", message);
    return NextResponse.json(
      { error: "Failed to send notification", details: message },
      { status: 500 }
    );
  }
}
