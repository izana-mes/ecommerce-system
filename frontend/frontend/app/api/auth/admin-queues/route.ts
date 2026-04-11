import { NextResponse } from "next/server";

const RABBITMQ_MANAGEMENT_URL =
  process.env.RABBITMQ_MANAGEMENT_URL || "http://localhost:15672";
const RABBITMQ_USERNAME = process.env.RABBITMQ_USERNAME || "guest";
const RABBITMQ_PASSWORD = process.env.RABBITMQ_PASSWORD || "guest";

type RabbitQueue = {
  name: string;
  messages: number;
  messages_ready: number;
  messages_unacknowledged: number;
  consumers: number;
  state: string;
  vhost: string;
};

export async function GET() {
  try {
    const auth = Buffer.from(`${RABBITMQ_USERNAME}:${RABBITMQ_PASSWORD}`).toString("base64");

    const response = await fetch(`${RABBITMQ_MANAGEMENT_URL}/api/queues/%2F`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

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
          totalDlqMessages: 0,
        },
        unavailable: true,
        details: `RabbitMQ API responded with ${response.status}`,
      });
    }

    const data = (await response.json()) as RabbitQueue[];

    const queues = data.map((q) => ({
      name: q.name,
      messages: q.messages || 0,
      messagesReady: q.messages_ready || 0,
      messagesUnacked: q.messages_unacknowledged || 0,
      consumers: q.consumers || 0,
      state: q.state || "unknown",
      isDlq: q.name.endsWith(".dlq"),
    }));

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
        totalDlqMessages,
      },
    });
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
        totalDlqMessages: 0,
      },
      unavailable: true,
      details: message,
    });
  }
}
