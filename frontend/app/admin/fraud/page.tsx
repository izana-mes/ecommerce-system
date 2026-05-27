"use client";

import { type CSSProperties, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

type FraudAssessment = {
  orderId: number;
  orderNumber: string;
  customerEmail: string;
  paymentMethod: string;
  currency: string;
  totalAmount: number;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | string;
  manualReviewRequired: boolean;
  riskReasons: string;
  reviewStatus: "pending" | "approved" | "rejected" | string;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  assessedAt: string | null;
  updatedAt: string | null;
};

type FraudPageResponse = {
  data?: {
    content?: FraudAssessment[];
    totalElements?: number;
    totalPages?: number;
    number?: number;
    size?: number;
    unavailable?: boolean;
  };
  message?: string;
  success?: boolean;
};

const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;

export default function AdminFraudPage() {
  const [items, setItems] = useState<FraudAssessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingOrderId, setSubmittingOrderId] = useState<number | null>(null);

  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  const [riskLevel, setRiskLevel] = useState("");
  const [manualReviewRequired, setManualReviewRequired] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [draftReviewStatus, setDraftReviewStatus] = useState<Record<number, string>>({});
  const [draftReviewNote, setDraftReviewNote] = useState<Record<number, string>>({});

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        size: String(size),
      });
      if (riskLevel) query.set("riskLevel", riskLevel);
      if (manualReviewRequired) query.set("manualReviewRequired", manualReviewRequired);
      if (orderNumber.trim()) query.set("orderNumber", orderNumber.trim());
      if (customerEmail.trim()) query.set("customerEmail", customerEmail.trim());

      const response = await fetch(`/api/auth/admin-fraud-assessments?${query.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as FraudPageResponse;

      if (!response.ok) {
        throw new Error(payload?.message || "Failed to fetch fraud assessments");
      }

      const data = payload?.data;
      const content = Array.isArray(data?.content) ? data.content : [];
      setItems(content);
      setTotalElements(Number(data?.totalElements ?? 0));
      setTotalPages(Math.max(1, Number(data?.totalPages ?? 1)));

      if (data?.unavailable) {
        toast.error("Fraud table is unavailable. Run backend migrations.");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load fraud assessments";
      toast.error(message);
      setItems([]);
      setTotalElements(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, size, riskLevel, manualReviewRequired, orderNumber, customerEmail]);

  useEffect(() => {
    void fetchAssessments();
  }, [fetchAssessments]);

  const onFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(0);
    void fetchAssessments();
  };

  const onReview = async (orderId: number) => {
    const status = (draftReviewStatus[orderId] || "").trim();
    const note = draftReviewNote[orderId] || "";
    if (!status) {
      toast.error("Select review status first");
      return;
    }

    setSubmittingOrderId(orderId);
    try {
      const response = await fetch(`/api/auth/admin-fraud-assessments/${orderId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: status, reviewNote: note }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Failed to review assessment");
      }

      toast.success("Fraud assessment updated");
      await fetchAssessments();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to review assessment";
      toast.error(message);
    } finally {
      setSubmittingOrderId(null);
    }
  };

  const paginationLabel = useMemo(() => {
    const from = totalElements === 0 ? 0 : page * size + 1;
    const to = Math.min((page + 1) * size, totalElements);
    return `${from}-${to} of ${totalElements}`;
  }, [page, size, totalElements]);

  return (
    <main style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>Fraud Assessments</h1>
          <p style={{ margin: "6px 0 0", color: "#555" }}>Review and triage high-risk orders.</p>
        </div>
        <Link href="/admin" style={{ color: "#2563eb", textDecoration: "underline" }}>
          Back to Admin
        </Link>
      </div>

      <form onSubmit={onFilterSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8, marginBottom: 16 }}>
        <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
          <option value="">All Risk Levels</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <select value={manualReviewRequired} onChange={(e) => setManualReviewRequired(e.target.value)}>
          <option value="">Manual Review: Any</option>
          <option value="true">Manual Review: Yes</option>
          <option value="false">Manual Review: No</option>
        </select>

        <input
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="Order number"
        />

        <input
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          placeholder="Customer email"
        />

        <button type="submit">Apply Filters</button>
      </form>

      <div style={{ marginBottom: 12, color: "#444" }}>
        {loading ? "Loading..." : `Showing ${paginationLabel}`}
      </div>

      <div style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1150 }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={th}>Order</th>
              <th style={th}>Customer</th>
              <th style={th}>Amount</th>
              <th style={th}>Risk</th>
              <th style={th}>Reasons</th>
              <th style={th}>Review</th>
              <th style={th}>Assessed</th>
              <th style={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.orderId}>
                <td style={td}>
                  <div>{item.orderNumber}</div>
                  <div style={{ color: "#666", fontSize: 12 }}>#{item.orderId}</div>
                </td>
                <td style={td}>{item.customerEmail || "-"}</td>
                <td style={td}>{item.currency} {Number(item.totalAmount || 0).toFixed(2)}</td>
                <td style={td}>
                  <strong>{item.riskLevel.toUpperCase()}</strong>
                  <div style={{ color: "#666", fontSize: 12 }}>score {item.riskScore}</div>
                </td>
                <td style={td}>{item.riskReasons || "none"}</td>
                <td style={td}>
                  <div style={{ marginBottom: 6 }}>
                    current: <strong>{item.reviewStatus || "pending"}</strong>
                  </div>
                  <select
                    value={draftReviewStatus[item.orderId] ?? item.reviewStatus ?? "pending"}
                    onChange={(e) =>
                      setDraftReviewStatus((prev) => ({ ...prev, [item.orderId]: e.target.value }))
                    }
                  >
                    {REVIEW_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <textarea
                    value={draftReviewNote[item.orderId] ?? item.reviewNote ?? ""}
                    onChange={(e) =>
                      setDraftReviewNote((prev) => ({ ...prev, [item.orderId]: e.target.value }))
                    }
                    rows={2}
                    style={{ width: "100%", marginTop: 6 }}
                    placeholder="Review note"
                  />
                </td>
                <td style={td}>{item.assessedAt || "-"}</td>
                <td style={td}>
                  <button
                    onClick={() => void onReview(item.orderId)}
                    disabled={submittingOrderId === item.orderId}
                  >
                    {submittingOrderId === item.orderId ? "Saving..." : "Save"}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 ? (
              <tr>
                <td style={td} colSpan={8}>No fraud assessments found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
        <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0 || loading}>
          Previous
        </button>
        <span>Page {page + 1} / {totalPages}</span>
        <button onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))} disabled={page + 1 >= totalPages || loading}>
          Next
        </button>
      </div>
    </main>
  );
}

const th: CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "1px solid #ddd",
  fontSize: 13,
};

const td: CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #eee",
  verticalAlign: "top",
  fontSize: 14,
};
