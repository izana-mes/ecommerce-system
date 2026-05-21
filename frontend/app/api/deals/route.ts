import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DealRecord = {
  id: number;
  name: string;
  price: number;
  discount_price: number;
  end_time: string;
  image: string;
};

function fallbackDeals(): DealRecord[] {
  const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString();
  return [
    {
      id: 1,
      name: "Demo deal",
      price: 100,
      discount_price: 79,
      end_time: end,
      image: "/placeholder.png"},
  ];
}

async function loadLocalDeals(): Promise<DealRecord[]> {
  try {
    const file = path.join(process.cwd(), "data", "deals.json");
    const raw = await readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) return fallbackDeals();
    return parsed.map((item, index) => ({
      id: Number(item.id ?? index + 1),
      name: String(item.name ?? "Deal"),
      price: Number(item.price ?? 0),
      discount_price: Number(item.discount_price ?? item.price ?? 0),
      end_time: String(item.end_time ?? item.endTime ?? new Date().toISOString()),
      image: String(item.image ?? "/placeholder.png")}));
  } catch {
    return fallbackDeals();
  }
}

export async function GET() {
  const deals = await loadLocalDeals();
  return NextResponse.json(deals);
}

export async function POST() {
  return NextResponse.json(
    { error: "Deals are managed locally; backend endpoint is not configured." },
    { status: 501 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: "Deals are managed locally; backend endpoint is not configured." },
    { status: 501 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Deals are managed locally; backend endpoint is not configured." },
    { status: 501 }
  );
}
