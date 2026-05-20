"use client";

import { useCallback, useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import toast from "react-hot-toast";
import { CSSProperties } from "react";

type ProductSummary = { productId: string; productName: string };

type Review = {
  id: string;
  author: string;
  rating: number;
  content: string;
  createdAt: string;
  replies?: { id: string; content: string }[];
};

type ReviewSummary = {
  productID: string;
  averageRating: number;
  reviewCount: number;
  reviews: Review[];
};

export default function SellerReviewsPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  const loadProducts = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/v1/seller/inventory", {
        headers: { }});
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load products");
      const items: ProductSummary[] = data.data || [];
      setProducts(items);
      if (items.length > 0) setSelectedProductId(items[0].productId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const loadReviews = useCallback(async (productId: string) => {
    if (!productId) return;
    const token = getToken();
    if (!token) return;
    setLoadingReviews(true);
    setReviewsError(null);
    setSummary(null);
    try {
      const res = await fetch(`/api/v1/seller/reviews/${productId}?limit=50`, {
        headers: { }});
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Failed to load reviews");
      }
    } catch (err: unknown) {
      setReviewsError(err instanceof Error ? err.message : "Failed to load reviews");
    } finally {
      setLoadingReviews(false);
    }
  }, []);

  useEffect(() => { void loadProducts(); }, [loadProducts]);
  useEffect(() => {
    if (selectedProductId) void loadReviews(selectedProductId);
  }, [loadReviews, selectedProductId]);

  const handleReply = async (reviewId: string) => {
    if (!replyContent.trim()) { toast.error("Reply cannot be empty"); return; }
    const token = getToken();
    if (!token) return;
    setSubmittingReply(true);
    try {
      const res = await fetch(
        `/api/v1/seller/reviews/${selectedProductId}/${reviewId}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json"},
          body: JSON.stringify({ content: replyContent })}
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Failed to post reply");
      }
      const updated = await res.json();
      setSummary(updated);
      setReplyingTo(null);
      setReplyContent("");
      toast.success("Reply posted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to post reply");
    } finally {
      setSubmittingReply(false);
    }
  };

  if (loadingProducts) {
    return (
      <div style={containerStyle}>
        <div style={{ height: 52, background: "#e2e8f0", borderRadius: 12, marginBottom: 24 }} />
        <div style={{ height: 56, background: "#e2e8f0", borderRadius: 10, marginBottom: 24 }} />
        <div style={{ display: "grid", gap: 16 }}>
          {[1, 2, 3].map((i) => <div key={i} style={{ height: 140, background: "#e2e8f0", borderRadius: 12 }} />)}
        </div>
      </div>
    );
  }

  const stars = (rating: number) =>
    "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));

  return (
    <div style={containerStyle}>
      <div style={pageHeaderStyle}>
        <div>
          <h1 style={titleStyle}>Product Reviews</h1>
          <p style={subtitleStyle}>Read customer feedback and respond to reviews</p>
        </div>
      </div>

      {/* Product selector */}
      {products.length === 0 ? (
        <div style={emptyBoxStyle}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No products found</div>
          <div style={{ color: "#94a3b8", fontSize: 14 }}>You have no products linked to your account yet.</div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontWeight: 600, color: "#374151", marginBottom: 8, fontSize: 14 }}>
              Select product
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              style={selectStyle}
            >
              {products.map((p) => (
                <option key={p.productId} value={p.productId}>
                  {p.productName} ({p.productId})
                </option>
              ))}
            </select>
          </div>

          {/* Reviews area */}
          {loadingReviews ? (
            <div style={{ display: "grid", gap: 16 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: 140, background: "#e2e8f0", borderRadius: 12, animation: "pulse 1.5s infinite" }} />
              ))}
            </div>
          ) : reviewsError ? (
            <div style={{ ...emptyBoxStyle, border: "1px solid #fecaca", background: "#fff5f5" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
              <div style={{ fontWeight: 600, color: "#991b1b", marginBottom: 4 }}>Failed to load reviews</div>
              <div style={{ color: "#b91c1c", fontSize: 14, marginBottom: 16 }}>{reviewsError}</div>
              <button
                type="button"
                onClick={() => void loadReviews(selectedProductId)}
                style={{ background: "#991b1b", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 600, cursor: "pointer" }}
              >
                Try Again
              </button>
            </div>
          ) : summary ? (
            <div>
              {/* Rating summary card */}
              <div style={ratingCardStyle}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 52, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>
                    {summary.averageRating.toFixed(1)}
                  </div>
                  <div style={{ color: "#f59e0b", fontSize: 22, margin: "4px 0" }}>
                    {stars(summary.averageRating)}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 14 }}>
                    Based on {summary.reviewCount} review{summary.reviewCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              {/* Review list */}
              {summary.reviews?.length === 0 ? (
                <div style={emptyBoxStyle}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                  <div style={{ fontWeight: 600 }}>No reviews yet</div>
                  <div style={{ color: "#94a3b8", fontSize: 14, marginTop: 4 }}>
                    Customers haven&apos;t reviewed this product yet
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 16 }}>
                  {summary.reviews?.map((review) => (
                    <div key={review.id} style={reviewCardStyle}>
                      {/* Review header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{review.author}</div>
                          <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                            {new Date(review.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div style={{ color: "#f59e0b", fontSize: 18, letterSpacing: 1 }}>
                          {stars(review.rating)}
                        </div>
                      </div>

                      {/* Review body */}
                      <div style={{ fontSize: 15, color: "#374151", lineHeight: 1.6, marginBottom: 14 }}>
                        {review.content}
                      </div>

                      {/* Existing replies */}
                      {review.replies && review.replies.length > 0 && (
                        <div style={replyThreadStyle}>
                          {review.replies.map((reply) => (
                            <div key={reply.id} style={replyBubbleStyle}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                🏪 Your Reply
                              </div>
                              <div style={{ fontSize: 14, color: "#374151" }}>{reply.content}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply form — always available */}
                      {replyingTo === review.id ? (
                        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                          <textarea
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder="Type your reply to the customer…"
                            rows={3}
                            style={textareaStyle}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => void handleReply(review.id)}
                              disabled={submittingReply}
                              style={{ background: "#6366f1", color: "#fff", padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                            >
                              {submittingReply ? "Posting…" : "Submit Reply"}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setReplyingTo(null); setReplyContent(""); }}
                              style={{ background: "#f1f5f9", color: "#475569", padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setReplyingTo(review.id); setReplyContent(""); }}
                          style={{ background: "transparent", color: "#6366f1", padding: "7px 14px", borderRadius: 8, border: "1px solid #c7d2fe", cursor: "pointer", fontSize: 13, fontWeight: 600, marginTop: 10 }}
                        >
                          {review.replies && review.replies.length > 0 ? "✎ Edit / Add Reply" : "↩ Reply to Customer"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={emptyBoxStyle}>Select a product to view its reviews.</div>
          )}
        </>
      )}
    </div>
  );
}

const containerStyle: CSSProperties = { padding: "36px 32px", maxWidth: 900, margin: "0 auto" };
const pageHeaderStyle: CSSProperties = { marginBottom: 28 };
const titleStyle: CSSProperties = { margin: 0, fontSize: 28, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" };
const subtitleStyle: CSSProperties = { margin: "6px 0 0", color: "#64748b", fontSize: 14 };
const selectStyle: CSSProperties = { width: "100%", maxWidth: 440, padding: "11px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 500, color: "#0f172a", background: "#fff" };
const emptyBoxStyle: CSSProperties = { padding: "48px 24px", textAlign: "center", background: "#fff", borderRadius: 16, border: "1px dashed #e2e8f0", color: "#64748b" };
const ratingCardStyle: CSSProperties = { background: "#fff", borderRadius: 16, padding: "28px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)", border: "1px solid #e2e8f0", marginBottom: 20 };
const reviewCardStyle: CSSProperties = { background: "#fff", padding: "20px 24px", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(15,23,42,0.04)" };
const replyThreadStyle: CSSProperties = { borderLeft: "3px solid #c7d2fe", paddingLeft: 16, marginTop: 12 };
const replyBubbleStyle: CSSProperties = { background: "#f5f3ff", padding: "12px 14px", borderRadius: 10, marginBottom: 8 };
const textareaStyle: CSSProperties = { width: "100%", padding: "12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" };
