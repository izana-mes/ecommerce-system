import { test, expect } from "@playwright/test";

test.describe("critical ecommerce + ai flows", () => {
  test("login route is reachable", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/login/);
  });

  test("checkout and payment pages are reachable", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.locator("body")).toBeVisible();
    await page.goto("/payment/vnpay-return");
    await expect(page.locator("body")).toBeVisible();
  });

  test("chatbot and mcp surfaces are reachable", async ({ page }) => {
    await page.goto("/chatbot");
    await expect(page.locator("body")).toBeVisible();
    const resp = await page.request.get("/api/chatbot/ask");
    expect([200, 400, 401, 405]).toContain(resp.status());
  });
});
