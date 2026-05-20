export function buildVnpayQuery(overrides: Record<string, string> = {}): URLSearchParams {
  const params = new URLSearchParams({
    vnp_TxnRef: "ORD-1001",
    vnp_Amount: "2600000",
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    ...overrides,
  });
  return params;
}
