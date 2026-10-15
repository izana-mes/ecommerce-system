import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/momo/return/route";
import { buildIpnRawSignature, hmacSha256Hex } from "@/lib/momo";

const originalEnv = process.env;

function signedParams(overrides: Record<string, string> = {}) {
  const params: Record<string, string> = {
    partnerCode: "MOMO",
    orderId: "ORD-1.abc",
    requestId: "req1",
    amount: "1170000",
    orderInfo: "pay",
    orderType: "momo_wallet",
    transId: "99",
    resultCode: "0",
    message: "Successful.",
    payType: "qr",
    responseTime: "1",
    extraData: Buffer.from(JSON.stringify({ orderNumber: "ORD-1" }), "utf8").toString("base64"),
    ...overrides,
  };
  const raw = buildIpnRawSignature({
    accessKey: "access",
    amount: params.amount,
    extraData: params.extraData,
    message: params.message,
    orderId: params.orderId,
    orderInfo: params.orderInfo,
    orderType: params.orderType,
    partnerCode: params.partnerCode,
    payType: params.payType,
    requestId: params.requestId,
    responseTime: params.responseTime,
    resultCode: params.resultCode,
    transId: params.transId,
  });
  params.signature = hmacSha256Hex("secret", raw);
  return params;
}

describe("GET /api/momo/return", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = {
      ...originalEnv,
      MOMO_ACCESS_KEY: "access",
      MOMO_SECRET_KEY: "secret",
    };
  });

  it("accepts a valid successful redirect signature without calling IPN", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const params = signedParams();
    const query = new URLSearchParams(params).toString();
    const req = new NextRequest(`http://localhost:3000/api/momo/return?${query}`);
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.valid).toBe(true);
    expect(json.success).toBe(true);
    expect(json.orderNumber).toBe("ORD-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a cancelled result as a failed payment", async () => {
    const params = signedParams({ resultCode: "1006", message: "User cancelled" });
    const query = new URLSearchParams(params).toString();
    const req = new NextRequest(`http://localhost:3000/api/momo/return?${query}`);
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.valid).toBe(true);
    expect(json.success).toBe(false);
  });

  it("rejects an invalid signature", async () => {
    const params = signedParams();
    params.signature = "0".repeat(64);
    const query = new URLSearchParams(params).toString();
    const req = new NextRequest(`http://localhost:3000/api/momo/return?${query}`);
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
