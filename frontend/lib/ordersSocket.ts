"use client";

import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { publicBackendOriginUrl } from "@/lib/backendApiBase";

export function createOrdersStompClient(onConnect?: () => void): Client {
  const wsEndpoint = `${publicBackendOriginUrl()}/ws`;
  return new Client({
    webSocketFactory: () => new SockJS(wsEndpoint),
    connectHeaders: {},
    reconnectDelay: 2500,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => onConnect?.(),
  });
}
