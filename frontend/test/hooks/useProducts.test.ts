import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { invalidateProductsCache, resetProductsCacheForTests, useProducts } from "@/hooks/useProducts";

describe("useProducts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetProductsCacheForTests();
  });

  it("shares an in-flight request between concurrent consumers", async () => {
    const response = {
      ok: true,
      json: async () => ({
        data: [{
          productID: "coalesced-request-test",
          frontImg: "/product.jpg",
          productName: "Test product",
          productPrice: 10,
          productReviews: "0 reviews"
        }]
      })
    };
    const fetchMock = vi.fn().mockReturnValue(new Promise((resolve) => {
      setTimeout(() => resolve(response), 0);
    }));
    vi.stubGlobal("fetch", fetchMock);

    const first = renderHook(() => useProducts("coalesced-request-test"));
    const second = renderHook(() => useProducts("coalesced-request-test"));

    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
      expect(second.result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.result.current.products[0]?.productID).toBe("coalesced-request-test");
    first.unmount();
    second.unmount();
  });

  it("retries after a rejected coalesced request", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    const first = renderHook(() => useProducts("retry-test"));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    first.unmount();

    const second = renderHook(() => useProducts("retry-test"));
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    second.unmount();
  });

  it("invalidates cached results after a product mutation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    const first = renderHook(() => useProducts("invalidate-test"));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    first.unmount();
    invalidateProductsCache();

    const second = renderHook(() => useProducts("invalidate-test"));
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    second.unmount();
  });

  it("keeps at most 50 cached product queries", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => ({ data: [{
        productID: url,
        frontImg: "/product.jpg",
        productName: url,
        productPrice: 10,
        productReviews: "0 reviews"
      }] })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const hook = renderHook(({ query }) => useProducts(query), { initialProps: { query: "query-0" } });
    for (let index = 0; index <= 50; index += 1) {
      hook.rerender({ query: `query-${index}` });
      await waitFor(() => expect(hook.result.current.products[0]?.productName).toContain(`query-${index}`));
    }
    hook.rerender({ query: "query-0" });
    await waitFor(() => expect(hook.result.current.products[0]?.productName).toContain("query-0"));

    expect(fetchMock).toHaveBeenCalledTimes(52);
    hook.unmount();
  });
});
