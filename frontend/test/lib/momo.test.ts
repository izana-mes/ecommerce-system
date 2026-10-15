import { describe, expect, it } from "vitest";
import {
  MOMO_REQUEST_TYPE,
  MOMO_SANDBOX_ENDPOINT,
  buildCreateRawSignature,
  hmacSha256Hex,
  resolveMomoCreateUrl,
  resolveMomoEndpoint,
  resolveMomoRequestType,
  resolveShopOrderNumber,
  signaturesMatch,
  toVndAmount,
} from "@/lib/momo";

describe("momo helpers", () => {
  it("converts USD to integer VND using configured rate", () => {
    expect(toVndAmount(45, 26000)).toBe(1_170_000);
  });

  it("uses sandbox host by default and production only when MOMO_ENV says so", () => {
    expect(resolveMomoEndpoint({} as NodeJS.ProcessEnv)).toBe(MOMO_SANDBOX_ENDPOINT);
    expect(resolveMomoEndpoint({ MOMO_ENV: "sandbox" } as NodeJS.ProcessEnv)).toBe(
      "https://test-payment.momo.vn"
    );
    expect(resolveMomoEndpoint({ MOMO_ENV: "production" } as NodeJS.ProcessEnv)).toBe(
      "https://payment.momo.vn"
    );
    expect(
      resolveMomoEndpoint({ MOMO_ENDPOINT: "https://test-payment.momo.vn/" } as NodeJS.ProcessEnv)
    ).toBe("https://test-payment.momo.vn");
  });

  it("builds the official create API URL", () => {
    expect(resolveMomoCreateUrl("https://test-payment.momo.vn")).toBe(
      "https://test-payment.momo.vn/v2/gateway/api/create"
    );
    expect(resolveMomoCreateUrl("https://test-payment.momo.vn/v2/gateway/api/create")).toBe(
      "https://test-payment.momo.vn/v2/gateway/api/create"
    );
  });

  it("maps shop order from extraData, not from orderId suffixes", () => {
    const extra = Buffer.from(JSON.stringify({ orderNumber: "ORD-8770951354-0340" }), "utf8").toString(
      "base64"
    );
    expect(resolveShopOrderNumber("ORD-8770951354-0340.abc123", extra)).toBe("ORD-8770951354-0340");
    expect(resolveShopOrderNumber("ORD-8770951354-0340-1725680000000")).toBe(
      "ORD-8770951354-0340-1725680000000"
    );
  });

  it("defaults to Collection Link payWithMethod and allows official overrides", () => {
    expect(resolveMomoRequestType({} as NodeJS.ProcessEnv)).toBe("payWithMethod");
    expect(resolveMomoRequestType({ MOMO_REQUEST_TYPE: "payWithATM" } as NodeJS.ProcessEnv)).toBe(
      "payWithATM"
    );
    expect(resolveMomoRequestType({ MOMO_REQUEST_TYPE: "not-a-momo-type" } as NodeJS.ProcessEnv)).toBe(
      "payWithMethod"
    );
  });

  it("signs create payload in documented payWithMethod field order", () => {
    const raw = buildCreateRawSignature({
      accessKey: "access",
      amount: 1170000,
      extraData: "",
      ipnUrl: "https://example.com/ipn",
      orderId: "ORD-1",
      orderInfo: "info",
      partnerCode: "MOMO",
      redirectUrl: "https://example.com/return",
      requestId: "req",
      requestType: MOMO_REQUEST_TYPE,
    });
    expect(raw).toBe(
      "accessKey=access&amount=1170000&extraData=&ipnUrl=https://example.com/ipn&orderId=ORD-1&orderInfo=info&partnerCode=MOMO&redirectUrl=https://example.com/return&requestId=req&requestType=payWithMethod"
    );
    const hex = hmacSha256Hex("secret", raw);
    expect(hex).toHaveLength(64);
    expect(signaturesMatch(hex, hex)).toBe(true);
  });
});
