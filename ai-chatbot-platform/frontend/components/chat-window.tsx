"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChat } from "../hooks/useChat";
import { useChatStore } from "../stores/chat.store";
import { Button } from "./ui/button";

export function ChatWindow() {
  const { createConversation, ask } = useChat();
  const { messages, toolEvents } = useChatStore();
  const [input, setInput] = useState("");

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 p-4 lg:grid-cols-4">
      <aside className="rounded-xl border border-slate-700 bg-panel p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-slate-300">Tool Activity</h2>
        <div className="space-y-2 text-xs">
          {toolEvents.map((e, i) => (
            <div key={i} className="rounded border border-slate-700 bg-slate-900 p-2">
              <div className="font-medium text-cyan-300">{e.name}</div>
              <pre className="mt-1 overflow-x-auto text-slate-300">{JSON.stringify(e.args, null, 2)}</pre>
            </div>
          ))}
        </div>
      </aside>

      <section className="lg:col-span-3">
        <div className="mb-4 flex gap-2">
          <Button onClick={() => createConversation.mutate()}>New Chat</Button>
        </div>

        <div className="h-[70vh] overflow-y-auto rounded-xl border border-slate-700 bg-panel p-4">
          {messages.map((m, i) => (
            <div key={i} className={`mb-4 ${m.role === "user" ? "text-cyan-300" : "text-slate-100"}`}>
              <div className="mb-1 text-xs uppercase opacity-70">{m.role}</div>
              <article className="prose prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              </article>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} className="w-full rounded border border-slate-700 bg-slate-900 p-3" />
          <Button
            onClick={() => {
              if (!input.trim()) return;
              ask.mutate(input);
              setInput("");
            }}
          >
            Send
          </Button>
        </div>
      </section>
    </div>
  );
}
