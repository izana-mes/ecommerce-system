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

type ConversationRecord = {
  conversationId: string;
  customerUserId: string | null;
  customerEmail: string | null;
  guestId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
};

let ensureSchemaPromise: Promise<void> | null = null;
let storageMode: "auto" | "db" | "memory" = "auto";

const memoryConversations = new Map<string, ConversationRecord>();
const memoryMessages = new Map<string, ChatMessageDto[]>();

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

function isDbUnavailableError(error: unknown): boolean {
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  return (
    message.includes("database connection failed") ||
    message.includes("aggregateerror") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("timeout") ||
    message.includes("access denied") ||
    message.includes("permission denied")
  );
}

function shouldUseMemory(error?: unknown): boolean {
  if (storageMode === "memory") return true;
  if (!error) return false;
  if (isDbUnavailableError(error)) {
    storageMode = "memory";
    return true;
  }
  return false;
}

function profileMatchesConversation(profile: ViewerProfile, conversation: ConversationRecord): boolean {
  if (isStaffOrAdmin(profile)) return true;

  const byUserId = Boolean(profile.userId && conversation.customerUserId && profile.userId === conversation.customerUserId);
  const byEmail = Boolean(
    profile.email && conversation.customerEmail && profile.email.toLowerCase() === String(conversation.customerEmail).toLowerCase()
  );
  const byGuest = Boolean(profile.guestId && conversation.guestId && profile.guestId === conversation.guestId);

  return byUserId || byEmail || byGuest;
}

function getMemoryConversationByIdentity(profile: ViewerProfile): ConversationRecord | undefined {
  const conversations = Array.from(memoryConversations.values()).sort((a, b) =>
    new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );

  if (profile.userId) {
    return conversations.find((item) => item.customerUserId === profile.userId);
  }
  if (profile.email) {
    const email = profile.email.toLowerCase();
    return conversations.find((item) => (item.customerEmail || "").toLowerCase() === email);
  }
  if (profile.guestId) {
    return conversations.find((item) => item.guestId === profile.guestId);
  }
  return undefined;
}

function memoryGetOrCreateConversation(profile: ViewerProfile): string {
  const customerUserId = profile.userId || null;
  const customerEmail = profile.email || null;
  const guestId = profile.guestId || null;

  if (!customerUserId && !customerEmail && !guestId) {
    throw new Error("Missing customer identity");
  }

  const existing = getMemoryConversationByIdentity(profile);
  if (existing) return existing.conversationId;

  const now = new Date().toISOString();
  const conversationId = createId("conv");

  memoryConversations.set(conversationId, {
    conversationId,
    customerUserId,
    customerEmail,
    guestId,
    status: "open",
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
  });

  memoryMessages.set(conversationId, []);
  return conversationId;
}

function memoryAssertAccess(conversationId: string, profile: ViewerProfile) {
  const conversation = memoryConversations.get(conversationId);
  if (!conversation) return { ok: false };

  return {
    ok: profileMatchesConversation(profile, conversation),
    conversation: {
      customer_user_id: conversation.customerUserId,
      customer_email: conversation.customerEmail,
      guest_id: conversation.guestId,
    },
  };
}

function memoryListMessages(conversationId: string): ChatMessageDto[] {
  return [...(memoryMessages.get(conversationId) || [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function memoryCreateMessage(conversationId: string, senderRole: ChatRole, senderEmail: string | null, body: string): void {
  const conversation = memoryConversations.get(conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const now = new Date().toISOString();
  const nextMessage: ChatMessageDto = {
    messageId: createId("msg"),
    conversationId,
    senderRole,
    senderEmail,
    body,
    createdAt: now,
  };

  const current = memoryMessages.get(conversationId) || [];
  current.push(nextMessage);
  memoryMessages.set(conversationId, current);

  conversation.updatedAt = now;
  conversation.lastMessageAt = now;
  memoryConversations.set(conversationId, conversation);
}

function memoryListConversations(limit: number): ConversationSummaryDto[] {
  const max = Math.max(1, Math.min(limit || 30, 100));
  const conversations = Array.from(memoryConversations.values())
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
    .slice(0, max);

  return conversations.map((conversation) => {
    const messages = memoryMessages.get(conversation.conversationId) || [];
    const lastMessage = messages[messages.length - 1];
    return {
      conversationId: conversation.conversationId,
      customerLabel: conversation.customerEmail || conversation.guestId || "Guest customer",
      status: conversation.status,
      lastMessageAt: toIso(conversation.lastMessageAt),
      lastMessagePreview: (lastMessage?.body || "").slice(0, 160),
    };
  });
}

async function ensureSchema(): Promise<void> {
  if (storageMode === "memory") return;
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

      storageMode = "db";
    } finally {
      await conn.end();
    }
  })().catch((error) => {
    ensureSchemaPromise = null;
    if (shouldUseMemory(error)) {
      return;
    }
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
  try {
    await ensureSchema();
    if (storageMode === "memory") {
      return memoryGetOrCreateConversation(profile);
    }

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
  } catch (error) {
    if (shouldUseMemory(error)) {
      return memoryGetOrCreateConversation(profile);
    }
    throw error;
  }
}

export async function assertConversationAccess(
  conversationId: string,
  profile: ViewerProfile
): Promise<{ ok: boolean; conversation?: { customer_user_id: string | null; customer_email: string | null; guest_id: string | null } }> {
  try {
    await ensureSchema();
    if (storageMode === "memory") {
      return memoryAssertAccess(conversationId, profile);
    }

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
  } catch (error) {
    if (shouldUseMemory(error)) {
      return memoryAssertAccess(conversationId, profile);
    }
    throw error;
  }
}

export async function listConversationMessages(conversationId: string): Promise<ChatMessageDto[]> {
  try {
    await ensureSchema();
    if (storageMode === "memory") {
      return memoryListMessages(conversationId);
    }

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
  } catch (error) {
    if (shouldUseMemory(error)) {
      return memoryListMessages(conversationId);
    }
    throw error;
  }
}

export async function createMessage(
  conversationId: string,
  senderRole: ChatRole,
  senderEmail: string | null,
  body: string
): Promise<void> {
  try {
    await ensureSchema();
    if (storageMode === "memory") {
      memoryCreateMessage(conversationId, senderRole, senderEmail, body);
      return;
    }

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
  } catch (error) {
    if (shouldUseMemory(error)) {
      memoryCreateMessage(conversationId, senderRole, senderEmail, body);
      return;
    }
    throw error;
  }
}

export async function listConversationsForStaff(limit: number): Promise<ConversationSummaryDto[]> {
  try {
    await ensureSchema();
    if (storageMode === "memory") {
      return memoryListConversations(limit);
    }

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
  } catch (error) {
    if (shouldUseMemory(error)) {
      return memoryListConversations(limit);
    }
    throw error;
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
