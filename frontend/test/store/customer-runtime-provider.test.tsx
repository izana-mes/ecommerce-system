import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReduxProvider from "@/store/provider";
import { logout, setAuth, type User } from "@/lib/auth";

const userFor = (role: User["role"]): User => ({
  id: `${role}-runtime-test`,
  email: `${role}@runtime-test.invalid`,
  role,
});

afterEach(() => {
  cleanup();
  logout();
  vi.unstubAllGlobals();
});

describe("customer runtime provider", () => {
  it.each(["admin", "seller", "supplier", "shipper"] as const)(
    "does not initialize cart or wishlist requests for %s",
    (role) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      setAuth("", userFor(role));

      const view = render(<ReduxProvider><div>management</div></ReduxProvider>);

      expect(fetchMock).not.toHaveBeenCalled();
      view.unmount();
    },
  );

  it("hydrates USER state once and aborts its customer requests when the role changes", async () => {
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      if (init?.signal) {
        signals.push(init.signal);
        init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }
    }));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<ReduxProvider><div>customer</div></ReduxProvider>);
    setAuth("", userFor("user"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls.map(([url]) => String(url)).sort()).toEqual(["/api/cart", "/api/wishlist"]);

    setAuth("", userFor("seller"));
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    view.unmount();
  });

  it("aborts outstanding customer requests on logout", async () => {
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      if (init?.signal) {
        signals.push(init.signal);
        init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }
    }));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<ReduxProvider><div>customer</div></ReduxProvider>);
    setAuth("", userFor("user"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    logout();

    await waitFor(() => expect(signals.every((signal) => signal.aborted)).toBe(true));
    view.unmount();
  });
});
