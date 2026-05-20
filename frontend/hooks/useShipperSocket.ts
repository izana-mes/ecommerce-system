"use client";

import { useEffect, useRef, useState } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {}  from "@/lib/auth";
import { publicBackendOriginUrl } from "@/lib/backendApiBase";

/** Mirrors the backend ShipperDtos.OrderStatusEvent payload. */
export interface OrderStatusEvent {
  orderId: number;
  orderNumber: string;
  /** Normalized DB status: "processing" | "completed" | "cancelled" */
  newOrderStatus: string;
  /** Raw shipper action: "PICKED_UP" | "DELIVERED" | "FAILED" */
  shipperAction: string;
  shipperUserId: string;
  changedAt: string;
}

/**
 * Connects to the STOMP broker once and subscribes to the shipper's own
 * order-status topic: /topic/shipper/{shipperUserId}/orders
 *
 * The `onOrderEvent` callback is called every time an OrderStatusEvent
 * arrives, allowing pages to refresh their data without a full page reload.
 *
 * @returns `connected` – true while the STOMP session is alive (for the live dot).
 */
export function useShipperSocket(
  shipperUserId: string | undefined,
  onOrderEvent: (event: OrderStatusEvent) => void
): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<Client | null>(null);
  // Keep a stable ref to the callback so we don't re-subscribe on every render.
  const callbackRef = useRef(onOrderEvent);
  useEffect(() => {
    callbackRef.current = onOrderEvent;
  });

  useEffect(() => {
    if (!shipperUserId) return;
    if (!token) return;

    const client = new Client({
      webSocketFactory: () =>
        new SockJS(`${publicBackendOriginUrl()}/ws`) as WebSocket,
      connectHeaders: { },
      reconnectDelay: 5000,
      heartbeatIncoming: 15000,
      heartbeatOutgoing: 15000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(
          `/topic/shipper/${shipperUserId}/orders`,
          (msg: IMessage) => {
            try {
              const event = JSON.parse(msg.body) as OrderStatusEvent;
              callbackRef.current(event);
            } catch {
              /* ignore malformed frames */
            }
          }
        );
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
      onWebSocketError: () => setConnected(false)});

    client.activate();
    clientRef.current = client;

    return () => {
      void client.deactivate();
      clientRef.current = null;
      setConnected(false);
    };
  }, [shipperUserId]);

  return { connected };
}
