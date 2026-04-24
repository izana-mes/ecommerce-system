import { NextResponse } from "next/server";
import {
  assertConversationAccess,
  createMessage,
  dbFailureResponse,
  isStaffOrAdmin,
  listConversationMessages,
  normalizeText,
  resolveViewerProfile,
} from "../../../_shared";

type SendReplyBody = {
  message?: string;
};

type RouteParams = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function GET(request: Request, context: RouteParams) {
  try {
    const profile = await resolveViewerProfile(request);
    if (!isStaffOrAdmin(profile)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { conversationId } = await context.params;
    const normalizedConversationId = normalizeText(conversationId, 80);
    if (!normalizedConversationId) {
      return NextResponse.json({ error: "Invalid conversation" }, { status: 400 });
    }

    const access = await assertConversationAccess(normalizedConversationId, profile);
    if (!access.ok) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const messages = await listConversationMessages(normalizedConversationId);
    return NextResponse.json({
      conversationId: normalizedConversationId,
      messages,
    });
  } catch (error: unknown) {
    return NextResponse.json(dbFailureResponse(error), { status: 500 });
  }
}

export async function POST(request: Request, context: RouteParams) {
  try {
    const profile = await resolveViewerProfile(request);
    if (!isStaffOrAdmin(profile)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { conversationId } = await context.params;
    const normalizedConversationId = normalizeText(conversationId, 80);
    if (!normalizedConversationId) {
      return NextResponse.json({ error: "Invalid conversation" }, { status: 400 });
    }

    const access = await assertConversationAccess(normalizedConversationId, profile);
    if (!access.ok) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const body = ((await request.json().catch(() => ({}))) || {}) as SendReplyBody;
    const message = normalizeText(body.message, 2000);
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    await createMessage(normalizedConversationId, profile.role === "admin" ? "admin" : "staff", profile.email || null, message);
    const messages = await listConversationMessages(normalizedConversationId);

    return NextResponse.json({
      conversationId: normalizedConversationId,
      messages,
    });
  } catch (error: unknown) {
    return NextResponse.json(dbFailureResponse(error), { status: 500 });
  }
}
