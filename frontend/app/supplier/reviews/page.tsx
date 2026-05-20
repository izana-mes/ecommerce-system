"use client";

import { useCallback, useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import toast from "react-hot-toast";
import { CSSProperties } from "react";

type ProductSummary = {
  productId: string;
  productName: string;
};

type ReviewSummary = {
  productID: string;
  averageRating: number;
  reviewCount: number;
  reviews: any[];
};

export default function SupplierReviewsPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState<string>("");

  const loadProducts = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch("/api/v1/supplier/inventory", {
        headers: { }});
      const res = await response.json();
      if (!response.ok) throw new Error(res?.message || "Failed to load products");
      setProducts(res.data || []);
      if (res.data && res.data.length > 0) {
        setSelectedProductId(res.data[0].productId);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReviews = useCallback(async () => {
    if (!selectedProductId) return;
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/supplier/reviews/${selectedProductId}?limit=50`, {
        headers: { }});
      if (response.ok) {
        const res = await response.json();
        setSummary(res); // Doesn't use standard ApiResponse wrapper in backend ProductReviewSummaryDto
      } else {
        const res = await response.json().catch(() => ({}));
        throw new Error(res?.message || "Failed to load reviews");
      }
    } catch (e: any) {
      toast.error(e.message);
      setSummary(null);
    }
  }, [selectedProductId]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const handleReply = async (reviewId: string) => {
    if (!replyContent.trim()) {
      toast.error("Reply content cannot be empty");
      return;
    }
    
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/supplier/reviews/${selectedProductId}/${reviewId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({ content: replyContent })});
      
      if (!response.ok) {
        const res = await response.json().catch(() => ({}));
        throw new Error(res?.message || "Failed to post reply");
      }
      
      const newSummary = await response.json();
      setSummary(newSummary);
      setReplyingTo(null);
      setReplyContent("");
      toast.success("Reply posted successfully");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) return <div style={containerStyle}>Loading reviews workspace...</div>;

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Product Reviews</h1>
      
      <div style={{ marginBottom: 24 }}>
        <select 
          value={selectedProductId} 
          onChange={(e) => setSelectedProductId(e.target.value)}
          style={selectStyle}
        >
          {products.map(p => (
            <option key={p.productId} value={p.productId}>{p.productName} ({p.productId})</option>
          ))}
        </select>
      </div>

      {summary ? (
        <div style={contentGrid}>
          <div style={summaryCard}>
            <div style={ratingLabel}>Average Rating</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <div style={ratingValue}>{summary.averageRating.toFixed(1)}</div>
              <div style={{ color: "#f59e0b", fontSize: 24 }}>★</div>
            </div>
            <div style={mutedStyle}>Based on {summary.reviewCount} customer reviews</div>
          </div>

          <div style={listContainer}>
            {summary.reviews?.length === 0 ? (
              <div style={emptyState}>No reviews yet for this product.</div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {summary.reviews?.map((review: any) => (
                  <div key={review.id} style={reviewCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <strong style={{ fontSize: 15 }}>{review.author}</strong>
                      <div style={{ color: "#f59e0b" }}>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</div>
                    </div>
                    <div style={{ fontSize: 15, color: "#374151", marginBottom: 12 }}>{review.content}</div>
                    <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
                      {new Date(review.createdAt).toLocaleString()}
                    </div>
                    
                    {review.replies && review.replies.length > 0 ? (
                      <div style={replyBoxWrapper}>
                        {review.replies.map((reply: any) => (
                          <div key={reply.id} style={replyBox}>
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: "#111827" }}>Reply from Seller:</div>
                            <div style={{ fontSize: 14 }}>{reply.content}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      replyingTo === review.id ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          <textarea 
                            value={replyContent} 
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder="Type your reply to the customer..."
                            rows={3}
                            style={textareaStyle}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => handleReply(review.id)} style={buttonPrimary}>Submit Reply</button>
                            <button onClick={() => setReplyingTo(null)} style={buttonSecondary}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setReplyingTo(review.id)} style={buttonOutline}>Reply to Customer</button>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={emptyState}>Select a product to view reviews.</div>
      )}
    </div>
  );
}

const containerStyle: CSSProperties = { padding: "40px", maxWidth: 1200, margin: "0 auto", animation: "pageIn 400ms ease" };
const titleStyle: CSSProperties = { margin: "0 0 24px", fontSize: 28 };
const selectStyle: CSSProperties = { width: "100%", maxWidth: 400, padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15 };
const contentGrid: CSSProperties = { display: "grid", gridTemplateColumns: "1fr", gap: 24 };
const summaryCard: CSSProperties = { background: "#fff", padding: 24, borderRadius: 16, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" };
const ratingLabel: CSSProperties = { color: "#6b7280", fontSize: 14, fontWeight: 500 };
const ratingValue: CSSProperties = { color: "#111827", fontSize: 48, fontWeight: 700 };
const mutedStyle: CSSProperties = { color: "#6b7280", fontSize: 14, marginTop: 4 };
const listContainer: CSSProperties = { borderRadius: 16 };
const reviewCard: CSSProperties = { background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e5e7eb" };
const emptyState: CSSProperties = { padding: 40, textAlign: "center", background: "#fff", borderRadius: 12, border: "1px dashed #d1d5db", color: "#6b7280" };
const replyBoxWrapper: CSSProperties = { borderLeft: "3px solid #d1d5db", paddingLeft: 16, marginTop: 12 };
const replyBox: CSSProperties = { background: "#f3f4f6", padding: 12, borderRadius: 8, marginTop: 8 };
const textareaStyle: CSSProperties = { width: "100%", padding: 12, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, resize: "vertical" };
const buttonPrimary: CSSProperties = { background: "#101828", color: "#fff", padding: "8px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 };
const buttonSecondary: CSSProperties = { background: "#f3f4f6", color: "#374151", padding: "8px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 };
const buttonOutline: CSSProperties = { background: "transparent", color: "#101828", padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", cursor: "pointer", fontSize: 13, fontWeight: 500 };
