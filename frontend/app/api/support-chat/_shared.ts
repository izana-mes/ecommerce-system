import { getConnection, getDbRuntimeInfo } from "@/lib/db";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

export type ChatRole = "customer" | "staff" | "admin";

export type ViewerProfile = {
  userId?: string;
  email?: string;
  role: "user" | "employee" | "admin";
  guestId?: string;
};

export type ChatMessageDto = {
  messageId: string;
  conversationId: string;
  senderRole: ChatRole;
  senderEmail: string | null;
  body: string;
  createdAt: string;
};

export type ConversationSummaryDto = {
  conversationId: string;
  customerLabel: string;
  status: string;
  lastMessageAt: string;
  lastMessagePreview: string;
};

let ensureSchemaPromise: Promise<void> | null = null;

function getAuthHeader(request: Request): string | null {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

function getCookieHeader(request: Request): string | null {
  return request.headers.get("cookie") || null;
}

function normalizeRole(role: unknown, roles: unknown): ViewerProfile["role"] {
  const lower = String(role || "").toLowerCase();
  if (lower === "admin") return "admin";
  if (lower === "employee" || lower === "staff") return "employee";

  const values = Array.isArray(roles) ? roles.map((value) => String(value).toUpperCase()) : [];
  if (values.includes("ROLE_ADMIN")) return "admin";
  if (values.includes("ROLE_EMPLOYEE") || values.includes("ROLE_STAFF")) return "employee";

  return "user";
}

function readGuestId(request: Request): string | undefined {
  const fromHeader = request.headers.get("x-guest-id") || undefined;
  if (fromHeader && fromHeader.trim()) return fromHeader.trim().slice(0, 128);
  return undefined;
}

export function normalizeText(value: unknown, maxLength: number): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function toIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

async function ensureSchema(): Promise<void> {
  if (ensureSchemaPromise) return ensureSchemaPromise;

  ensureSchemaPromise = (async () => {
    const conn = await getConnection();

    try {
      try {
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS support_chat_conversations (
            conversation_id VARCHAR(64) PRIMARY KEY,
            customer_user_id VARCHAR(64) NULL,
            customer_email VARCHAR(255) NULL,
            guest_id VARCHAR(128) NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'open',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_message_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await conn.execute(`
          CREATE TABLE IF NOT EXISTS support_chat_messages (
            message_id VARCHAR(64) PRIMARY KEY,
            conversation_id VARCHAR(64) NOT NULL,
            sender_role VARCHAR(16) NOT NULL,
            sender_email VARCHAR(255) NULL,
            body TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES support_chat_conversations(conversation_id)
          )
        `);
      } catch {
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS support_chat_conversations (
            conversation_id VARCHAR(64) PRIMARY KEY,
            customer_user_id VARCHAR(64),
            customer_email VARCHAR(255),
            guest_id VARCHAR(128),
            status VARCHAR(16) NOT NULL DEFAULT 'open',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);

        await conn.execute(`
          CREATE TABLE IF NOT EXISTS support_chat_messages (
            message_id VARCHAR(64) PRIMARY KEY,
            conversation_id VARCHAR(64) NOT NULL REFERENCES support_chat_conversations(conversation_id),
            sender_role VARCHAR(16) NOT NULL,
            sender_email VARCHAR(255),
            body TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
      }
    } finally {
      await conn.end();
    }
  })().catch((error) => {
    ensureSchemaPromise = null;
    throw error;
  });

  return ensureSchemaPromise;
}

export async function resolveViewerProfile(request: Request): Promise<ViewerProfile> {
  const authHeader = getAuthHeader(request);
  const cookieHeader = getCookieHeader(request);
  const guestId = readGuestId(request);

  if (!authHeader && !cookieHeader) {
    return {
      role: "user",
      guestId,
    };
  }

  try {
    const response = await fetch(`${backendApiBaseUrl()}/v1/auth/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        role: "user",
        guestId,
      };
    }

    const data = await response.json().catch(() => null);
    const profile = data?.data;

    return {
      userId: profile?.id ? String(profile.id) : undefined,
      email: profile?.email ? String(profile.email).toLowerCase() : undefined,
      role: normalizeRole(profile?.role, profile?.roles),
      guestId,
    };
  } catch {
    return {
      role: "user",
      guestId,
    };
  }
}

export function isStaffOrAdmin(profile: ViewerProfile): boolean {
  return profile.role === "employee" || profile.role === "admin";
}

export async function getOrCreateCustomerConversation(profile: ViewerProfile): Promise<string> {
  await ensureSchema();

  const conn = await getConnection();
  try {
    const customerUserId = profile.userId || null;
    const customerEmail = profile.email || null;
    const guestId = profile.guestId || null;

    if (!customerUserId && !customerEmail && !guestId) {
      throw new Error("Missing customer identity");
    }

    const lookupSql = customerUserId
      ? `SELECT conversation_id FROM support_chat_conversations WHERE customer_user_id = ? ORDER BY last_message_at DESC LIMIT 1`
      : customerEmail
      ? `SELECT conversation_id FROM support_chat_conversations WHERE LOWER(customer_email) = LOWER(?) ORDER BY last_message_at DESC LIMIT 1`
      : `SELECT conversation_id FROM support_chat_conversations WHERE guest_id = ? ORDER BY last_message_at DESC LIMIT 1`;

    const lookupParam = customerUserId || customerEmail || guestId;

    const [existingRows] = await conn.execute<Array<{ conversation_id: string }>>(lookupSql, [lookupParam]);
    const existing = existingRows?.[0]?.conversation_id;
    if (existing) return existing;

    const conversationId = createId("conv");

    await conn.execute(
      `INSERT INTO support_chat_conversations (conversation_id, customer_user_id, customer_email, guest_id, status)
       VALUES (?, ?, ?, ?, 'open')`,
      [conversationId, customerUserId, customerEmail, guestId]
    );

    return conversationId;
  } finally {
    await conn.end();
  }
}

export async function assertConversationAccess(
  conversationId: string,
  profile: ViewerProfile
): Promise<{ ok: boolean; conversation?: { customer_user_id: string | null; customer_email: string | null; guest_id: string | null } }> {
  await ensureSchema();

  const conn = await getConnection();
  try {
    const [rows] = await conn.execute<
      Array<{
        customer_user_id: string | null;
        customer_email: string | null;
        guest_id: string | null;
      }>
    >(
      `SELECT customer_user_id, customer_email, guest_id
       FROM support_chat_conversations
       WHERE conversation_id = ?
       LIMIT 1`,
      [conversationId]
    );

    const conversation = rows?.[0];
    if (!conversation) return { ok: false };
    if (isStaffOrAdmin(profile)) return { ok: true, conversation };

    const byUserId = Boolean(profile.userId && conversation.customer_user_id && profile.userId === conversation.customer_user_id);
    const byEmail = Boolean(
      profile.email && conversation.customer_email && profile.email.toLowerCase() === String(conversation.customer_email).toLowerCase()
    );
    const byGuest = Boolean(profile.guestId && conversation.guest_id && profile.guestId === conversation.guest_id);

    return { ok: byUserId || byEmail || byGuest, conversation };
  } finally {
    await conn.end();
  }
}

export async function listConversationMessages(conversationId: string): Promise<ChatMessageDto[]> {
  await ensureSchema();

  const conn = await getConnection();
  try {
    const [rows] = await conn.execute<
      Array<{
        message_id: string;
        conversation_id: string;
        sender_role: string;
        sender_email: string | null;
        body: string;
        created_at: string;
      }>
    >(
      `SELECT message_id, conversation_id, sender_role, sender_email, body, created_at
       FROM support_chat_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`,
      [conversationId]
    );

    return (rows || []).map((row) => ({
      messageId: row.message_id,
      conversationId: row.conversation_id,
      senderRole: (row.sender_role as ChatRole) || "customer",
      senderEmail: row.sender_email || null,
      body: row.body,
      createdAt: toIso(row.created_at),
    }));
  } finally {
    await conn.end();
  }
}

export async function createMessage(
  conversationId: string,
  senderRole: ChatRole,
  senderEmail: string | null,
  body: string
): Promise<void> {
  await ensureSchema();

  const conn = await getConnection();
  try {
    const messageId = createId("msg");
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO support_chat_messages (message_id, conversation_id, sender_role, sender_email, body)
       VALUES (?, ?, ?, ?, ?)`,
      [messageId, conversationId, senderRole, senderEmail, body]
    );

    await conn.execute(
      `UPDATE support_chat_conversations
       SET updated_at = CURRENT_TIMESTAMP, last_message_at = CURRENT_TIMESTAMP
       WHERE conversation_id = ?`,
      [conversationId]
    );

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

export async function listConversationsForStaff(limit: number): Promise<ConversationSummaryDto[]> {
  await ensureSchema();

  const conn = await getConnection();
  try {
    const [rows] = await conn.execute<
      Array<{
        conversation_id: string;
        customer_email: string | null;
        guest_id: string | null;
        status: string;
        last_message_at: string;
        last_message_preview: string | null;
      }>
    >(
      `SELECT c.conversation_id,
              c.customer_email,
              c.guest_id,
              c.status,
              c.last_message_at,
              (
                SELECT m.body
                FROM support_chat_messages m
                WHERE m.conversation_id = c.conversation_id
                ORDER BY m.created_at DESC
                LIMIT 1
              ) AS last_message_preview
       FROM support_chat_conversations c
       ORDER BY c.last_message_at DESC
       LIMIT ?`,
      [Math.max(1, Math.min(limit || 30, 100))]
    );

    return (rows || []).map((row) => ({
      conversationId: row.conversation_id,
      customerLabel: row.customer_email || row.guest_id || "Guest customer",
      status: row.status || "open",
      lastMessageAt: toIso(row.last_message_at),
      lastMessagePreview: (row.last_message_preview || "").slice(0, 160),
    }));
  } finally {
    await conn.end();
  }
}

export function dbFailureResponse(error: unknown) {
  const db = getDbRuntimeInfo();
  const message = error instanceof Error ? error.message : String(error);

  return {
    error: "Support chat is unavailable",
    details: message,
    db: `${db.client}@${db.host}:${db.port}`,
  };
}
