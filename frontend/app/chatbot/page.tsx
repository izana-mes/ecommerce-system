"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getToken } from "@/lib/auth";
import "./chatbot.css";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type CustomerChatResponse = {
  answer?: string;
  error?: string;
  conversationId?: string;
  usedAi?: boolean;
};

type StreamMeta = {
  conversationId?: string;
};

const CHATBOT_GUEST_KEY = "customer-chatbot-guest-id";
const CHATBOT_CONVERSATION_KEY = "customer-chatbot-conversation-id";

function createGuestId(): string {
  const randomPart =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `guest_${randomPart.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}`;
}

function getOrCreateStorageValue(key: string, createValue: () => string): string {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(key);
  if (existing) return existing;

  const nextValue = createValue();
  localStorage.setItem(key, nextValue);
  return nextValue;
}

function createMessage(role: "user" | "assistant", text: string): Message {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    text,
  };
}

const QUICK_PROMPTS = [
  "Show products for jacket",
  "What is your return policy?",
  "Do you offer shipping support?",
  "Check order ORD-1001 with customer@example.com",
  "Find product price for Kirby T-Shirt",
];

export default function CustomerChatbotPage() {
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [guestId, setGuestId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    createMessage(
      "assistant",
      "Customer assistant is online. Ask about products, stock, prices, shipping/returns, or your order status."
    ),
  ]);

  const canSend = useMemo(() => question.trim().length > 0 && !sending, [question, sending]);

  useEffect(() => {
    setGuestId(getOrCreateStorageValue(CHATBOT_GUEST_KEY, createGuestId));
    if (typeof window !== "undefined") {
      setConversationId(localStorage.getItem(CHATBOT_CONVERSATION_KEY) || "");
    }
  }, []);

  const sendQuestion = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setMessages((prev) => [...prev, createMessage("user", trimmed)]);
    setQuestion("");

    try {
      const token = getToken();
      const response = await fetch("/api/chatbot/customer/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(guestId ? { "x-guest-id": guestId } : {}),
        },
        body: JSON.stringify({
          question: trimmed,
          conversationId: conversationId || undefined,
        }),
      });
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as CustomerChatResponse;
        setMessages((prev) => [...prev, createMessage("assistant", data.error || `Request failed (${response.status})`)]);
        return;
      }

      const assistantId = `${Date.now()}-assistant`;
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", text: "" }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const eventChunk of events) {
          const event = eventChunk.match(/^event: (.+)$/m)?.[1]?.trim();
          const dataText = eventChunk.match(/^data: (.+)$/m)?.[1]?.trim();
          if (!event || !dataText) continue;
          const data = JSON.parse(dataText) as { token?: string } & StreamMeta;

          if (event === "meta" && data.conversationId) {
            setConversationId(data.conversationId);
            if (typeof window !== "undefined") localStorage.setItem(CHATBOT_CONVERSATION_KEY, data.conversationId);
          }
          if (event === "token" && data.token) {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, text: `${m.text}${data.token ?? ""}` } : m))
            );
          }
        }
      }
    } catch {
      setMessages((prev) => [...prev, createMessage("assistant", "Request failed. Please try again.")]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendQuestion(question);
  };

  return (
    <section className="customerChatbotPage">
      <div className="customerChatbotContainer">
        <header className="customerChatbotHeader">
          <h1>AI Customer Assistant</h1>
          <p>Ask product and order questions here. This page talks to the AI assistant, not to staff.</p>
        </header>

        <div className="customerPromptRow">
          {QUICK_PROMPTS.map((prompt) => (
            <button key={prompt} type="button" onClick={() => void sendQuestion(prompt)} disabled={sending}>
              {prompt}
            </button>
          ))}
        </div>

        <div className="customerChatbotMessages">
          {messages.map((message) => (
            <article
              key={message.id}
              className={`customerMessageBubble ${message.role === "assistant" ? "assistant" : "user"}`}
            >
              <p>{message.text}</p>
            </article>
          ))}
          {sending ? <p className="customerLoadingText">Checking database and generating answer...</p> : null}
        </div>

        <form className="customerComposer" onSubmit={handleSubmit}>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask the AI about product price, stock, shipping, returns, or your order status..."
            rows={3}
          />
          <button type="submit" disabled={!canSend}>
            {sending ? "Working..." : "Send"}
          </button>
        </form>
      </div>
    </section>
  );
}
