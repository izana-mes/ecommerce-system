import { describe, expect, it } from "vitest";
import { accountPathForUser } from "@/lib/auth";

describe("navbar account destination", () => {
  it("takes guests to the login form", () => {
    expect(accountPathForUser(null)).toBe("/login");
  });

  it("keeps authenticated users on their profile", () => {
    expect(accountPathForUser({ email: "customer@example.com", role: "user" })).toBe("/profile");
  });
});
