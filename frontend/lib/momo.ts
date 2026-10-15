import crypto from "crypto";

/** Official MoMo Developers v2/v3 hosts. */
export const MOMO_SANDBOX_ENDPOINT = "https://test-payment.momo.vn";
export const MOMO_PRODUCTION_ENDPOINT = "https://payment.momo.vn";
export const MOMO_CREATE_PATH = "/v2/gateway/api/create";

/**
 * Official Collection Link checkout (`payWithMethod`).
 * MoMo's hosted page then offers e-wallet, ATM (NAPAS), and Visa/Master/JCB.
 * Other documented create requestTypes can be selected via MOMO_REQUEST_TYPE.
 */
export const MOMO_REQUEST_TYPE_COLLECTION_LINK = "payWithMethod";
export const MOMO_REQUEST_TYPE = MOMO_REQUEST_TYPE_COLLECTION_LINK;

/** Documented AIOv2 create requestTypes (same /v2/gateway/api/create endpoint). */
export const MOMO_OFFICIAL_REQUEST_TYPES = [
  "payWithMethod",
  "captureWallet",
  "payWithATM",
  "payWithCC",
] as const;

export type MomoOfficialRequestType = (typeof MOMO_OFFICIAL_REQUEST_TYPES)[number];

/**
 * Collection Link enables ATM/credit from 10,000 VND.
 * @see https://developers.momo.vn/v3/docs/payment/api/collection-link/
 */
export const MOMO_MIN_AMOUNT_VND = 10_000;
export const MOMO_MAX_AMOUNT_VND = 50_000_000;

export type MomoCreateSignatureInput = {
  accessKey: string;
  amount: number;
  extraData: string;
  ipnUrl: string;
  orderId: string;
  orderInfo: string;
  partnerCode: string;
  redirectUrl: string;
  requestId: string;
  requestType: string;
};

export type MomoIpnSignatureInput = {
  accessKey: string;
  amount: string | number;
  extraData: string;
  message: string;
  orderId: string;
  orderInfo: string;
  orderType: string;
  partnerCode: string;
  payType: string;
  requestId: string;
  responseTime: string | number;
  resultCode: string | number;
  transId: string | number;
};

export function toVndAmount(usdAmount: number, usdToVndRate: number): number {
  return Math.round(usdAmount * usdToVndRate);
}

export function resolveUsdToVndRate(raw: string | undefined): number {
  const parsed = Number(raw ?? "26000");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Invalid MOMO_USD_TO_VND_RATE");
  }
  return parsed;
}

/**
 * Sandbox and production are separate. `MOMO_ENDPOINT` wins when set.
 * Production is used only when `MOMO_ENV` is `production` or `live`.
 */
export function resolveMomoEndpoint(
  env: NodeJS.ProcessEnv = process.env
): string {
  const explicit = env.MOMO_ENDPOINT?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }
  const mode = (env.MOMO_ENV ?? "sandbox").trim().toLowerCase();
  if (mode === "production" || mode === "live") {
    return MOMO_PRODUCTION_ENDPOINT;
  }
  return MOMO_SANDBOX_ENDPOINT;
}

export function resolveMomoRequestType(
  env: NodeJS.ProcessEnv = process.env
): MomoOfficialRequestType {
  const configured = env.MOMO_REQUEST_TYPE?.trim();
  if (
    configured &&
    (MOMO_OFFICIAL_REQUEST_TYPES as readonly string[]).includes(configured)
  ) {
    return configured as MomoOfficialRequestType;
  }
  return MOMO_REQUEST_TYPE_COLLECTION_LINK;
}

export function resolveMomoCreateUrl(endpoint: string): string {
  const base = endpoint.trim().replace(/\/+$/, "");
  if (base.endsWith(MOMO_CREATE_PATH)) {
    return base;
  }
  return `${base}${MOMO_CREATE_PATH}`;
}

export function hmacSha256Hex(secretKey: string, raw: string): string {
  return crypto.createHmac("sha256", secretKey).update(raw, "utf8").digest("hex");
}

export function signaturesMatch(expectedHex: string, provided: string): boolean {
  const a = Buffer.from(expectedHex, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

/**
 * Create-payment signature (MoMo One-Time Payments).
 * HMAC-SHA256 of keys sorted a-z:
 * accessKey, amount, extraData, ipnUrl, orderId, orderInfo, partnerCode,
 * redirectUrl, requestId, requestType
 */
export function buildCreateRawSignature(input: MomoCreateSignatureInput): string {
  return (
    `accessKey=${input.accessKey}` +
    `&amount=${input.amount}` +
    `&extraData=${input.extraData}` +
    `&ipnUrl=${input.ipnUrl}` +
    `&orderId=${input.orderId}` +
    `&orderInfo=${input.orderInfo}` +
    `&partnerCode=${input.partnerCode}` +
    `&redirectUrl=${input.redirectUrl}` +
    `&requestId=${input.requestId}` +
    `&requestType=${input.requestType}`
  );
}

/**
 * Redirect/IPN signature (MoMo payment result).
 * HMAC-SHA256 of keys sorted a-z:
 * accessKey, amount, extraData, message, orderId, orderInfo, orderType,
 * partnerCode, payType, requestId, responseTime, resultCode, transId
 */
export function buildIpnRawSignature(input: MomoIpnSignatureInput): string {
  return (
    `accessKey=${input.accessKey}` +
    `&amount=${input.amount}` +
    `&extraData=${input.extraData}` +
    `&message=${input.message}` +
    `&orderId=${input.orderId}` +
    `&orderInfo=${input.orderInfo}` +
    `&orderType=${input.orderType}` +
    `&partnerCode=${input.partnerCode}` +
    `&payType=${input.payType}` +
    `&requestId=${input.requestId}` +
    `&responseTime=${input.responseTime}` +
    `&resultCode=${input.resultCode}` +
    `&transId=${input.transId}`
  );
}

export function newMomoRequestId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function newMomoOrderId(shopOrderNumber: string): string {
  const safe = shopOrderNumber.replace(/[^0-9a-zA-Z._-]/g, "") || "order";
  const suffix = crypto.randomUUID().replaceAll("-", "");
  return `${safe}.${suffix}`.slice(0, 200);
}

/** Official extraData: Base64-encoded JSON object. */
export function encodeOrderExtraData(orderNumber: string): string {
  return Buffer.from(JSON.stringify({ orderNumber }), "utf8").toString("base64");
}

export function decodeOrderNumberFromExtraData(extraData: string | null | undefined): string | null {
  if (!extraData) return null;
  try {
    const parsed = JSON.parse(Buffer.from(extraData, "base64").toString("utf8")) as {
      orderNumber?: unknown;
    };
    return typeof parsed.orderNumber === "string" && parsed.orderNumber ? parsed.orderNumber : null;
  } catch {
    return null;
  }
}

export function resolveShopOrderNumber(momoOrderId: string, extraData?: string | null): string {
  return decodeOrderNumberFromExtraData(extraData) || momoOrderId;
}
