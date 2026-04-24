"use client";

import { FormEvent, useMemo, useState } from "react";
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
};

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
  const [messages, setMessages] = useState<Message[]>([
    createMessage(
      "assistant",
      "Customer assistant is online. Ask about products, stock, prices, shipping/returns, or your order status."
    ),
  ]);

  const canSend = useMemo(() => question.trim().length > 0 && !sending, [question, sending]);

  const sendQuestion = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setMessages((prev) => [...prev, createMessage("user", trimmed)]);
    setQuestion("");

    try {
      const token = getToken();
      const response = await fetch("/api/chatbot/customer/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: trimmed }),
      });

      const data = (await response.json().catch(() => ({}))) as CustomerChatResponse;

      if (!response.ok) {
        setMessages((prev) => [
          ...prev,
          createMessage("assistant", data.error || `Request failed (${response.status})`),
        ]);
        return;
      }

      setMessages((prev) => [...prev, createMessage("assistant", (data.answer || "No answer returned.").trim())]);
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
          <h1>Customer Assistant</h1>
          <p>Ask product and order questions. Answers are based on live catalog and order data.</p>
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
          {sending ? <p className="customerLoadingText">Checking database...</p> : null}
        </div>

        <form className="customerComposer" onSubmit={handleSubmit}>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about product price, stock, shipping, returns, or your order status..."
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
