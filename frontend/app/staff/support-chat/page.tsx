"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser } from "@/lib/auth";
import { Client, StompSubscription } from "@stomp/stompjs";
import { createSupportChatStompClient, parseStompJson } from "@/lib/supportChatSocket";
import "./support-chat.css";

type ConversationItem = {
  conversationId: string;
  customerLabel: string;
  status: "open" | "in_progress" | "resolved" | string;
  priority?: "low" | "normal" | "high" | "urgent" | string;
  assignedToEmail?: string | null;
  assignedToUserId?: string | null;
  internalNote?: string | null;
  createdAt?: string | null;
  lastMessageAt: string;
  lastMessagePreview: string;
};

type SupportMessage = {
  messageId: string;
  conversationId: string;
  senderRole: "customer" | "employee" | "admin";
  senderEmail: string | null;
  body: string;
  createdAt: string;
};

type ConversationListResponse = {
  conversations?: ConversationItem[];
  error?: string;
};

type ConversationMessagesResponse = {
  conversationId?: string;
  conversation?: ConversationItem;
  messages?: SupportMessage[];
  error?: string;
};

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return "-";
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function StaffSupportChatPage() {
  const router = useRouter();
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [internalNoteDraft, setInternalNoteDraft] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [error, setError] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);

  const endRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<Client | null>(null);
  const activeConversationSubscriptionRef = useRef<StompSubscription | null>(null);
  const staffConversationSubscriptionRef = useRef<StompSubscription | null>(null);
  const token = getToken();
  const currentUser = getUser();

  useEffect(() => {
    const checkAccess = async () => {
      const user = getUser();
      if (!user || !token) {
        router.replace("/login");
        return;
      }

      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setAllowed(false);
          return;
        }

        const profile = data?.data;
        const role = String(profile?.role || "").toLowerCase();
        const roles = Array.isArray(profile?.roles)
          ? profile.roles.map((value: string) => String(value).toUpperCase())
          : [];

        const allowedRole =
          role === "admin" ||
          role === "employee" ||
          roles.includes("ROLE_ADMIN") ||
          roles.includes("ROLE_EMPLOYEE") ||
          roles.includes("ROLE_STAFF");

        setAllowed(allowedRole);
      } catch {
        setAllowed(false);
      } finally {
        setLoadingAccess(false);
      }
    };

    void checkAccess();
  }, [router, token]);

  const fetchConversations = useCallback(async () => {
    const response = await fetch("/api/support-chat/conversations?limit=50", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    });

    const data = (await response.json().catch(() => ({}))) as ConversationListResponse;
    if (!response.ok) {
      throw new Error(data.error || `Failed to load conversations (${response.status})`);
    }

    const nextConversations = Array.isArray(data.conversations) ? data.conversations : [];
    setConversations(nextConversations);

    if (!activeConversationId && nextConversations[0]?.conversationId) {
      setActiveConversationId(nextConversations[0].conversationId);
    }

    if (activeConversationId) {
      const stillExists = nextConversations.some((item) => item.conversationId === activeConversationId);
      if (!stillExists) {
        setActiveConversationId(nextConversations[0]?.conversationId || "");
      }
    }
  }, [activeConversationId, token]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!conversationId) return;

    setLoadingMessages(true);
    try {
      const response = await fetch(`/api/support-chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
      });

      const data = (await response.json().catch(() => ({}))) as ConversationMessagesResponse;
      if (!response.ok) {
        throw new Error(data.error || `Failed to load messages (${response.status})`);
      }

      setMessages(Array.isArray(data.messages) ? data.messages : []);
      if (data.conversation) {
        setConversations((current) =>
          current.map((item) => (item.conversationId === conversationId ? { ...item, ...data.conversation } : item))
        );
        setInternalNoteDraft(data.conversation.internalNote || "");
      }
      setError("");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to load messages.");
    } finally {
      setLoadingMessages(false);
    }
  }, [token]);

  useEffect(() => {
    if (!allowed) return;
    let canceled = false;

    void fetchConversations().catch((loadError: unknown) => {
      if (!canceled) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load conversations.");
      }
    });

    return () => {
      canceled = true;
    };
  }, [allowed, fetchConversations]);

  useEffect(() => {
    if (!allowed || !activeConversationId) return;
    void fetchMessages(activeConversationId);
  }, [allowed, activeConversationId, fetchMessages]);

  useEffect(() => {
    if (!allowed) return;

    const client = createSupportChatStompClient({
      token,
      onConnect: () => {
        setSocketConnected(true);
        setError("");
      },
      onStompError: (socketError) => {
        setError(`Realtime channel error: ${socketError}`);
      },
      onSocketError: () => {
        setSocketConnected(false);
      },
    });

    clientRef.current = client;
    client.activate();

    return () => {
      activeConversationSubscriptionRef.current?.unsubscribe();
      staffConversationSubscriptionRef.current?.unsubscribe();
      activeConversationSubscriptionRef.current = null;
      staffConversationSubscriptionRef.current = null;
      setSocketConnected(false);
      client.deactivate();
      if (clientRef.current === client) {
        clientRef.current = null;
      }
    };
  }, [allowed, token]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client || !client.connected) return;

    staffConversationSubscriptionRef.current?.unsubscribe();
    staffConversationSubscriptionRef.current = client.subscribe("/topic/support-chat/staff/conversations", (frame) => {
      const update = parseStompJson<ConversationItem>(frame);
      if (!update?.conversationId) return;
      setConversations((current) => {
        const exists = current.some((item) => item.conversationId === update.conversationId);
        if (!exists) {
          return [update, ...current];
        }
        return current
          .map((item) => (item.conversationId === update.conversationId ? { ...item, ...update } : item))
          .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      });
    });

    return () => {
      staffConversationSubscriptionRef.current?.unsubscribe();
      staffConversationSubscriptionRef.current = null;
    };
  }, [socketConnected]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client || !client.connected || !activeConversationId) return;

    activeConversationSubscriptionRef.current?.unsubscribe();
    activeConversationSubscriptionRef.current = client.subscribe(
      `/topic/support-chat/conversations/${activeConversationId}`,
      (frame) => {
        const payload = parseStompJson<ConversationMessagesResponse>(frame);
        if (!payload) return;
        if (payload.conversation) {
          setConversations((current) =>
            current.map((item) =>
              item.conversationId === payload.conversation!.conversationId ? { ...item, ...payload.conversation } : item
            )
          );
          setInternalNoteDraft(payload.conversation.internalNote || "");
        }
        if (Array.isArray(payload.messages)) {
          setMessages(payload.messages);
        }
      }
    );

    return () => {
      activeConversationSubscriptionRef.current?.unsubscribe();
      activeConversationSubscriptionRef.current = null;
    };
  }, [activeConversationId, socketConnected]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.conversationId === activeConversationId) || null,
    [activeConversationId, conversations]
  );

  const canSend = useMemo(() => draft.trim().length > 0 && !sending && !!activeConversationId, [draft, sending, activeConversationId]);

  const sendReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending || !activeConversationId) return;

    setSending(true);

    try {
      const client = clientRef.current;
      if (client && client.connected) {
        client.publish({
          destination: "/app/support-chat.send",
          body: JSON.stringify({
            conversationId: activeConversationId,
            message: text,
          }),
        });
        setDraft("");
        setError("");
        return;
      }

      const response = await fetch(`/api/support-chat/conversations/${encodeURIComponent(activeConversationId)}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text }),
      });

      const data = (await response.json().catch(() => ({}))) as ConversationMessagesResponse;
      if (!response.ok) {
        throw new Error(data.error || `Failed to send message (${response.status})`);
      }

      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setDraft("");
      setError("");
      await fetchConversations();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const updateConversation = async (payload: Record<string, unknown>) => {
    if (!activeConversationId) return;

    setSavingWorkflow(true);
    try {
      const response = await fetch(`/api/support-chat/conversations/${encodeURIComponent(activeConversationId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as ConversationMessagesResponse;
      if (!response.ok) {
        throw new Error(data.error || `Failed to update conversation (${response.status})`);
      }

      if (data.conversation) {
        setConversations((current) =>
          current.map((item) =>
            item.conversationId === activeConversationId ? { ...item, ...data.conversation } : item
          )
        );
        setInternalNoteDraft(data.conversation.internalNote || "");
      }
      if (Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
      setError("");
      await fetchConversations();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to update conversation.");
    } finally {
      setSavingWorkflow(false);
    }
  };

  if (loadingAccess) {
    return (
      <section className="staffSupportChatPage">
        <div className="staffSupportChatCard">
          <h1>Support Inbox</h1>
          <p>Checking access...</p>
        </div>
      </section>
    );
  }

  if (!allowed) {
    return (
      <section className="staffSupportChatPage">
        <div className="staffSupportChatCard">
          <h1>Support Inbox</h1>
          <p>You need employee or admin permissions to access this page.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="staffSupportChatPage">
      <div className="staffSupportChatCard">
        <aside className="staffConversationList">
          <header>
            <h2>Support Queue</h2>
            <p>{conversations.length} active conversations</p>
            <p>Realtime: {socketConnected ? "Connected" : "Connecting..."}</p>
          </header>
          <div className="staffConversationItems">
            {conversations.length === 0 ? <p className="staffEmpty">No conversations yet.</p> : null}
            {conversations.map((item) => (
              <button
                type="button"
                key={item.conversationId}
                className={`staffConversationItem ${item.conversationId === activeConversationId ? "active" : ""}`}
                onClick={() => setActiveConversationId(item.conversationId)}
              >
                <div className="staffConversationMeta">
                  <strong>{item.customerLabel}</strong>
                  <span className={`staffStatusBadge status-${String(item.status || "open").toLowerCase()}`}>
                    {String(item.status || "open").replaceAll("_", " ")}
                  </span>
                </div>
                <div className="staffConversationTagRow">
                  <span className={`staffPriorityTag priority-${String(item.priority || "normal").toLowerCase()}`}>
                    {item.priority || "normal"}
                  </span>
                  <span>{item.assignedToEmail || "Unassigned"}</span>
                </div>
                <span>{item.lastMessagePreview || "No messages yet"}</span>
                <small>{formatRelativeTime(item.lastMessageAt)}</small>
              </button>
            ))}
          </div>
        </aside>

        <main className="staffConversationThread">
          <header className="staffThreadHeader">
            <div>
              <h2>{activeConversation ? activeConversation.customerLabel : "Select a conversation"}</h2>
              <p>
                {activeConversation
                  ? `Opened ${formatRelativeTime(activeConversation.createdAt)} · last reply ${formatRelativeTime(activeConversation.lastMessageAt)}`
                  : "Pick a conversation to start."}
              </p>
            </div>
            {activeConversation ? (
              <button
                type="button"
                className="staffClaimButton"
                onClick={() => void updateConversation({ assignToSelf: true })}
                disabled={savingWorkflow}
              >
                {savingWorkflow ? "Saving..." : activeConversation.assignedToEmail === currentUser?.email ? "Assigned to you" : "Assign to me"}
              </button>
            ) : null}
          </header>

          {activeConversation ? (
            <section className="staffWorkflowPanel">
              <div className="staffWorkflowField">
                <label>Status</label>
                <select
                  value={activeConversation.status || "open"}
                  onChange={(event) => void updateConversation({ status: event.target.value })}
                  disabled={savingWorkflow}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="staffWorkflowField">
                <label>Priority</label>
                <select
                  value={activeConversation.priority || "normal"}
                  onChange={(event) => void updateConversation({ priority: event.target.value })}
                  disabled={savingWorkflow}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="staffWorkflowField staffWorkflowFieldWide">
                <label>Internal note</label>
                <textarea
                  value={internalNoteDraft}
                  onChange={(event) => setInternalNoteDraft(event.target.value)}
                  placeholder="Add a private handoff note for the support team."
                  rows={3}
                />
              </div>
              <div className="staffWorkflowActions">
                <button
                  type="button"
                  onClick={() => void updateConversation({ internalNote: internalNoteDraft })}
                  disabled={savingWorkflow}
                >
                  {savingWorkflow ? "Saving..." : "Save Note"}
                </button>
                <button
                  type="button"
                  onClick={() => void updateConversation({ clearAssignment: true })}
                  disabled={savingWorkflow || !activeConversation.assignedToEmail}
                >
                  Clear Assignment
                </button>
              </div>
            </section>
          ) : null}

          <div className="staffThreadMessages" role="log" aria-live="polite">
            {loadingMessages ? <p className="staffEmpty">Loading messages...</p> : null}
            {!loadingMessages && !activeConversationId ? <p className="staffEmpty">Pick a conversation to start.</p> : null}
            {!loadingMessages && activeConversationId && messages.length === 0 ? (
              <p className="staffEmpty">No messages in this conversation yet.</p>
            ) : null}

            {messages.map((message) => {
              const isTeam = message.senderRole === "employee" || message.senderRole === "admin";
              return (
                <article key={message.messageId} className={`staffThreadBubble ${isTeam ? "team" : "customer"}`}>
                  <p>{message.body}</p>
                  <span>{new Date(message.createdAt).toLocaleString()}</span>
                </article>
              );
            })}
            <div ref={endRef} />
          </div>

          {error ? <p className="staffSupportError">{error}</p> : null}

          <form className="staffReplyComposer" onSubmit={sendReply}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Reply to customer..."
              rows={3}
              disabled={!activeConversationId}
            />
            <button type="submit" disabled={!canSend}>
              {sending ? "Sending..." : "Send Reply"}
            </button>
          </form>
        </main>
      </div>
    </section>
  );
}
