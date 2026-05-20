import { NextRequest, NextResponse } from "next/server";

function toSafeQuery(value: string | null): string {
  return String(value || "").trim();
}

function toSafeLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(8, Math.max(1, Math.floor(parsed)));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = toSafeQuery(searchParams.get("q"));
    const limit = toSafeLimit(searchParams.get("limit"));

    if (q.length < 3) {
      return NextResponse.json({ error: "Query must be at least 3 characters" }, { status: 400 });
    }

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${encodeURIComponent(
        String(limit)
      )}&q=${encodeURIComponent(q)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "ecommerce-system-location-helper/1.0"},
        cache: "no-store"}
    );

    const payload = await response.json().catch(() => []);
    if (!response.ok) {
      return NextResponse.json(
        { error: "Address search failed", details: payload },
        { status: response.status }
      );
    }

    const results = Array.isArray(payload) ? payload : [];
    const normalized = results.map((item: Record<string, unknown>) => {
      const address = (item.address || {}) as Record<string, unknown>;
      const streetParts = [address.house_number, address.road].filter(Boolean).join(" ").trim();
      const locality = [address.city, address.town, address.village, address.suburb, address.county]
        .filter(Boolean)
        .map((value) => String(value))
        .find(Boolean) || "";

      return {
        displayName: String(item.display_name || ""),
        latitude: Number(item.lat),
        longitude: Number(item.lon),
        streetAddress1: streetParts || String(item.name || ""),
        streetAddress2: [address.neighbourhood, address.suburb, address.state].filter(Boolean).join(", "),
        city: String(locality),
        postalCode: String(address.postcode || ""),
        country: String(address.country || "")};
    }).filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));

    return NextResponse.json({ results: normalized });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to search addresses";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
