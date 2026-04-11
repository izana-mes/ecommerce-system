import { useState, useEffect } from "react";
import { DataStore } from "@/data/StoreData";
import StoreData from "@/data/StoreData";

const normalizeProducts = (items: DataStore[]): DataStore[] =>
  items.map((product: DataStore) => ({
    ...product,
    backImg: product.backImg || product.frontImg,
    stockQuantity: Math.max(0, Number(product?.stockQuantity ?? 25)),
    active: product?.active !== false,
  }));

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

export function useProducts(query?: string) {
  const [products, setProducts] = useState<DataStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fallbackUsed, setFallbackUsed] = useState(false);

  useEffect(() => {
    async function fetchProducts() {
      const normalizedQuery = (query ?? "").trim();
      try {
        setLoading(true);
        const endpoint = normalizedQuery
          ? `/api/products?q=${encodeURIComponent(normalizedQuery)}`
          : "/api/products";
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error("Failed to fetch products");
        }
        const data = await response.json();
        const normalized = normalizeProducts(extractProductArray(data));
        const useFallback =
          !normalizedQuery && normalized.length === 0;
        if (useFallback) {
          setProducts(getFallbackProducts(""));
          setFallbackUsed(true);
        } else {
          setProducts(normalized);
          setFallbackUsed(false);
        }
        setError(null);
      } catch (err) {
        console.error("Error fetching products:", err);
        setProducts(getFallbackProducts(normalizedQuery));
        setError(null);
        setFallbackUsed(true);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [query]);

  return { products, loading, error, fallbackUsed };
}
