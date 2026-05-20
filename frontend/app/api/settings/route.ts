import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

const PUBLIC_HOME_SETTING_KEYS = [
  "banner_left_url",
  "banner_right_url",
  "collection_left_url",
  "collection_top_url",
  "collection_bottom_left_url",
  "deal_background_url",
  "hero_background_url",
];

export async function GET() {
  let conn: Awaited<ReturnType<typeof getConnection>> | undefined;
  try {
    conn = await getConnection();
    const placeholders = PUBLIC_HOME_SETTING_KEYS.map(() => "?").join(", ");
    const [rows] = await conn.execute<
      Array<{
        setting_key: string;
        setting_value: string;
      }>
    >(
      `SELECT setting_key, setting_value FROM admin_settings WHERE setting_key IN (${placeholders})`,
      PUBLIC_HOME_SETTING_KEYS
    );

    const settingsMap = (rows || []).reduce((acc: Record<string, string>, row) => {
      acc[row.setting_key] = row.setting_value;
      return acc;
    }, {});

    return NextResponse.json({ settings: settingsMap });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching public settings:", message);
    return NextResponse.json({
      settings: {},
      unavailable: true,
      details: message});
  } finally {
    await conn?.end();
  }
}
