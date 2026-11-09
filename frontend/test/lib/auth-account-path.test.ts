import { afterEach, describe, expect, it, vi } from "vitest";
import { accountPathForUser, getUser, homePathForRole, logout, refreshCurrentUserFromServer } from "@/lib/auth";

afterEach(() => {
  logout();
  vi.unstubAllGlobals();
});

describe("navbar account destination", () => {
  it("takes guests to the login form", () => {
    expect(accountPathForUser(null)).toBe("/login");
  });

  it("keeps authenticated users on their profile", () => {
    expect(accountPathForUser({ email: "customer@example.com", role: "user" })).toBe("/profile");
  });

  it.each([
    ["admin", "/admin"],
    ["seller", "/seller/dashboard"],
    ["supplier", "/supplier/dashboard"],
    ["shipper", "/shipper/dashboard"],
    ["user", "/"],
  ] as const)("routes %s to its application after login", (role, destination) => {
    expect(homePathForRole(role)).toBe(destination);
  });

  it("deduplicates concurrent identity refresh requests", async () => {
    let resolveResponse!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveResponse = resolve; }));
    vi.stubGlobal("fetch", fetchMock);

    const first = refreshCurrentUserFromServer();
    const second = refreshCurrentUserFromServer();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveResponse(new Response(JSON.stringify({ data: { id: "u-1", email: "user@example.com", role: "user" } }), { status: 200 }));

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ email: "user@example.com", role: "user" }),
      expect.objectContaining({ email: "user@example.com", role: "user" }),
    ]);
    expect(getUser()?.email).toBe("user@example.com");
  });
});
