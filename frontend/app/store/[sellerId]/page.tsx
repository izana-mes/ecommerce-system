"use client";

import { use, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { DataStore } from "@/data/StoreData";
import { useAppDispatch } from "@/store/index";
import { addToCartAsync } from "@/store/cartSlice";
import toast from "react-hot-toast";
import { FaStar, FaStore, FaShieldAlt, FaBoxOpen, FaSearch } from "react-icons/fa";
import { FiArrowLeft } from "react-icons/fi";

const FALLBACK_IMAGE = "/Products/product_1.jpg";

function resolveImage(src?: string | null): string {
  const val = String(src ?? "").trim();
  if (!val) return FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(val) || val.startsWith("/") || val.startsWith("/Products/")) {
    return val;
  }
  return FALLBACK_IMAGE;
}

export default function SellerStorePage({
  params,
}: {
  params: Promise<{ sellerId: string }>;
}) {
  const { sellerId } = use(params);
  const dispatch = useAppDispatch();

  const [products, setProducts] = useState<DataStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function fetchProducts() {
      try {
        setLoading(true);
        const res = await fetch("/api/products", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load products");
        const data = await res.json();
        if (cancelled) return;

        const all = Array.isArray(data) ? data : [];
        // Filter products belonging to this seller
        const sellerProducts = all.filter(
          (p: DataStore) => String(p.sellerUserId ?? "") === String(sellerId)
        );
        setProducts(sellerProducts);
      } catch (err) {
        if (!cancelled) {
          toast.error("Could not load seller products");
          setProducts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ["all", ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !search.trim() ||
        p.productName.toLowerCase().includes(search.toLowerCase()) ||
        p.productID.toLowerCase().includes(search.toLowerCase());
      const matchCat =
        selectedCategory === "all" || p.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [products, search, selectedCategory]);

  const handleAddToCart = async (product: DataStore) => {
    try {
      await dispatch(
        addToCartAsync({
          productID: product.productID,
          productName: product.productName,
          productPrice: product.productPrice,
          productReviews: product.productReviews || "",
          stockQuantity: product.stockQuantity,
        })
      ).unwrap();
      toast.success(`Added ${product.productName} to cart`);
    } catch {
      toast.error("Could not add to cart");
    }
  };

  const shortSellerId = sellerId.length > 8 ? sellerId.slice(0, 8) : sellerId;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", paddingBottom: 60 }}>
      {/* Store Header Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          color: "#fff",
          padding: "48px 24px 36px",
          borderBottom: "1px solid #334155",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Link
            href="/shop"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: "#94a3b8",
              textDecoration: "none",
              fontSize: 14,
              marginBottom: 20,
            }}
          >
            <FiArrowLeft /> Back to Marketplace Shop
          </Link>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                boxShadow: "0 10px 25px rgba(99, 102, 241, 0.4)",
              }}
            >
              🏪
            </div>

            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>
                  Seller Store #{shortSellerId}
                </h1>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    background: "rgba(16, 185, 129, 0.2)",
                    color: "#10b981",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                  }}
                >
                  <FaShieldAlt /> Verified Marketplace Seller
                </span>
              </div>
              <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 14 }}>
                Authentic merchandise directly managed and fulfilled by this authorized marketplace seller.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 20,
                  marginTop: 12,
                  fontSize: 13,
                  color: "#cbd5e1",
                }}
              >
                <span>
                  <FaBoxOpen style={{ marginRight: 6, verticalAlign: -1 }} />
                  <strong>{products.length}</strong> Listed Products
                </span>
                <span>
                  <FaStore style={{ marginRight: 6, verticalAlign: -1 }} />
                  Seller ID: <code style={{ color: "#a5b4fc" }}>{shortSellerId}</code>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 1200, margin: "32px auto 0", padding: "0 24px" }}>
        {/* Search & Filter Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 28,
            background: "#fff",
            padding: 16,
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 240 }}>
            <FaSearch style={{ color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Search products in this store..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                fontSize: 14,
                color: "#1e293b",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: selectedCategory === cat ? 600 : 400,
                  background: selectedCategory === cat ? "#1e293b" : "#f1f5f9",
                  color: selectedCategory === cat ? "#fff" : "#475569",
                  transition: "all 0.15s ease",
                  textTransform: "capitalize",
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#64748b" }}>
            <div
              style={{
                width: 40,
                height: 40,
                border: "3px solid #cbd5e1",
                borderTopColor: "#6366f1",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto 16px",
              }}
            />
            <p>Loading store catalog...</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 24px",
              background: "#fff",
              borderRadius: 16,
              color: "#64748b",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
            <h3 style={{ fontSize: 18, color: "#1e293b", marginBottom: 6 }}>No Products Found</h3>
            <p style={{ fontSize: 14, maxWidth: 400, margin: "0 auto" }}>
              {search || selectedCategory !== "all"
                ? "No products in this store match your search criteria."
                : "This seller does not currently have any active approved products on the public marketplace."}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 24,
            }}
          >
            {filteredProducts.map((product) => {
              const image = resolveImage(product.frontImg);
              return (
                <div
                  key={product.productID}
                  style={{
                    background: "#fff",
                    borderRadius: 14,
                    overflow: "hidden",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Link
                    href={`/shop/${encodeURIComponent(product.productID)}`}
                    style={{ position: "relative", width: "100%", paddingTop: "110%", display: "block" }}
                  >
                    <img
                      src={image}
                      alt={product.productName}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </Link>

                  <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>
                      {product.category || "General"}
                    </div>

                    <Link
                      href={`/shop/${encodeURIComponent(product.productID)}`}
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#0f172a",
                        textDecoration: "none",
                        margin: "6px 0 8px",
                        lineHeight: 1.3,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {product.productName}
                    </Link>

                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
                      <FaStar style={{ color: "#f59e0b", fontSize: 13 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                        {product.productReviews || "4.8"}
                      </span>
                    </div>

                    {product.supplierUserId && (
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                        Supplied by: <strong style={{ color: "#334155" }}>Supplier #{String(product.supplierUserId).slice(0, 8)}</strong>
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: "auto",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: 12,
                        borderTop: "1px solid #f1f5f9",
                      }}
                    >
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                        ${product.productPrice}
                      </div>

                      <button
                        onClick={() => void handleAddToCart(product)}
                        style={{
                          background: "#1e293b",
                          color: "#fff",
                          border: "none",
                          padding: "8px 14px",
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
