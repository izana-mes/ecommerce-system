import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/vnpay/return/route";
import { createVnpSecureHash } from "@/lib/vnpay";

const originalEnv = process.env;

describe("GET /api/vnpay/return", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv, VNPAY_HASH_SECRET: "secret" };
  });

  it("returns 400 for missing required params", async () => {
    const req = new NextRequest("http://localhost:3000/api/vnpay/return");
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it("returns success for valid signature and paid code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));

    const params = {
      vnp_TxnRef: "ORD-1001",
      vnp_Amount: "2600000",
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
    };
    const secureHash = createVnpSecureHash(params, "secret");
    const query = new URLSearchParams({ ...params, vnp_SecureHash: secureHash }).toString();

    const req = new NextRequest(`http://localhost:3000/api/vnpay/return?${query}`);
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.orderNumber).toBe("ORD-1001");
  });
});
