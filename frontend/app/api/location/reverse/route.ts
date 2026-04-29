import { NextRequest, NextResponse } from "next/server";

function parseCoordinate(value: string | null, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} is invalid`);
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseCoordinate(searchParams.get("lat"), "Latitude");
    const lon = parseCoordinate(searchParams.get("lon"), "Longitude");

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return NextResponse.json({ error: "Coordinates are out of range" }, { status: 400 });
    }

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(
        String(lat)
      )}&lon=${encodeURIComponent(String(lon))}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "ecommerce-system-location-helper/1.0",
        },
        cache: "no-store",
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: "Reverse geocoding failed", details: payload },
        { status: response.status }
      );
    }

    const address = payload?.address ?? {};
    const streetParts = [address.house_number, address.road].filter(Boolean).join(" ").trim();
    const locality =
      address.city || address.town || address.village || address.suburb || address.county || "";

    return NextResponse.json({
      displayName: String(payload?.display_name || ""),
      streetAddress1: streetParts || String(payload?.name || "Current location"),
      streetAddress2: [address.neighbourhood, address.suburb, address.state].filter(Boolean).join(", "),
      city: String(locality),
      postalCode: String(address.postcode || ""),
      country: String(address.country || ""),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to resolve location";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
