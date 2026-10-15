"use client";

import { FormEvent, useEffect, useState } from "react";
import "./chatbot.css";

type Message = { id: string; role: "user" | "assistant"; content: string };
type Conversation = { id: string; updatedAt: string };

export default function CustomerChatbotPage() {
  const [input, setInput] = useState(""); const [sending, setSending] = useState(false); const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState<string>(); const [messages, setMessages] = useState<Message[]>([]); const [conversations, setConversations] = useState<Conversation[]>([]);
  const load = async () => { const r = await fetch("/api/ai/conversations", { cache: "no-store" }); if (r.ok) setConversations(await r.json()); };
  useEffect(() => { void load(); }, []);
  const open = async (id: string) => { const r = await fetch(`/api/ai/conversations/${id}`, { cache: "no-store" }); if (!r.ok) return; const c = await r.json(); setConversationId(c.id); setMessages(c.messages.map((m: Message) => ({ id: m.id, role: m.role, content: m.content }))); setError(""); };
  const send = async (e?: FormEvent) => { e?.preventDefault(); const message = input.trim(); if (!message || sending) return; setSending(true); setError(""); setMessages(p => [...p, { id: `local-${Date.now()}`, role: "user", content: message }]); setInput(""); try { const r = await fetch("/api/ai/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, conversationId }) }); const data = await r.json().catch(() => ({})); if (!r.ok) { setError(data.error || "The assistant is unavailable."); return; } setMessages(p => [...p, { id: `answer-${Date.now()}`, role: "assistant", content: data.message }]); const all = await fetch("/api/ai/conversations").then(x => x.ok ? x.json() : []); setConversations(all); if (!conversationId && all[0]) setConversationId(all[0].id); } catch { setError("Network error. You can retry your message."); } finally { setSending(false); } };
  const remove = async (id: string) => { await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" }); if (id === conversationId) { setConversationId(undefined); setMessages([]); } void load(); };
  return <section className="customerChatbotPage"><div className="customerChatbotContainer"><header className="customerChatbotHeader"><h1>AI Shopping Assistant</h1><p>Ask naturally about the store or your account. Shop facts are checked against the live application.</p></header><div className="customerPromptRow"><button onClick={() => { setConversationId(undefined); setMessages([]); setError(""); }}>New conversation</button>{conversations.map(c => <span key={c.id}><button onClick={() => void open(c.id)}>Conversation</button><button aria-label="Delete conversation" onClick={() => void remove(c.id)}>×</button></span>)}</div><div className="customerChatbotMessages">{messages.length === 0 && <p className="customerLoadingText">Start a conversation whenever you’re ready.</p>}{messages.map(m => <article key={m.id} className={`customerMessageBubble ${m.role === "assistant" ? "assistant" : "user"}`}><p>{m.content}</p></article>)}{sending && <p className="customerLoadingText">Working…</p>}{error && <p role="alert" className="customerLoadingText">{error}</p>}</div><form className="customerComposer" onSubmit={send}><textarea value={input} onChange={e => setInput(e.target.value)} maxLength={2000} placeholder="Write a message…" rows={3}/><button type="submit" disabled={!input.trim() || sending}>{sending ? "Working…" : "Send"}</button></form></div></section>;
}
