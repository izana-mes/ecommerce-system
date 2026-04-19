import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

function isMissingTableError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("admin_settings") && (
    normalized.includes("doesn't exist") ||
    normalized.includes("does not exist") ||
    normalized.includes("relation") ||
    normalized.includes("no such table")
  );
}

export async function GET() {
  let conn: Awaited<ReturnType<typeof getConnection>> | undefined;
  try {
    conn = await getConnection();
    const [rows] = await conn.execute<
      Array<{
        id: number;
        setting_key: string;
        setting_value: string;
        description: string;
        updated_at: string;
      }>
    >("SELECT id, setting_key, setting_value, description, updated_at FROM admin_settings ORDER BY setting_key ASC");

    return NextResponse.json({ settings: rows || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching admin settings:", message);
    // Return graceful empty list for any DB error (missing table, no env vars, etc.)
    return NextResponse.json({
      settings: [],
      unavailable: true,
      details: message,
    });
  } finally {
    await conn?.end();
  }
}

export async function PUT(request: Request) {
  const conn = await getConnection();
  try {
    const body = await request.json();
    const key = (body.setting_key || "").trim();
    const value = String(body.setting_value ?? "").trim();

    if (!key) {
      return NextResponse.json(
        { error: "setting_key is required" },
        { status: 400 }
      );
    }

    await conn.execute(
      "UPDATE admin_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?",
      [value, key]
    );

    return NextResponse.json({ message: "Setting updated" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error updating admin setting:", message);
    return NextResponse.json(
      { error: "Failed to update setting", details: message },
      { status: 500 }
    );
  } finally {
    await conn.end();
  }
}
