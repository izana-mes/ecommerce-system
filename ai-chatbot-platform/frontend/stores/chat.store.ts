import { create } from "zustand";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ToolEvent = { name: string; args: Record<string, unknown> };

type ChatState = {
  token: string;
  conversationId: string;
  messages: ChatMessage[];
  toolEvents: ToolEvent[];
  setToken: (token: string) => void;
  setConversationId: (id: string) => void;
  push: (message: ChatMessage) => void;
  pushToolEvent: (event: ToolEvent) => void;
  setLastAssistantChunk: (chunk: string) => void;
};

export const useChatStore = create<ChatState>((set) => ({
  token: "",
  conversationId: "",
  messages: [],
  toolEvents: [],
  setToken: (token) => set({ token }),
  setConversationId: (conversationId) => set({ conversationId }),
  push: (message) => set((s) => ({ messages: [...s.messages, message] })),
  pushToolEvent: (event) => set((s) => ({ toolEvents: [...s.toolEvents, event] })),
  setLastAssistantChunk: (chunk) =>
    set((s) => {
      const last = s.messages[s.messages.length - 1];
      if (!last || last.role !== "assistant") return { messages: [...s.messages, { role: "assistant", content: chunk }] };
      return { messages: [...s.messages.slice(0, -1), { ...last, content: last.content + chunk }] };
    }),
}));
