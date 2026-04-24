"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser } from "@/lib/auth";
import "./support-chat.css";

type ConversationItem = {
  conversationId: string;
  customerLabel: string;
  status: string;
  lastMessageAt: string;
  lastMessagePreview: string;
};

type SupportMessage = {
  messageId: string;
  conversationId: string;
  senderRole: "customer" | "staff" | "admin";
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
  messages?: SupportMessage[];
  error?: string;
};

export default function StaffSupportChatPage() {
  const router = useRouter();
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const endRef = useRef<HTMLDivElement | null>(null);
  const token = getToken();

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

    const refresh = async () => {
      try {
        await fetchConversations();
      } catch (error: unknown) {
        if (!canceled) {
          setError(error instanceof Error ? error.message : "Failed to load conversations.");
        }
      }
    };

    void refresh();

    const intervalId = window.setInterval(() => {
      void fetchConversations().catch(() => {
        // Keep polling even when a single attempt fails.
      });
    }, 2000);

    return () => {
      canceled = true;
      window.clearInterval(intervalId);
    };
  }, [allowed, fetchConversations]);

  useEffect(() => {
    if (!allowed || !activeConversationId) return;

    void fetchMessages(activeConversationId);

    const intervalId = window.setInterval(() => {
      void fetchMessages(activeConversationId).catch(() => {
        // Keep polling for near real-time updates.
      });
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [allowed, activeConversationId, fetchMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const canSend = useMemo(() => draft.trim().length > 0 && !sending && !!activeConversationId, [draft, sending, activeConversationId]);

  const sendReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending || !activeConversationId) return;

    setSending(true);

    try {
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
            <h2>Live Conversations</h2>
            <p>{conversations.length} active</p>
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
                <strong>{item.customerLabel}</strong>
                <span>{item.lastMessagePreview || "No messages yet"}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="staffConversationThread">
          <header className="staffThreadHeader">
            <h2>{activeConversationId ? `Conversation ${activeConversationId}` : "Select a conversation"}</h2>
          </header>

          <div className="staffThreadMessages" role="log" aria-live="polite">
            {loadingMessages ? <p className="staffEmpty">Loading messages...</p> : null}
            {!loadingMessages && !activeConversationId ? <p className="staffEmpty">Pick a conversation to start.</p> : null}
            {!loadingMessages && activeConversationId && messages.length === 0 ? (
              <p className="staffEmpty">No messages in this conversation yet.</p>
            ) : null}

            {messages.map((message) => {
              const isTeam = message.senderRole === "staff" || message.senderRole === "admin";
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
