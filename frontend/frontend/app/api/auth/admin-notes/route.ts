import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

function toPositiveNumber(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function isMissingTableError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("admin_notes") && (
    normalized.includes("doesn't exist") ||
    normalized.includes("does not exist") ||
    normalized.includes("relation") ||
    normalized.includes("no such table")
  );
}

export async function GET(request: Request) {
  const conn = await getConnection();
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(0, toPositiveNumber(searchParams.get("page"), 1) - 1);
    const size = Math.min(50, toPositiveNumber(searchParams.get("size"), 20));

    const [countRows] = await conn.execute<Array<{ total: number }>>(
      "SELECT COUNT(*) AS total FROM admin_notes"
    );
    const totalElements = Number(countRows?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(totalElements / size));

    const [rows] = await conn.execute<
      Array<{
        id: number;
        title: string;
        content: string;
        is_pinned: boolean;
        created_at: string;
        updated_at: string;
      }>
    >(
      `SELECT id, title, content, is_pinned, created_at, updated_at
       FROM admin_notes
       ORDER BY is_pinned DESC, updated_at DESC
       LIMIT ? OFFSET ?`,
      [size, page * size]
    );

    return NextResponse.json({
      content: rows || [],
      totalElements,
      totalPages,
      number: page,
      size,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching admin notes:", message);
    if (isMissingTableError(message)) {
      return NextResponse.json({
        content: [],
        totalElements: 0,
        totalPages: 1,
        number: 0,
        size: 20,
        unavailable: true,
        details: "admin_notes table is missing",
      });
    }
    return NextResponse.json(
      { error: "Failed to fetch notes", details: message },
      { status: 500 }
    );
  } finally {
    await conn.end();
  }
}

export async function POST(request: Request) {
  const conn = await getConnection();
  try {
    const body = await request.json();
    const title = (body.title || "").trim();
    const content = (body.content || "").trim();
    const isPinned = body.is_pinned === true;

    if (!title && !content) {
      return NextResponse.json(
        { error: "Title or content is required" },
        { status: 400 }
      );
    }

    const [result] = await conn.execute(
      `INSERT INTO admin_notes (title, content, is_pinned, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())`,
      [title, content, isPinned]
    );

    return NextResponse.json({
      message: "Note created",
      id: (result as any).insertId ?? (result as any)?.[0]?.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error creating admin note:", message);
    return NextResponse.json(
      { error: "Failed to create note", details: message },
      { status: 500 }
    );
  } finally {
    await conn.end();
  }
}

export async function PUT(request: Request) {
  const conn = await getConnection();
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) {
      return NextResponse.json({ error: "Note id is required" }, { status: 400 });
    }

    const updates: string[] = [];
    const params: Array<string | boolean | number> = [];

    if (body.title !== undefined) {
      updates.push("title = ?");
      params.push(String(body.title).trim());
    }
    if (body.content !== undefined) {
      updates.push("content = ?");
      params.push(String(body.content).trim());
    }
    if (body.is_pinned !== undefined) {
      updates.push("is_pinned = ?");
      params.push(body.is_pinned === true);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    updates.push("updated_at = NOW()");
    params.push(id);

    await conn.execute(
      `UPDATE admin_notes SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    return NextResponse.json({ message: "Note updated" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error updating admin note:", message);
    return NextResponse.json(
      { error: "Failed to update note", details: message },
      { status: 500 }
    );
  } finally {
    await conn.end();
  }
}

export async function DELETE(request: Request) {
  const conn = await getConnection();
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) {
      return NextResponse.json({ error: "Note id is required" }, { status: 400 });
    }

    await conn.execute("DELETE FROM admin_notes WHERE id = ?", [id]);
    return NextResponse.json({ message: "Note deleted" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error deleting admin note:", message);
    return NextResponse.json(
      { error: "Failed to delete note", details: message },
      { status: 500 }
    );
  } finally {
    await conn.end();
  }
}
