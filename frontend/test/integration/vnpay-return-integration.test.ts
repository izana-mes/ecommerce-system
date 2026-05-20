import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/vnpay/return/route";
import { createVnpSecureHash } from "@/lib/vnpay";

describe("VNPAY return integration behavior", () => {
  it("does not return 500 when backend IPN fails", async () => {
    process.env.VNPAY_HASH_SECRET = "secret";
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("backend down");
    }));

    const params = {
      vnp_TxnRef: "ORD-2001",
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
      vnp_Amount: "2600000",
    };
    const secureHash = createVnpSecureHash(params, "secret");
    const req = new NextRequest(
      `http://localhost:3000/api/vnpay/return?${new URLSearchParams({ ...params, vnp_SecureHash: secureHash })}`
    );

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
  });
});
