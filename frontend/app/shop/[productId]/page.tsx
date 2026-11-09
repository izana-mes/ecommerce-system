"use client";

import { use, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataStore } from "@/data/StoreData";
import { useAppDispatch } from "@/store/index";
import { addToCartAsync } from "@/store/cartSlice";
import { decodeCatalogId } from "@/lib/catalogId";
import { getUser, isAuthenticated } from "@/lib/auth";
import toast from "react-hot-toast";
import {
  FaStar,
  FaRegStar,
  FaStore,
  FaTruckLoading,
  FaShieldAlt,
  FaCheckCircle,
  FaCartPlus,
  FaBolt,
} from "react-icons/fa";
import { FiArrowLeft, FiMessageCircle } from "react-icons/fi";

const FALLBACK_IMAGE = "/Products/product_1.jpg";

function resolveImage(src?: string | null): string {
  const val = String(src ?? "").trim();
  if (!val) return FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(val) || val.startsWith("/") || val.startsWith("/Products/")) {
    return val;
  }
  return FALLBACK_IMAGE;
}

type ProductReview = {
  id: string;
  rating: number;
  comment: string;
  author: string;
  createdAt: string;
};

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = use(params);
  const catalogId = decodeCatalogId(productId);
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [product, setProduct] = useState<DataStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Gallery
  const [selectedImage, setSelectedImage] = useState<string>(FALLBACK_IMAGE);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);

  // Reviews
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [averageRating, setAverageRating] = useState<number>(5.0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Related products
  const [relatedProducts, setRelatedProducts] = useState<DataStore[]>([]);

  // 1. Fetch Product
  useEffect(() => {
    let cancelled = false;
    async function loadProduct() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/products/${encodeURIComponent(catalogId)}`, {
          cache: "no-store",
          credentials: "include",
        });

        if (res.status === 404) {
          throw new Error("This product is either inactive, unpublished, or does not exist.");
        }
        if (!res.ok) {
          throw new Error("Failed to load product details.");
        }

        const data: DataStore = await res.json();
        if (cancelled) return;

        setProduct(data);
        const front = resolveImage(data.frontImg);
        setSelectedImage(front);
        if (data.sizes && data.sizes.length > 0) {
          setSelectedSize(data.sizes[0]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error loading product");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadProduct();
    return () => {
      cancelled = true;
    };
  }, [catalogId]);

  // 2. Fetch Reviews
  useEffect(() => {
    let cancelled = false;
    async function loadReviews() {
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(catalogId)}/reviews`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data && Array.isArray(data.reviews)) {
          setReviews(data.reviews);
          setAverageRating(Number(data.averageRating) || 5.0);
        }
      } catch {
        // Silently handle review load errors
      }
    }
    void loadReviews();
    return () => {
      cancelled = true;
    };
  }, [catalogId]);

  // 3. Fetch Related Products
  useEffect(() => {
    let cancelled = false;
    async function loadRelated() {
      try {
        const res = await fetch("/api/products", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const all: DataStore[] = Array.isArray(data) ? data : [];
        const related = all
          .filter((p) => p.productID !== catalogId)
          .slice(0, 4);
        setRelatedProducts(related);
      } catch {
        // Ignore
      }
    }
    void loadRelated();
    return () => {
      cancelled = true;
    };
  }, [catalogId]);

  const handleAddToCart = async () => {
    if (!product) return;
    try {
      setAddingToCart(true);
      await dispatch(
        addToCartAsync({
          productID: product.productID,
          productName: product.productName,
          productPrice: product.productPrice,
          productReviews: product.productReviews || "",
          stockQuantity: product.stockQuantity,
        })
      ).unwrap();
      toast.success(`Added ${product.productName} to your cart!`);
    } catch {
      toast.error("Could not add to cart. Stock may be limited.");
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (!product) return;
    try {
      setBuyingNow(true);
      await dispatch(
        addToCartAsync({
          productID: product.productID,
          productName: product.productName,
          productPrice: product.productPrice,
          productReviews: product.productReviews || "",
          stockQuantity: product.stockQuantity,
        })
      ).unwrap();
      router.push("/cart");
    } catch {
      toast.error("Could not proceed to checkout.");
      setBuyingNow(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated()) {
      toast.error("Please log in to submit a review");
      router.push(`/login?returnTo=/shop/${encodeURIComponent(catalogId)}`);
      return;
    }
    if (!reviewComment.trim()) {
      toast.error("Please enter a review comment");
      return;
    }

    try {
      setSubmittingReview(true);
      const res = await fetch(`/api/products/${encodeURIComponent(catalogId)}/reviews`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to submit review");
      }
      toast.success("Review submitted successfully!");
      setReviewComment("");
      if (data && Array.isArray(data.reviews)) {
        setReviews(data.reviews);
        setAverageRating(Number(data.averageRating) || 5.0);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error submitting review");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: "4px solid #cbd5e1",
              borderTopColor: "#6366f1",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ color: "#64748b", fontSize: 15 }}>Loading product details...</p>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div
          style={{
            maxWidth: 500,
            textAlign: "center",
            background: "#fff",
            padding: "48px 32px",
            borderRadius: 16,
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 22, color: "#1e293b", marginBottom: 10 }}>Product Unavailable</h2>
          <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            {error || "This item is not currently available for public viewing or purchase."}
          </p>
          <Link
            href="/shop"
            style={{
              display: "inline-block",
              background: "#1e293b",
              color: "#fff",
              padding: "10px 24px",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Browse Other Products
          </Link>
        </div>
      </div>
    );
  }

  const galleryImages = [
    resolveImage(product.frontImg),
    ...(product.backImg ? [resolveImage(product.backImg)] : []),
  ];

  const sellerId = product.sellerUserId ? String(product.sellerUserId) : null;
  const supplierId = product.supplierUserId ? String(product.supplierUserId) : null;
  const shortSellerId = sellerId ? (sellerId.length > 8 ? sellerId.slice(0, 8) : sellerId) : null;
  const shortSupplierId = supplierId ? (supplierId.length > 8 ? supplierId.slice(0, 8) : supplierId) : null;

  const stock = product.stockQuantity ?? 25;
  const isOutOfStock = stock <= 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "32px 24px 80px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Navigation Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#64748b", marginBottom: 28 }}>
          <Link href="/shop" style={{ color: "#64748b", textDecoration: "none" }}>
            Shop
          </Link>
          <span>/</span>
          <span style={{ textTransform: "capitalize" }}>{product.category || "Catalog"}</span>
          <span>/</span>
          <span style={{ color: "#0f172a", fontWeight: 600 }}>{product.productName}</span>
        </div>

        {/* Product Overview Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 40,
            background: "#fff",
            padding: 36,
            borderRadius: 20,
            boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
            marginBottom: 40,
          }}
        >
          {/* Left Column: Gallery */}
          <div>
            <div
              style={{
                width: "100%",
                paddingTop: "100%",
                position: "relative",
                borderRadius: 14,
                overflow: "hidden",
                background: "#f1f5f9",
                marginBottom: 16,
              }}
            >
              <img
                src={selectedImage}
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
            </div>

            {/* Thumbnail selector */}
            <div style={{ display: "flex", gap: 12 }}>
              {galleryImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img)}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 8,
                    overflow: "hidden",
                    border: selectedImage === img ? "2px solid #6366f1" : "2px solid transparent",
                    padding: 0,
                    cursor: "pointer",
                    background: "#f1f5f9",
                  }}
                >
                  <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Product Info & Actions */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              {product.category || "Marketplace"}
            </div>

            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: "0 0 12px", lineHeight: 1.25 }}>
              {product.productName}
            </h1>

            {/* Rating summary */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <div style={{ display: "flex", color: "#f59e0b" }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s}>{s <= Math.round(averageRating) ? <FaStar size={14} /> : <FaRegStar size={14} />}</span>
                ))}
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                {averageRating.toFixed(1)}
              </span>
              <span style={{ fontSize: 14, color: "#64748b" }}>
                ({reviews.length} {reviews.length === 1 ? "review" : "reviews"})
              </span>
            </div>

            {/* Price section */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: "#0f172a" }}>
                ${product.productPrice}
              </span>
              {product.oldPrice && product.oldPrice > product.productPrice && (
                <span style={{ fontSize: 18, color: "#94a3b8", textDecoration: "line-through" }}>
                  ${product.oldPrice}
                </span>
              )}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: isOutOfStock ? "#fee2e2" : "#dcfce7",
                  color: isOutOfStock ? "#ef4444" : "#16a34a",
                }}
              >
                {isOutOfStock ? "Out of Stock" : `In Stock (${stock} available)`}
              </span>
            </div>

            {/* SELLER & SUPPLIER INFORMATION BOX */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
                marginBottom: 24,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "#e0e7ff",
                      color: "#4f46e5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                    }}
                  >
                    <FaStore />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                      Sold by
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                      {sellerId ? `Seller Store #${shortSellerId}` : "Official Platform Store"}
                    </div>
                  </div>
                </div>

                {sellerId && (
                  <Link
                    href={`/store/${encodeURIComponent(sellerId)}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#4f46e5",
                      background: "#fff",
                      border: "1px solid #c7d2fe",
                      padding: "6px 12px",
                      borderRadius: 8,
                      textDecoration: "none",
                    }}
                  >
                    Visit Store &rarr;
                  </Link>
                )}
              </div>

              {/* Supplier Identity Badge if available */}
              {supplierId && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: "1px dashed #cbd5e1",
                    fontSize: 12,
                    color: "#475569",
                  }}
                >
                  <FaTruckLoading style={{ color: "#0284c7" }} />
                  <span>
                    Supplied by: <strong>Supplier #{shortSupplierId}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Size Selector */}
            {product.sizes && product.sizes.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 8 }}>
                  Select Size
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {product.sizes.map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setSelectedSize(sz)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        border: selectedSize === sz ? "2px solid #0f172a" : "1px solid #cbd5e1",
                        background: selectedSize === sz ? "#0f172a" : "#fff",
                        color: selectedSize === sz ? "#fff" : "#334155",
                      }}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity Selector & Actions */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <button
                  disabled={quantity <= 1 || isOutOfStock}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  style={{
                    width: 38,
                    height: 42,
                    border: "none",
                    background: "#f8fafc",
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                >
                  -
                </button>
                <span style={{ width: 44, textAlign: "center", fontSize: 14, fontWeight: 600 }}>
                  {quantity}
                </span>
                <button
                  disabled={quantity >= stock || isOutOfStock}
                  onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
                  style={{
                    width: 38,
                    height: 42,
                    border: "none",
                    background: "#f8fafc",
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                >
                  +
                </button>
              </div>

              <button
                disabled={isOutOfStock || addingToCart}
                onClick={() => void handleAddToCart()}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  height: 42,
                  background: isOutOfStock ? "#cbd5e1" : "#1e293b",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isOutOfStock ? "not-allowed" : "pointer",
                }}
              >
                <FaCartPlus /> {addingToCart ? "Adding..." : "Add to Cart"}
              </button>

              <button
                disabled={isOutOfStock || buyingNow}
                onClick={() => void handleBuyNow()}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  height: 42,
                  background: isOutOfStock ? "#cbd5e1" : "#4f46e5",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isOutOfStock ? "not-allowed" : "pointer",
                }}
              >
                <FaBolt /> {buyingNow ? "Processing..." : "Buy Now"}
              </button>
            </div>

            {/* Highlights */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13, color: "#64748b" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FaShieldAlt style={{ color: "#10b981" }} /> 100% Genuine Guarantee
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FaCheckCircle style={{ color: "#6366f1" }} /> Fast Express Shipping
              </div>
            </div>
          </div>
        </div>

        {/* Customer Reviews Section */}
        <div
          style={{
            background: "#fff",
            padding: 36,
            borderRadius: 20,
            boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
            marginBottom: 40,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 }}>
              Customer Reviews ({reviews.length})
            </h2>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b", display: "flex", alignItems: "center", gap: 6 }}>
              <FaStar /> {averageRating.toFixed(1)} / 5.0
            </div>
          </div>

          {/* Add Review Form */}
          <form
            onSubmit={(e) => void handleSubmitReview(e)}
            style={{
              background: "#f8fafc",
              padding: 20,
              borderRadius: 12,
              marginBottom: 32,
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
              Write a Review
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>Your Rating:</span>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: star <= reviewRating ? "#f59e0b" : "#cbd5e1" }}
                  >
                    <FaStar size={18} />
                  </button>
                ))}
              </div>
            </div>

            <textarea
              placeholder="Share your experience with this product..."
              rows={3}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 14,
                fontFamily: "inherit",
                marginBottom: 12,
                outline: "none",
              }}
            />

            <button
              type="submit"
              disabled={submittingReview}
              style={{
                background: "#1e293b",
                color: "#fff",
                border: "none",
                padding: "8px 18px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {submittingReview ? "Submitting..." : "Submit Review"}
            </button>
          </form>

          {/* Review List */}
          {reviews.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>
              No reviews yet. Be the first customer to review this product!
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {reviews.map((r, i) => (
                <div
                  key={r.id || i}
                  style={{
                    paddingBottom: 16,
                    borderBottom: i < reviews.length - 1 ? "1px solid #f1f5f9" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: "#1e293b", fontSize: 14 }}>{r.author || "Verified Buyer"}</span>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}</span>
                  </div>
                  <div style={{ display: "flex", color: "#f59e0b", marginBottom: 8 }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s}>{s <= r.rating ? <FaStar size={12} /> : <FaRegStar size={12} />}</span>
                    ))}
                  </div>
                  <p style={{ margin: 0, color: "#475569", fontSize: 14, lineHeight: 1.5 }}>{r.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>
              You May Also Like
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
              {relatedProducts.map((rel) => (
                <div
                  key={rel.productID}
                  style={{
                    background: "#fff",
                    borderRadius: 14,
                    overflow: "hidden",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  <Link
                    href={`/shop/${encodeURIComponent(rel.productID)}`}
                    style={{ display: "block", position: "relative", paddingTop: "100%" }}
                  >
                    <img
                      src={resolveImage(rel.frontImg)}
                      alt={rel.productName}
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
                  <div style={{ padding: 14 }}>
                    <Link
                      href={`/shop/${encodeURIComponent(rel.productID)}`}
                      style={{
                        display: "block",
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#0f172a",
                        textDecoration: "none",
                        marginBottom: 6,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {rel.productName}
                    </Link>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                      ${rel.productPrice}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
