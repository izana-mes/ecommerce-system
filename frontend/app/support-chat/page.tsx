"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getToken, getUser } from "@/lib/auth";
import "./support-chat.css";

type SupportMessage = {
  messageId: string;
  conversationId: string;
  senderRole: "customer" | "staff" | "admin";
  senderEmail: string | null;
  body: string;
  createdAt: string;
};

type SupportChatResponse = {
  conversationId?: string;
  messages?: SupportMessage[];
  error?: string;
};

const GUEST_KEY = "support-chat-guest-id";

function createGuestId(): string {
  const randomPart = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `guest_${randomPart.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}`;
}

function getGuestId(): string {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(GUEST_KEY);
  if (existing) return existing;

  const nextValue = createGuestId();
  localStorage.setItem(GUEST_KEY, nextValue);
  return nextValue;
}

export default function SupportChatPage() {
  const [conversationId, setConversationId] = useState<string>("");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [guestId, setGuestId] = useState("");

  const endRef = useRef<HTMLDivElement | null>(null);

  const customer = getUser();
  const token = getToken();

  useEffect(() => {
    setGuestId(getGuestId());
  }, []);

  const fetchMessages = useCallback(async (targetConversationId?: string) => {
    const query = targetConversationId ? `?conversationId=${encodeURIComponent(targetConversationId)}` : "";
    const response = await fetch(`/api/support-chat/messages${query}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(guestId ? { "x-guest-id": guestId } : {}),
      },
      cache: "no-store",
    });

    const data = (await response.json().catch(() => ({}))) as SupportChatResponse;
    if (!response.ok) {
      throw new Error(data.error || `Failed to load chat (${response.status})`);
    }

    setConversationId(String(data.conversationId || ""));
    setMessages(Array.isArray(data.messages) ? data.messages : []);
    setError("");
  }, [guestId, token]);

  useEffect(() => {
    if (!guestId) return;

    let cancelled = false;

    const load = async () => {
      try {
        await fetchMessages();
      } catch (error: unknown) {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : "Failed to load support chat.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    const intervalId = window.setInterval(() => {
      void fetchMessages(conversationId || undefined).catch(() => {
        // Keep silent retries for real-time polling.
      });
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [guestId, conversationId, fetchMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const canSend = useMemo(() => draft.trim().length > 0 && !sending, [draft, sending]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);

    try {
      const response = await fetch("/api/support-chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(guestId ? { "x-guest-id": guestId } : {}),
        },
        body: JSON.stringify({
          conversationId: conversationId || undefined,
          message: text,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as SupportChatResponse;
      if (!response.ok) {
        throw new Error(data.error || `Failed to send message (${response.status})`);
      }

      setConversationId(String(data.conversationId || conversationId));
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setDraft("");
      setError("");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="supportChatPage">
      <div className="supportChatContainer">
        <header className="supportChatHeader">
          <h1>Live Support Chat</h1>
          <p>Chat directly with staff and administrators in real time.</p>
          <p className="supportChatIdentity">
            You are signed in as: {customer?.email || "Guest"}
          </p>
        </header>

        <div className="supportChatMessages" role="log" aria-live="polite">
          {loading ? <p className="supportChatHint">Loading chat...</p> : null}
          {!loading && messages.length === 0 ? (
            <p className="supportChatHint">Start the conversation. Staff will reply here.</p>
          ) : null}

          {messages.map((message) => {
            const isCustomer = message.senderRole === "customer";
            return (
              <article key={message.messageId} className={`supportChatBubble ${isCustomer ? "customer" : "staff"}`}>
                <p>{message.body}</p>
                <span>{new Date(message.createdAt).toLocaleString()}</span>
              </article>
            );
          })}
          <div ref={endRef} />
        </div>

        {error ? <p className="supportChatError">{error}</p> : null}

        <form className="supportChatComposer" onSubmit={sendMessage}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type your message for support..."
            rows={3}
          />
          <button type="submit" disabled={!canSend}>
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      </div>
    </section>
  );
}
