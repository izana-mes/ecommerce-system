import { vi } from "vitest";

export function mockFetchOk(body: unknown = { ok: true }) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
}
