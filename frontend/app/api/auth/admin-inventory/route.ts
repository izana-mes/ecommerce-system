import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

type Product = {
  productID: string;
  productName: string;
  stockQuantity?: number;
  active?: boolean;
};

type InventoryHealthItem = {
  productID: string;
  productName: string;
  stockQuantity?: number;
  reservedInCarts?: number;
  availableToSell?: number;
  active?: boolean;
};

type BackendInventoryHealth = {
  totalProducts?: number;
  activeProducts?: number;
  totalStock?: number;
  totalReservedInCarts?: number;
  totalAvailableToSell?: number;
  lowStockThreshold?: number;
  lowStockCount?: number;
  outOfStockCount?: number;
  lowStockItems?: InventoryHealthItem[];
  outOfStockItems?: InventoryHealthItem[];
};

type BackendDashboardSoldProduct = {
  productID?: string;
  productName?: string;
  soldQty?: number;
};

type BackendDashboardPayload = {
  data?: {
    topSoldProducts?: BackendDashboardSoldProduct[];
  };
  topSoldProducts?: BackendDashboardSoldProduct[];
};

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: Request) {
  try {
        const { searchParams } = new URL(request.url);
    const lowStockThreshold = Math.max(1, Number(searchParams.get("lowStockThreshold") ?? 5) || 5);

    const [productResponse, inventoryHealthResponse, dashboardResponse] = await Promise.all([
      fetch(`${API_URL}/products`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"},
        cache: "no-store"}),
      fetch(`${API_URL}/products/inventory-health?lowStockThreshold=${lowStockThreshold}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"},
        cache: "no-store"}),
      fetch(`${API_URL}/v1/admin/dashboard?days=30&recentLimit=10&lowStockThreshold=${lowStockThreshold}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"},
        cache: "no-store"}),
    ]);

    const products = (await productResponse.json()) as Product[];
    const backendHealth = (await inventoryHealthResponse.json()) as BackendInventoryHealth;
    const dashboardPayload = (await dashboardResponse.json()) as BackendDashboardPayload;
    if (!productResponse.ok || !Array.isArray(products)) {
      return NextResponse.json({ error: "Failed to fetch products" }, { status: 502 });
    }
    if (!inventoryHealthResponse.ok || !backendHealth || typeof backendHealth !== "object") {
      return NextResponse.json({ error: "Failed to fetch inventory health" }, { status: 502 });
    }

    const soldItemsRaw =
      (dashboardPayload?.data && Array.isArray(dashboardPayload.data.topSoldProducts)
        ? dashboardPayload.data.topSoldProducts
        : Array.isArray(dashboardPayload?.topSoldProducts)
          ? dashboardPayload.topSoldProducts
          : []) ?? [];
    const soldByProductId = new Map(
      soldItemsRaw
        .filter((item) => Boolean(item?.productID))
        .map((item) => [String(item.productID), Math.max(0, asNumber(item.soldQty, 0))])
    );

    const productById = new Map(
      products.map((product) => [
        product.productID,
        {
          productID: product.productID,
          productName: product.productName,
          stockQuantity: Math.max(0, asNumber(product.stockQuantity, 0)),
          active: product.active !== false},
      ])
    );

    const normalizeHealthItems = (items: InventoryHealthItem[] | undefined) =>
      (items ?? []).map((item) => {
        const base = productById.get(item.productID);
        return {
          productID: item.productID,
          productName: item.productName || base?.productName || item.productID,
          stockQuantity: Math.max(0, asNumber(item.stockQuantity ?? base?.stockQuantity, 0)),
          reservedInCarts: Math.max(0, asNumber(item.reservedInCarts, 0)),
          availableToSell: Math.max(0, asNumber(item.availableToSell, 0)),
          active: item.active !== false && base?.active !== false};
      });

    const lowStockItems = normalizeHealthItems(backendHealth.lowStockItems);
    const outOfStockItems = normalizeHealthItems(backendHealth.outOfStockItems);

    const enriched = products.map((p) => {
      const healthItem =
        [...lowStockItems, ...outOfStockItems].find((item) => item.productID === p.productID) || null;
      const stockQuantity = healthItem?.stockQuantity ?? Math.max(0, asNumber(p.stockQuantity, 0));
      const reservedInCarts = healthItem?.reservedInCarts ?? 0;
      const availableToSell = healthItem?.availableToSell ?? Math.max(0, stockQuantity - reservedInCarts);
      return {
        productID: p.productID,
        productName: p.productName,
        stockQuantity,
        reservedInCarts,
        availableToSell,
        soldQty: soldByProductId.get(p.productID) ?? 0,
        active: p.active !== false};
    });

    const noSalesItems = enriched
      .filter((p) => p.active && p.soldQty === 0)
      .sort((a, b) => a.availableToSell - b.availableToSell)
      .slice(0, 20);

    const topSellingItems = [...enriched]
      .sort((a, b) => b.soldQty - a.soldQty)
      .filter((p) => p.soldQty > 0)
      .slice(0, 10);

    return NextResponse.json({
      totalProducts: asNumber(backendHealth.totalProducts, enriched.length),
      activeProducts: asNumber(
        backendHealth.activeProducts,
        enriched.filter((p) => p.active).length
      ),
      totalStock: asNumber(backendHealth.totalStock, enriched.reduce((sum, p) => sum + p.stockQuantity, 0)),
      totalReservedInCarts: asNumber(
        backendHealth.totalReservedInCarts,
        enriched.reduce((sum, p) => sum + p.reservedInCarts, 0)
      ),
      totalAvailableToSell: asNumber(
        backendHealth.totalAvailableToSell,
        enriched.reduce((sum, p) => sum + p.availableToSell, 0)
      ),
      lowStockThreshold: asNumber(backendHealth.lowStockThreshold, lowStockThreshold),
      lowStockCount: asNumber(backendHealth.lowStockCount, lowStockItems.length),
      outOfStockCount: asNumber(backendHealth.outOfStockCount, outOfStockItems.length),
      lowStockItems,
      outOfStockItems,
      noSalesItems,
      topSellingItems});
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to fetch inventory health", details: message },
      { status: 500 }
    );
  }
}
