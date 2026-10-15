import type { ChatConversation, ChatMessage, UserSearchResult } from "./types";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = `Request failed (${res.status})`;
    try {
      const parsed = JSON.parse(text);
      msg = parsed?.message || parsed?.error || msg;
    } catch {}
    throw new Error(msg);
  }
  // Mutating chat endpoints (notably reaction toggles) can successfully return
  // an empty 200/204 response. Do not attempt to JSON.parse an empty body.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function fetchConversations(search?: string): Promise<ChatConversation[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await fetch(`/api/conversations${query}`, {
    credentials: "include",
    cache: "no-store",
  });
  return handleResponse<ChatConversation[]>(res);
}

export async function fetchConversation(conversationId: string): Promise<ChatConversation> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}`, {
    credentials: "include",
    cache: "no-store",
  });
  return handleResponse<ChatConversation>(res);
}

export async function createDirectConversation(targetUserId: string, initialMessage?: string): Promise<ChatConversation> {
  const res = await fetch(`/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      type: "direct",
      targetUserId,
      initialMessage,
    }),
  });
  return handleResponse<ChatConversation>(res);
}

export async function createSupportConversation(initialMessage?: string): Promise<ChatConversation> {
  const res = await fetch(`/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      type: "support",
      initialMessage,
    }),
  });
  return handleResponse<ChatConversation>(res);
}

export async function fetchMessages(
  conversationId: string,
  before?: string,
  limit = 50
): Promise<ChatMessage[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set("before", before);
  const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages?${params}`, {
    credentials: "include",
    cache: "no-store",
  });
  return handleResponse<ChatMessage[]>(res);
}

export async function sendMessageApi(
  conversationId: string,
  body: string,
  replyToMessageId?: string
): Promise<ChatMessage> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ body, replyToMessageId }),
  });
  return handleResponse<ChatMessage>(res);
}

export async function editMessageApi(messageId: string, body: string): Promise<ChatMessage> {
  const res = await fetch(`/api/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ body }),
  });
  return handleResponse<ChatMessage>(res);
}

export async function deleteMessageApi(messageId: string): Promise<void> {
  const res = await fetch(`/api/messages/${encodeURIComponent(messageId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  return handleResponse<void>(res);
}

export async function toggleReactionApi(messageId: string, reaction: string): Promise<ChatMessage> {
  const res = await fetch(`/api/messages/${encodeURIComponent(messageId)}/reactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ reaction }),
  });
  return handleResponse<ChatMessage>(res);
}

export async function markAsReadApi(conversationId: string): Promise<void> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse<void>(res);
}

export async function searchUsersApi(query: string): Promise<UserSearchResult[]> {
  const res = await fetch(`/api/conversations/users/search?q=${encodeURIComponent(query)}`, {
    credentials: "include",
    cache: "no-store",
  });
  return handleResponse<UserSearchResult[]>(res);
}

/** Returns the API's bounded, real user-discovery result set for a new chat. */
export async function fetchDiscoverableUsers(): Promise<UserSearchResult[]> {
  // The current server-side search is SQL-LIKE based; `%` requests its
  // existing limited directory without inventing a client-side user list.
  return searchUsersApi("%");
}
