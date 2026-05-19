"use client";

import { ChatWindow } from "../components/chat-window";
import { useChatStore } from "../stores/chat.store";

export default function HomePage() {
  const { token, setToken } = useChatStore();

  return (
    <main>
      {!token ? (
        <div className="mx-auto mt-20 max-w-md rounded-xl bg-panel p-6">
          <h1 className="mb-4 text-xl font-semibold">AI Chat Platform</h1>
          <p className="mb-3 text-sm text-slate-300">Paste JWT token from backend `/api/auth/login` or `/api/auth/register`.</p>
          <input className="w-full rounded border border-slate-600 bg-slate-900 p-2" onChange={(e) => setToken(e.target.value)} />
        </div>
      ) : (
        <ChatWindow />
      )}
    </main>
  );
}
