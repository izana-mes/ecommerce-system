"use client";

import { FormEvent, useState } from "react";

type Message = { role: "user" | "assistant"; text: string };
const prompts: Record<string, string> = {
  admin: "Summarize current platform operations, moderation queues, partner activity, and shipment issues using verified data.",
  seller: "Summarize my sales, orders, inventory, supplier offers, partnerships, and allocation risks using my verified data.",
  supplier: "Summarize my wholesale performance, inventory, seller requests, resale offers, and allocation risks using my verified data.",
  shipper: "Summarize my assigned deliveries, statuses, priorities, delays, and performance using my verified data.",
};

export default function RoleAssistant({ role, onClose }: { role: "admin" | "seller" | "supplier" | "shipper"; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    setMessages((items) => [...items, { role: "user", text: question.trim() }]);
    setDraft(""); setError(""); setLoading(true);
    try {
      const response = await fetch("/api/ai/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question.trim(), conversationId }), cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Assistant is temporarily unavailable.");
      setConversationId(typeof payload.conversationId === "string" ? payload.conversationId : undefined);
      setMessages((items) => [...items, { role: "assistant", text: String(payload.message || "No answer was returned.") }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Assistant is temporarily unavailable.");
    } finally { setLoading(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); void ask(draft); }
  return (
    <section role="dialog" aria-modal="false" aria-label={`${role} management assistant`} style={{ position: "fixed", right: 16, bottom: 64, zIndex: 1000, width: "min(360px, calc(100vw - 32px))", maxHeight: "min(560px, calc(100vh - 88px))", display: "flex", flexDirection: "column", background: "#fff", color: "#171717", border: "1px solid #e5e5e5", borderRadius: 5, overflow: "hidden" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 13px", borderBottom: "1px solid #e5e5e5" }}>
        <strong>{role[0].toUpperCase() + role.slice(1)} Assistant</strong>
        <button type="button" onClick={onClose} aria-label="Close assistant" style={{ border: 0, background: "transparent", color: "#404040", fontSize: 22, cursor: "pointer" }}>×</button>
      </header>
      <div aria-live="polite" style={{ overflowY: "auto", padding: 16, flex: 1, minHeight: 150 }}>
        {!messages.length ? <><p style={{ color: "#525252", lineHeight: 1.5, fontSize: 13 }}>Suggestions do not change orders, inventory, prices, approvals, or delivery status.</p><button type="button" disabled={loading} onClick={() => void ask(prompts[role])} style={{ padding: "8px 10px", background: "#f5f5f4", color: "#171717", border: "1px solid #e5e5e5", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>Summarize my dashboard</button></> : null}
        {messages.map((message, index) => <p key={index} style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, margin: "10px 0", color: message.role === "assistant" ? "#222" : "#555" }}><strong>{message.role === "assistant" ? "Assistant: " : "You: "}</strong>{message.text}</p>)}
        {loading ? <p role="status" style={{ color: "#666" }}>Checking authorized data…</p> : null}
        {error ? <p role="alert" style={{ color: "#a12626" }}>{error} <button type="button" onClick={() => { const last = [...messages].reverse().find((m) => m.role === "user"); if (last) void ask(last.text); }} style={{ textDecoration: "underline", border: 0, background: "none", color: "inherit", cursor: "pointer" }}>Retry</button></p> : null}
      </div>
      <form onSubmit={submit} style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid #e5e5e5" }}>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} disabled={loading} aria-label="Ask a management question" placeholder="Ask about your work…" style={{ flex: 1, minWidth: 0, border: "1px solid #e5e5e5", borderRadius: 4, padding: "9px 10px", color: "#171717", background: "#fff", fontSize: 13 }} />
        <button type="submit" disabled={loading || !draft.trim()} style={{ border: 0, borderRadius: 4, padding: "0 12px", background: "#171717", color: "#fff", cursor: "pointer", opacity: loading || !draft.trim() ? .5 : 1 }}>Ask</button>
      </form>
    </section>
  );
}
