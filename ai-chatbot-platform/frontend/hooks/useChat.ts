"use client";

import { useMutation } from "@tanstack/react-query";
import { apiPost, streamChat } from "../lib/api";
import { useChatStore } from "../stores/chat.store";

export function useChat() {
  const store = useChatStore();

  const createConversation = useMutation({
    mutationFn: async () => apiPost<{ id: string }>("/conversations", {}, store.token),
    onSuccess: (data) => store.setConversationId(data.id),
  });

  const ask = useMutation({
    mutationFn: async (message: string) => {
      store.push({ role: "user", content: message });
      await streamChat("/chat/stream", store.token, { conversationId: store.conversationId, message }, (event, data) => {
        if (event === "token") store.setLastAssistantChunk(data.token);
        if (event === "tool") store.pushToolEvent({ name: data.name, args: data.args ?? {} });
      });
    },
  });

  return { createConversation, ask };
}
