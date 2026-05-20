"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {getUser } from "@/lib/auth";
import "./staff-chatbot.css";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
};

type ChatbotResponse = {
  answer?: string;
  error?: string;
};

function createMessage(role: "user" | "assistant", text: string): Message {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    text,
    timestamp: new Date().toISOString()};
}

const STARTER_QUESTIONS = [
  "Show low stock products",
  "Top selling products this month",
  "How much revenue did we make in the last 30 days?",
  "Find orders for customer@example.com",
  "Order status for ORD-1001",
];

export default function StaffChatbotPage() {
  const router = useRouter();
  const token = getUser();
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    createMessage(
      "assistant",
      "Database assistant is ready. Ask about orders, customer history, stock, top products, revenue, or product price/stock data."
    ),
  ]);

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
            "Content-Type": "application/json"},
          cache: "no-store"});

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setIsAllowed(false);
          setLoadingAccess(false);
          return;
        }

        const profile = data?.data;
        const role = String(profile?.role || "").toLowerCase();
        const roles = Array.isArray(profile?.roles)
          ? profile.roles.map((value: string) => String(value).toUpperCase())
          : [];

        const allowed =
          role === "admin" ||
          role === "employee" ||
          roles.includes("ROLE_ADMIN") ||
          roles.includes("ROLE_EMPLOYEE");

        setIsAllowed(allowed);
      } catch {
        setIsAllowed(false);
      } finally {
        setLoadingAccess(false);
      }
    };

    void checkAccess();
  }, [router]);

  const canSend = useMemo(() => {
    return question.trim().length > 0 && !sending && isAllowed;
  }, [question, sending, isAllowed]);

  const sendQuestion = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || sending || !isAllowed) return;

    setSending(true);
    setMessages((prev) => [...prev, createMessage("user", trimmed)]);
    setQuestion("");

    try {
      const response = await fetch("/api/chatbot/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({ question: trimmed })});
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as ChatbotResponse;
        const message = data?.error || `Request failed (${response.status})`;
        setMessages((prev) => [...prev, createMessage("assistant", message)]);
        return;
      }

      const assistantId = `${Date.now()}-assistant`;
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", text: "", timestamp: new Date().toISOString() }]);

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
          if (event !== "token" || !dataText) continue;
          const data = JSON.parse(dataText) as { token?: string };
          if (!data.token) continue;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, text: `${m.text}${data.token ?? ""}` } : m))
          );
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        createMessage("assistant", "Chatbot request failed. Please try again."),
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendQuestion(question);
  };

  if (loadingAccess) {
    return (
      <section className="staffChatbotPage">
        <div className="staffChatbotContainer">
          <h1>Staff Assistant</h1>
          <p>Checking access...</p>
        </div>
      </section>
    );
  }

  if (!isAllowed) {
    return (
      <section className="staffChatbotPage">
        <div className="staffChatbotContainer">
          <h1>Staff Assistant</h1>
          <p>You need employee or admin permissions to use this chatbot.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="staffChatbotPage">
      <div className="staffChatbotContainer">
        <header className="staffChatbotHeader">
          <h1>AI Staff Assistant</h1>
          <p>
            Ask the AI assistant about orders, customers, revenue, and stock. Customer messages to staff appear in the
            inbox, not here.
          </p>
        </header>

        <div className="staffChatbotQuickPrompts">
          {STARTER_QUESTIONS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="staffPromptButton"
              onClick={() => void sendQuestion(prompt)}
              disabled={sending}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="staffChatbotMessages">
          {messages.map((message) => (
            <article
              key={message.id}
              className={`staffMessageBubble ${message.role === "assistant" ? "assistant" : "user"}`}
            >
              <p>{message.text}</p>
            </article>
          ))}
          {sending ? <p className="staffChatbotLoading">Analyzing database...</p> : null}
        </div>

        <form className="staffChatbotComposer" onSubmit={handleSubmit}>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about order status, customer orders, revenue, top products, or stock..."
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
