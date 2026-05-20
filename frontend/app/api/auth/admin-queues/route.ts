import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const RABBITMQ_MANAGEMENT_URL =
  process.env.RABBITMQ_MANAGEMENT_URL || "http://localhost:15672";
const RABBITMQ_USERNAME = process.env.RABBITMQ_USERNAME || "guest";
const RABBITMQ_PASSWORD = process.env.RABBITMQ_PASSWORD || "guest";
const API_URL = backendApiBaseUrl();

type RabbitQueue = {
  name: string;
  messages: number;
  messages_ready: number;
  messages_unacknowledged: number;
  consumers: number;
  state: string;
  vhost: string;
};

type DashboardPayload = {
  data?: {
    totalOrders?: number;
    pendingOrders?: number;
    lowStockProducts?: number;
  };
};

type AuditPayload = {
  totalElements?: number;
  content?: Array<{ created_at?: string }>;
};

export async function GET(request: Request) {
  try {
        const auth = Buffer.from(`${RABBITMQ_USERNAME}:${RABBITMQ_PASSWORD}`).toString("base64");

    const [response, dashboardResponse, auditResponse] = await Promise.all([
      fetch(`${RABBITMQ_MANAGEMENT_URL}/api/queues/%2F`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json"},
        cache: "no-store"}),
      fetch(`${API_URL}/v1/admin/dashboard?days=7&recentLimit=8&lowStockThreshold=5`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"},
        cache: "no-store"}),
      fetch(`${API_URL}/v1/admin/audit-events?page=0&size=1`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"},
        cache: "no-store"}),
    ]);

    const dashboardPayload = (await dashboardResponse.json()) as DashboardPayload;
    const auditPayload = (await auditResponse.json()) as AuditPayload;
    const databaseContext = dashboardResponse.ok || auditResponse.ok
      ? {
          source: "PostgreSQL",
          totalOrders: Number(dashboardPayload?.data?.totalOrders ?? 0),
          pendingOrders: Number(dashboardPayload?.data?.pendingOrders ?? 0),
          lowStockProducts: Number(dashboardPayload?.data?.lowStockProducts ?? 0),
          totalAuditEvents: Number(auditPayload?.totalElements ?? 0),
          latestAuditEventAt: auditPayload?.content?.[0]?.created_at || null}
      : null;

    if (!response.ok) {
      // Don't fail the admin UI when RabbitMQ management API is unavailable.
      return NextResponse.json({
        queues: [],
        dlqQueues: [],
        retryQueues: [],
        summary: {
          totalQueues: 0,
          totalMessages: 0,
          totalConsumers: 0,
          totalDlqMessages: 0},
        databaseContext,
        unavailable: true,
        details: `RabbitMQ API responded with ${response.status}`});
    }

    const data = (await response.json()) as RabbitQueue[];

    const queues = data.map((q) => ({
      name: q.name,
      messages: q.messages || 0,
      messagesReady: q.messages_ready || 0,
      messagesUnacked: q.messages_unacknowledged || 0,
      consumers: q.consumers || 0,
      state: q.state || "unknown",
      isDlq: q.name.endsWith(".dlq")}));

    // Separate main queues from DLQs
    const mainQueues = queues.filter((q) => !q.isDlq && !q.name.includes("retry"));
    const dlqQueues = queues.filter((q) => q.isDlq);
    const retryQueues = queues.filter((q) => q.name.includes("retry"));

    const totalMessages = queues.reduce((sum, q) => sum + q.messages, 0);
    const totalConsumers = mainQueues.reduce((sum, q) => sum + q.consumers, 0);
    const totalDlqMessages = dlqQueues.reduce((sum, q) => sum + q.messages, 0);

    return NextResponse.json({
      queues: mainQueues,
      dlqQueues,
      retryQueues,
      summary: {
        totalQueues: queues.length,
        totalMessages,
        totalConsumers,
        totalDlqMessages},
      databaseContext});
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching RabbitMQ queues:", message);
    // Degrade gracefully when RabbitMQ is down/misconfigured.
    return NextResponse.json({
      queues: [],
      dlqQueues: [],
      retryQueues: [],
      summary: {
        totalQueues: 0,
        totalMessages: 0,
        totalConsumers: 0,
        totalDlqMessages: 0},
      unavailable: true,
      details: message});
  }
}
