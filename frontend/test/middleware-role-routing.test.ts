import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

const roleHome: Record<string, string> = {
  admin: "/admin",
  seller: "/seller/dashboard",
  supplier: "/supplier/dashboard",
  shipper: "/shipper/dashboard",
};

async function request(path: string, role: string) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { email: "test@example.com", role } }), { status: 200 })));
  return middleware(new NextRequest(`http://localhost${path}`, { headers: { cookie: "access_token=session" } }));
}

afterEach(() => vi.unstubAllGlobals());

describe("role based application routing", () => {
  for (const [role, home] of Object.entries(roleHome)) {
    it(`${role} is routed to its own dashboard from the customer home`, async () => {
      const response = await request("/", role);
      expect(response.headers.get("location")).toBe(`http://localhost${home}`);
    });

    it(`${role} cannot open customer shopping routes or another role's dashboard`, async () => {
      const shop = await request("/shop", role);
      expect(shop.headers.get("location")).toBe(`http://localhost${home}`);
      const otherRoleHome = Object.values(roleHome).find((candidate) => candidate !== home)!;
      const crossRole = await request(otherRoleHome, role);
      expect(crossRole.headers.get("location")).toBe(`http://localhost${home}`);
    });
  }

  it("USER retains customer home and cannot open management routes", async () => {
    const home = await request("/", "user");
    expect(home.headers.get("location")).toBeNull();
    const management = await request("/seller/dashboard", "user");
    expect(management.headers.get("location")).toBe("http://localhost/");
  });

  it("keeps the public shopping catalog available to guests", async () => {
    const response = await middleware(new NextRequest("http://localhost/shop"));
    expect(response.headers.get("location")).toBeNull();
  });
});
