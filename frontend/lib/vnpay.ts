import crypto from "crypto";
import qs from "qs";

export type VnpParams = Record<string, string | number | undefined | null>;

function encodeVnpComponent(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

export function formatVnpDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  const hh = `${date.getHours()}`.padStart(2, "0");
  const mi = `${date.getMinutes()}`.padStart(2, "0");
  const ss = `${date.getSeconds()}`.padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

export function toGmt7(date = new Date()): Date {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utcMs + 7 * 60 * 60000);
}

function sortAndEncodeParams(params: VnpParams): Record<string, string> {
  const sortedKeys = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .sort();

  const encoded: Record<string, string> = {};
  for (const key of sortedKeys) {
    encoded[encodeVnpComponent(key)] = encodeVnpComponent(String(params[key]));
  }
  return encoded;
}

export function buildVnpHashData(params: VnpParams): string {
  return qs.stringify(sortAndEncodeParams(params), {
    encode: false});
}

export function createVnpSecureHash(params: VnpParams, secret: string): string {
  const hashData = buildVnpHashData(params);
  return crypto.createHmac("sha512", secret.trim()).update(hashData, "utf8").digest("hex");
}

export function buildVnpPaymentUrl(baseUrl: string, params: VnpParams, secret: string): string {
  const hashData = buildVnpHashData(params);
  const hash = crypto.createHmac("sha512", secret.trim()).update(hashData, "utf8").digest("hex");
  return `${baseUrl}?${hashData}&vnp_SecureHash=${hash}`;
}
