import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

function toPositiveNumber(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export async function GET(request: Request) {
  const conn = await getConnection();

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(0, toPositiveNumber(searchParams.get("page"), 1) - 1);
    const size = Math.min(100, toPositiveNumber(searchParams.get("size"), 20));
    const eventType = (searchParams.get("eventType") || "").trim();
    const entityType = (searchParams.get("entityType") || "").trim();
    const dateFrom = (searchParams.get("dateFrom") || "").trim();
    const dateTo = (searchParams.get("dateTo") || "").trim();

    const whereParts: string[] = [];
    const whereParams: Array<string | number> = [];

    if (eventType) {
      whereParts.push("event_type = ?");
      whereParams.push(eventType);
    }
    if (entityType) {
      whereParts.push("entity_type = ?");
      whereParams.push(entityType);
    }
    if (dateFrom) {
      whereParts.push("DATE(created_at) >= ?");
      whereParams.push(dateFrom);
    }
    if (dateTo) {
      whereParts.push("DATE(created_at) <= ?");
      whereParams.push(dateTo);
    }

    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const [countRows] = await conn.execute<Array<{ total: number }>>(
      `SELECT COUNT(*) AS total FROM audit_events ${whereSql}`,
      whereParams
    );

    const totalElements = Number(countRows?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(totalElements / size));

    const [rows] = await conn.execute<
      Array<{
        id: number;
        event_type: string;
        entity_type: string;
        entity_id: string;
        actor: string;
        details: string;
        created_at: string;
      }>
    >(
      `SELECT id, event_type, entity_type, entity_id, actor, details, created_at
       FROM audit_events
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, size, page * size]
    );

    const content = (rows || []).map((row) => ({
      ...row,
      details: typeof row.details === "string" ? JSON.parse(row.details || "{}") : row.details,
    }));

    return NextResponse.json({
      content,
      totalElements,
      totalPages,
      number: page,
      size,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching audit events:", message);
    return NextResponse.json(
      { error: "Failed to fetch audit events", details: message },
      { status: 500 }
    );
  } finally {
    await conn.end();
  }
}
