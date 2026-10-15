import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/momo/create-payment/route";

const originalEnv = process.env;

describe("POST /api/momo/create-payment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = {
      ...originalEnv,
      MOMO_ENV: "sandbox",
      MOMO_ENDPOINT: "https://test-payment.momo.vn",
      MOMO_PARTNER_CODE: "MOMO",
      MOMO_ACCESS_KEY: "access",
      MOMO_SECRET_KEY: "secret",
      MOMO_REDIRECT_URL: "http://localhost:3000/payment/momo-return",
      MOMO_IPN_URL: "http://localhost:8080/api/payments/momo/ipn",
      MOMO_USD_TO_VND_RATE: "26000",
    };
  });

  it("sends payWithMethod Collection Link request to the sandbox create API", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.amount).toBe(1_170_000);
      expect(body.requestType).toBe("payWithMethod");
      expect(body.partnerName).toBe("Test");
      expect(body.storeId).toBe("MoMoTestStore");
      expect(body.lang).toBe("vi");
      expect(body.redirectUrl).toBe("http://localhost:3000/payment/momo-return");
      expect(body.ipnUrl).toBe("http://localhost:8080/api/payments/momo/ipn");
      expect(typeof body.requestId).toBe("string");
      expect(String(body.orderId)).toMatch(/^ORD-8770951354-0340\./);
      expect(body.orderGroupId).toBeUndefined();
      return Response.json({ resultCode: 0, payUrl: "https://test-payment.momo.vn/v2/gateway/pay?t=x" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new NextRequest("http://localhost:3000/api/momo/create-payment", {
      method: "POST",
      body: JSON.stringify({ orderNumber: "ORD-8770951354-0340", amount: 45 }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.paymentUrl).toBe("https://test-payment.momo.vn/v2/gateway/pay?t=x");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://test-payment.momo.vn/v2/gateway/api/create",
      expect.objectContaining({ method: "POST" })
    );
  });
});
