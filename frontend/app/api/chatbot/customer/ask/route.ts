import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

type AskRequestBody = {
  question?: string;
};

type AuthProfile = {
  id?: string;
  email?: string;
};

type CustomerChatResult = {
  intent: string;
  answer: string;
  evidence?: Record<string, unknown>;
};

const ORDER_NUMBER_PATTERN = /\b([A-Z]{2,}[A-Z0-9_-]{2,})\b/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

function getAuthHeader(request: Request): string | null {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

function getCookieHeader(request: Request): string | null {
  return request.headers.get("cookie") || null;
}

async function tryResolveCurrentUser(request: Request): Promise<AuthProfile | null> {
  const authHeader = getAuthHeader(request);
  const cookieHeader = getCookieHeader(request);

  if (!authHeader && !cookieHeader) {
    return null;
  }

  try {
    const response = await fetch(`${backendApiBaseUrl()}/v1/auth/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    const profile = data?.data;
    if (!profile?.email) return null;

    return {
      id: profile.id,
      email: String(profile.email).toLowerCase(),
    };
  } catch {
    return null;
  }
}

function normalizeQuestion(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function formatMoney(value: unknown, currency = "USD"): string {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return `${currency} 0.00`;

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function toIsoDate(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

function extractEmail(question: string): string | null {
  const match = question.match(EMAIL_PATTERN);
  return match ? match[0].toLowerCase() : null;
}

function extractOrderNumber(question: string): string | null {
  const match = question.match(ORDER_NUMBER_PATTERN);
  return match ? match[1].toUpperCase() : null;
}

function isOrderIntent(question: string): boolean {
  return /\border\b|\bstatus\b|\btracking\b|\bpayment\b|my order/i.test(question);
}

function isPolicyIntent(question: string): boolean {
  return /shipping|delivery|return|refund|exchange|support|contact|payment method|cash on delivery|cod/i.test(
    question
  );
}

function isCatalogIntent(question: string): boolean {
  return /price|product|catalog|stock|available|size|material|color/i.test(question);
}

function extractCatalogKeyword(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(price|product|catalog|stock|available|show|find|details|about|the|a|an|for|of)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

async function resolveOrderAnswer(
  conn: Awaited<ReturnType<typeof getConnection>>,
  question: string,
  currentUser: AuthProfile | null
): Promise<CustomerChatResult> {
  const orderNumber = extractOrderNumber(question);
  const providedEmail = extractEmail(question);

  if (!orderNumber) {
    return {
      intent: "order_help",
      answer:
        "To check order status, provide your order number. If you are not logged in, also include the order email.",
    };
  }

  const lookupEmail = currentUser?.email || providedEmail;
  if (!lookupEmail) {
    return {
      intent: "order_help",
      answer:
        "For privacy, please log in first or include the order email with your order number (example: ORD-1001 and name@email.com).",
    };
  }

  const [rows] = await conn.execute<
    Array<{
      order_number: string;
      customer_email: string;
      order_status: string;
      payment_status: string;
      total_amount: number;
      currency: string;
      created_at: string;
    }>
  >(
    `SELECT order_number, customer_email, order_status, payment_status, total_amount, currency, created_at
     FROM orders
     WHERE UPPER(order_number) = UPPER(?)
       AND LOWER(customer_email) = LOWER(?)
     ORDER BY created_at DESC
     LIMIT 1`,
    [orderNumber, lookupEmail]
  );

  const order = rows?.[0];
  if (!order) {
    return {
      intent: "order_not_found",
      answer: "I couldn't find an order with that order number and email combination.",
      evidence: { orderNumber, customerEmail: lookupEmail },
    };
  }

  return {
    intent: "order_status",
    answer: `Order ${order.order_number} is ${order.order_status} and payment is ${order.payment_status}. Total: ${formatMoney(
      order.total_amount,
      order.currency
    )}. Created at ${toIsoDate(order.created_at)}.`,
    evidence: {
      orderNumber: order.order_number,
      orderStatus: order.order_status,
      paymentStatus: order.payment_status,
      totalAmount: order.total_amount,
      currency: order.currency,
      customerEmail: order.customer_email,
      createdAt: order.created_at,
    },
  };
}

async function resolveCatalogAnswer(
  conn: Awaited<ReturnType<typeof getConnection>>,
  question: string
): Promise<CustomerChatResult> {
  const keyword = extractCatalogKeyword(question);

  const [rows] = await conn.execute<
    Array<{
      product_id: string;
      product_name: string;
      product_price: number;
      stock_quantity: number;
      active: boolean;
      product_reviews: string | null;
    }>
  >(
    `SELECT product_id, product_name, product_price, stock_quantity, active, product_reviews
     FROM products
     WHERE active = TRUE
       AND LOWER(product_name) LIKE LOWER(?)
     ORDER BY stock_quantity DESC
     LIMIT 5`,
    [`%${keyword || question}%`]
  );

  if (!rows.length) {
    return {
      intent: "catalog_lookup",
      answer: "I couldn't find matching products. Try a shorter product name keyword.",
      evidence: { keyword },
    };
  }

  return {
    intent: "catalog_lookup",
    answer: `Here are matching products: ${rows
      .map(
        (item) =>
          `${item.product_name} (${item.product_id}) - ${formatMoney(item.product_price, "USD")}, stock ${
            item.stock_quantity
          }${item.product_reviews ? `, reviews ${item.product_reviews}` : ""}`
      )
      .join(" | ")}`,
    evidence: { keyword, products: rows },
  };
}

function resolvePolicyAnswer(question: string): CustomerChatResult {
  const normalized = question.toLowerCase();

  if (normalized.includes("return") || normalized.includes("refund") || normalized.includes("exchange")) {
    return {
      intent: "policy_returns",
      answer:
        "Return policy: eligible items can be returned within 30 days in original condition. For refunds, include your order number and contact support from the Contact page.",
    };
  }

  if (normalized.includes("shipping") || normalized.includes("delivery")) {
    return {
      intent: "policy_shipping",
      answer:
        "Shipping info: standard delivery times vary by destination. You can track shipment status from your order details once the order is dispatched.",
    };
  }

  if (normalized.includes("payment") || normalized.includes("cod") || normalized.includes("cash on delivery")) {
    return {
      intent: "policy_payment",
      answer:
        "Supported payment methods include online payment options shown at checkout. Payment status updates appear in your order status after processing.",
    };
  }

  return {
    intent: "policy_general",
    answer:
      "For support questions, share your order number and issue details. You can also use the Contact page for direct assistance.",
  };
}

async function resolveFallback(
  conn: Awaited<ReturnType<typeof getConnection>>
): Promise<CustomerChatResult> {
  const [rows] = await conn.execute<Array<{ total_products: number }>>(
    `SELECT COUNT(*) AS total_products FROM products WHERE active = TRUE`
  );

  const totalProducts = Number(rows?.[0]?.total_products || 0);
  return {
    intent: "fallback",
    answer:
      `I can help with product questions, stock and prices, shipping/returns, and order status. ` +
      `Current catalog has ${totalProducts} active products.`,
    evidence: { totalProducts },
  };
}

async function buildAnswer(
  conn: Awaited<ReturnType<typeof getConnection>>,
  question: string,
  currentUser: AuthProfile | null
): Promise<CustomerChatResult> {
  if (isOrderIntent(question)) {
    return resolveOrderAnswer(conn, question, currentUser);
  }

  if (isPolicyIntent(question)) {
    return resolvePolicyAnswer(question);
  }

  if (isCatalogIntent(question)) {
    return resolveCatalogAnswer(conn, question);
  }

  return resolveFallback(conn);
}

export async function POST(request: Request) {
  let body: AskRequestBody;
  try {
    body = (await request.json()) as AskRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = normalizeQuestion(String(body.question || ""));
  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  let conn: Awaited<ReturnType<typeof getConnection>> | undefined;

  try {
    const currentUser = await tryResolveCurrentUser(request);
    conn = await getConnection();
    const result = await buildAnswer(conn, question, currentUser);

    return NextResponse.json({
      question,
      intent: result.intent,
      answer: result.answer,
      evidence: result.evidence,
      authenticated: Boolean(currentUser),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to answer customer question",
        details: message,
      },
      { status: 500 }
    );
  } finally {
    await conn?.end();
  }
}
