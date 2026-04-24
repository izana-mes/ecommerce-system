import { NextResponse } from "next/server";
import {
  assertConversationAccess,
  createMessage,
  dbFailureResponse,
  getOrCreateCustomerConversation,
  listConversationMessages,
  normalizeText,
  resolveViewerProfile,
} from "../_shared";

type SendMessageBody = {
  conversationId?: string;
  message?: string;
};

export async function GET(request: Request) {
  try {
    const profile = await resolveViewerProfile(request);
    const url = new URL(request.url);
    const requestedConversationId = normalizeText(url.searchParams.get("conversationId"), 80);

    const conversationId = requestedConversationId || (await getOrCreateCustomerConversation(profile));
    const access = await assertConversationAccess(conversationId, profile);

    if (!access.ok) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const messages = await listConversationMessages(conversationId);
    return NextResponse.json({
      conversationId,
      messages,
    });
  } catch (error: unknown) {
    return NextResponse.json(dbFailureResponse(error), { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const profile = await resolveViewerProfile(request);
    const body = ((await request.json().catch(() => ({}))) || {}) as SendMessageBody;

    const message = normalizeText(body.message, 2000);
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const requestedConversationId = normalizeText(body.conversationId, 80);
    const conversationId = requestedConversationId || (await getOrCreateCustomerConversation(profile));

    const access = await assertConversationAccess(conversationId, profile);
    if (!access.ok) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    await createMessage(conversationId, "customer", profile.email || null, message);
    const messages = await listConversationMessages(conversationId);

    return NextResponse.json({
      conversationId,
      messages,
    });
  } catch (error: unknown) {
    return NextResponse.json(dbFailureResponse(error), { status: 500 });
  }
}
