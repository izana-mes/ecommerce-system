import { useState, useEffect } from "react";
import { DataStore } from "@/data/StoreData";
import StoreData from "@/data/StoreData";
import { getUser, subscribeToAuthChanges } from "@/lib/auth";

const normalizeProducts = (items: DataStore[]): DataStore[] =>
  items.map((product: DataStore) => ({
    ...product,
    backImg: product.backImg || product.frontImg,
    sizes: Array.isArray(product?.sizes)
      ? product.sizes
          .map((size) => String(size ?? "").trim())
          .filter(Boolean)
      : [],
    stockQuantity: Math.max(0, Number(product?.stockQuantity ?? 25)),
    active: product?.active !== false,
    category: String(product?.category ?? "").trim() || "Uncategorized",
    oldPrice:
      Number.isFinite(Number(product?.oldPrice)) && Number(product?.oldPrice) > 0
        ? Number(product.oldPrice)
        : undefined}));

const getFallbackProducts = (q: string): DataStore[] => {
  const lowered = q.trim().toLowerCase();
  const base = normalizeProducts(StoreData);
  if (!lowered) return base;

  return base.filter((product) => {
    const productName = String(product.productName ?? "").toLowerCase();
    const productId = String(product.productID ?? "").toLowerCase();
    return productName.includes(lowered) || productId.includes(lowered);
  });
};

/** Accept raw JSON array or Spring-style `{ data: [...] }` from the API / proxy. */
function extractProductArray(data: unknown): DataStore[] {
  if (Array.isArray(data)) {
    return data as DataStore[];
  }
  if (data && typeof data === "object" && "data" in data) {
    const inner = (data as { data: unknown }).data;
    if (Array.isArray(inner)) {
      return inner as DataStore[];
    }
  }
  return [];
}

type ProductsCacheEntry = {
  data: DataStore[];
  fallback: boolean;
  timestamp: number;
};

const productsCache = new Map<string, ProductsCacheEntry>();
const inFlightProducts = new Map<string, Promise<ProductsCacheEntry>>();
let productsCacheGeneration = 0;
const CACHE_TTL_MS = 30_000;
const MAX_CACHED_PRODUCT_QUERIES = 50;

function cacheKeyFor(query: string): string {
  // Product results are public, but a search also records per-user history on
  // the backend. Do not coalesce that side effect across session changes.
  const userId = getUser()?.id;
  return `${userId == null ? "anonymous" : String(userId)}\u0000${query}`;
}

export function invalidateProductsCache(): void {
  productsCacheGeneration += 1;
  productsCache.clear();
  inFlightProducts.clear();
}

export function resetProductsCacheForTests(): void {
  invalidateProductsCache();
}

function cacheProducts(query: string, entry: ProductsCacheEntry) {
  const now = Date.now();
  for (const [key, cached] of productsCache) {
    if (now - cached.timestamp >= CACHE_TTL_MS) {
      productsCache.delete(key);
    }
  }

  if (!productsCache.has(query) && productsCache.size >= MAX_CACHED_PRODUCT_QUERIES) {
    const oldestQuery = productsCache.keys().next().value;
    if (oldestQuery !== undefined) {
      productsCache.delete(oldestQuery);
    }
  }

  productsCache.delete(query);
  productsCache.set(query, entry);
}

function loadProducts(cacheKey: string, query: string): Promise<ProductsCacheEntry> {
  const existing = inFlightProducts.get(cacheKey);
  if (existing) {
    return existing;
  }

  const generation = productsCacheGeneration;
  const request = (async () => {
    const endpoint = query
      ? `/api/products?q=${encodeURIComponent(query)}`
      : "/api/products";
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error("Failed to fetch products");
    }

    const normalized = normalizeProducts(extractProductArray(await response.json()));
    const fallback = !query && normalized.length === 0;
    const entry = {
      data: fallback ? getFallbackProducts("") : normalized,
      fallback,
      timestamp: Date.now()
    };
    if (generation === productsCacheGeneration) {
      cacheProducts(cacheKey, entry);
    }
    return entry;
  })();

  inFlightProducts.set(cacheKey, request);
  void request.then(
    () => inFlightProducts.delete(cacheKey),
    () => inFlightProducts.delete(cacheKey)
  );
  return request;
}

export function useProducts(query?: string) {
  const normalizedQuery = (query ?? "").trim();
  const [authRevision, setAuthRevision] = useState(0);
  const cacheKey = cacheKeyFor(normalizedQuery);
  const cached = productsCache.get(cacheKey);
  const isCacheFresh = cached && Date.now() - cached.timestamp < CACHE_TTL_MS;

  const [products, setProducts] = useState<DataStore[]>(() => isCacheFresh ? cached.data : []);
  const [loading, setLoading] = useState<boolean>(() => !isCacheFresh);
  const [error, setError] = useState<string | null>(null);
  const [fallbackUsed, setFallbackUsed] = useState<boolean>(() => isCacheFresh ? cached.fallback : false);

  useEffect(() => subscribeToAuthChanges(() => setAuthRevision((revision) => revision + 1)), []);

  useEffect(() => {
    let isCancelled = false;

    async function fetchProducts() {
      const existing = productsCache.get(cacheKey);
      if (existing && Date.now() - existing.timestamp < CACHE_TTL_MS) {
        setProducts(existing.data);
        setFallbackUsed(existing.fallback);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        const resolved = await loadProducts(cacheKey, normalizedQuery);

        if (!isCancelled) {
          setProducts(resolved.data);
          setFallbackUsed(resolved.fallback);
          setError(null);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Error fetching products:", err);
          const fallbackData = getFallbackProducts(normalizedQuery);
          setProducts(fallbackData);
          setFallbackUsed(true);
          setError(null);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    fetchProducts();

    return () => {
      isCancelled = true;
    };
  }, [cacheKey, normalizedQuery, authRevision]);

  return { products, loading, error, fallbackUsed };
}
