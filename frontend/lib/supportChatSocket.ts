"use client";

import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";

function resolveBackendOrigin(): string {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (backend) {
    return backend.replace(/\/+$/, "");
  }
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (apiBase) {
    return apiBase.replace(/\/+$/, "").replace(/\/api$/, "");
  }
  return "http://localhost:8080";
}

export function createSupportChatStompClient(options: {
  token?: string | null;
  onConnect?: () => void;
  onStompError?: (error: string) => void;
  onSocketError?: () => void;
}): Client {
  const origin = resolveBackendOrigin();
  const wsEndpoint = `${origin}/ws`;

  const connectHeaders: Record<string, string> = {};
  if (options.token) {
    connectHeaders.Authorization = `Bearer ${options.token}`;
  }

  const client = new Client({
    webSocketFactory: () => new SockJS(wsEndpoint),
    connectHeaders,
    reconnectDelay: 2500,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => options.onConnect?.(),
    onStompError: (frame) => {
      options.onStompError?.(frame.headers.message || "Broker error");
    },
    onWebSocketError: () => {
      options.onSocketError?.();
    },
  });

  return client;
}

export function parseStompJson<T>(message: IMessage): T | null {
  try {
    return JSON.parse(message.body) as T;
  } catch {
    return null;
  }
}
