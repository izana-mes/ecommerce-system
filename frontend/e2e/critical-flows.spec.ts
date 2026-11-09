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

  test("seller listing autocomplete opens its exact catalog detail route", async ({ page }) => {
    const listingKey = "LISTING:d39d8642-3fc0-4882-91cc-bc9070276d34";
    await page.route("**/api/products/suggest?**", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{
        productID: listingKey,
        productName: "COLD JACKET",
        frontImg: "/Products/product_1.jpg",
        productPrice: 62,
        sellerUserId: "seller-id",
        supplierUserId: "supplier-id",
      }]),
    }));
    await page.goto("/");
    const search = page.getByRole("textbox", { name: /search products/i });
    await search.fill("cold");
    const suggestion = page.getByRole("button", { name: /COLD JACKET.*Seller.*62/i });
    await expect(suggestion).toBeVisible();
    await suggestion.click();
    await expect(page).toHaveURL(/\/shop\/LISTING%3Ad39d8642-3fc0-4882-91cc-bc9070276d34$/i);
  });
});
