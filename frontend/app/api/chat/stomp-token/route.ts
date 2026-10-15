import { NextRequest, NextResponse } from "next/server";

/** Exposes the httpOnly access cookie to STOMP CONNECT for cross-origin SockJS. */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("access_token")?.value;
  if (!token) {
    return NextResponse.json({ token: null }, { status: 401 });
  }
  return NextResponse.json({ token });
}
