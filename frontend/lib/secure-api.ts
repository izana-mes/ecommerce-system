import { csrfHeader, ensureCsrfToken } from "@/lib/csrf";

export class ApiError extends Error {
  status: number;
  requestId?: string;

  constructor(message: string, status: number, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type ApiRequestOptions = {
  method?: Method;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retry?: number;
};

function isUnsafeMethod(method: Method): boolean {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

function makeRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function requestOnce<T>(url: string, options: ApiRequestOptions): Promise<T> {
  const method = options.method ?? "GET";
  if (isUnsafeMethod(method)) {
    await ensureCsrfToken();
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(1000, options.timeoutMs ?? 10000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const requestId = makeRequestId();

  try {
    const response = await fetch(url, {
      method,
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
        ...(isUnsafeMethod(method) ? csrfHeader() : {}),
        ...(options.headers ?? {})},
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})});

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const message = errorPayload?.message || errorPayload?.error || `Request failed (${response.status})`;
      throw new ApiError(message, response.status, errorPayload?.requestId);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function secureApiRequest<T>(url: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const retries = method === "GET" ? Math.min(2, options.retry ?? 1) : 0;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestOnce<T>(url, options);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      if (error instanceof ApiError && error.status < 500) break;
    }
  }

  throw lastError;
}
