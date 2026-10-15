"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Client, IMessage, StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { publicBackendOriginUrl } from "@/lib/backendApiBase";
import type { WsMessageEvent, TypingEvent } from "./types";

interface UseChatSocketOptions {
  conversationId?: string | null;
  userId?: string | null;
  onMessageEvent?: (event: WsMessageEvent) => void;
  onTypingEvent?: (event: TypingEvent) => void;
  onUserConversationEvent?: (event: WsMessageEvent) => void;
}

export function useChatSocket({
  conversationId,
  userId,
  onMessageEvent,
  onTypingEvent,
  onUserConversationEvent,
}: UseChatSocketOptions) {
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<Client | null>(null);
  const convSubRef = useRef<StompSubscription | null>(null);
  const typingSubRef = useRef<StompSubscription | null>(null);
  const userSubRef = useRef<StompSubscription | null>(null);

  const parseJson = <T>(msg: IMessage): T | null => {
    try {
      return JSON.parse(msg.body) as T;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    const origin = publicBackendOriginUrl();

    const start = async () => {
      let token: string | null = null;
      try {
        const res = await fetch("/api/chat/stomp-token", { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { token?: string | null };
          token = data.token || null;
        }
      } catch {
        token = null;
      }
      if (cancelled) return;

      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const client = new Client({
        webSocketFactory: () =>
          new SockJS(`${origin}/ws`, undefined, { transports: ["websocket", "xhr-streaming", "xhr-polling"] }),
        connectHeaders: headers,
        reconnectDelay: 2500,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        onConnect: () => {
          setConnected(true);
        },
        onDisconnect: () => {
          setConnected(false);
        },
        onStompError: () => {
          setConnected(false);
        },
        onWebSocketError: () => {
          setConnected(false);
        },
      });

      clientRef.current = client;
      client.activate();
    };

    void start();

    return () => {
      cancelled = true;
      convSubRef.current?.unsubscribe();
      typingSubRef.current?.unsubscribe();
      userSubRef.current?.unsubscribe();
      clientRef.current?.deactivate();
      clientRef.current = null;
      setConnected(false);
    };
  }, []);

  useEffect(() => {
    const client = clientRef.current;
    if (!client || !connected || !userId) return;

    userSubRef.current?.unsubscribe();
    userSubRef.current = client.subscribe(`/topic/chat/users/${userId}/conversations`, (frame) => {
      const event = parseJson<WsMessageEvent>(frame);
      if (event && onUserConversationEvent) {
        onUserConversationEvent(event);
      }
    });

    return () => {
      userSubRef.current?.unsubscribe();
      userSubRef.current = null;
    };
  }, [connected, userId, onUserConversationEvent]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client || !connected || !conversationId) return;

    convSubRef.current?.unsubscribe();
    typingSubRef.current?.unsubscribe();

    convSubRef.current = client.subscribe(
      `/topic/chat/conversations/${conversationId}/messages`,
      (frame) => {
        const event = parseJson<WsMessageEvent>(frame);
        if (event && onMessageEvent) {
          onMessageEvent(event);
        }
      }
    );

    typingSubRef.current = client.subscribe(
      `/topic/chat/conversations/${conversationId}/typing`,
      (frame) => {
        const event = parseJson<TypingEvent>(frame);
        if (event && onTypingEvent) {
          onTypingEvent(event);
        }
      }
    );

    return () => {
      convSubRef.current?.unsubscribe();
      typingSubRef.current?.unsubscribe();
      convSubRef.current = null;
      typingSubRef.current = null;
    };
  }, [connected, conversationId, onMessageEvent, onTypingEvent]);

  const sendTyping = useCallback((convId: string, isTyping: boolean) => {
    const client = clientRef.current;
    if (!client || !client.connected) return;
    client.publish({
      destination: `/app/chat.typing.${convId}`,
      body: JSON.stringify({
        eventType: isTyping ? "TYPING_START" : "TYPING_STOP",
        conversationId: convId,
      }),
    });
  }, []);

  const sendRead = useCallback((convId: string) => {
    const client = clientRef.current;
    if (!client || !client.connected) return;
    client.publish({
      destination: `/app/chat.read.${convId}`,
      body: JSON.stringify({ eventType: "READ", conversationId: convId }),
    });
  }, []);

  return {
    connected,
    sendTyping,
    sendRead,
  };
}
