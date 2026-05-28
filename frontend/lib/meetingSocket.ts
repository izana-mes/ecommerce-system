"use client";

import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { publicBackendOriginUrl } from "@/lib/backendApiBase";

export function createMeetingStompClient(onConnect?: (client: Client) => void): Client {
  const client = new Client({
    webSocketFactory: () => new SockJS(`${publicBackendOriginUrl()}/ws`),
    connectHeaders: {},
    reconnectDelay: 2500,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => onConnect?.(client),
  });
  return client;
}
