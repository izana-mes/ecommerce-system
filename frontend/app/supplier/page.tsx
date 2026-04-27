"use client";

import { CSSProperties, ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser, refreshCurrentUserFromServer, subscribeToAuthChanges } from "@/lib/auth";
import toast from "react-hot-toast";

type ProductFormState = {
  productID: string;
  productName: string;
  productPrice: string;
  productReviews: string;
  frontImg: string;
  backImg: string;
  stockQuantity: string;
  sizes: string;
  active: boolean;
};

type ProductChangeRequest = {
  id: string;
  actionType: "CREATE" | "UPDATE" | "DELETE" | "BULK_UPSERT";
  targetProductId?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewerNote?: string | null;
  createdAt?: string | null;
  reviewedAt?: string | null;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

const INITIAL_FORM: ProductFormState = {
  productID: "",
  productName: "",
  productPrice: "",
  productReviews: "",
  frontImg: "",
  backImg: "",
  stockQuantity: "",
  sizes: "",
  active: true,
};

export default function SupplierPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [form, setForm] = useState<ProductFormState>(INITIAL_FORM);
  const [requests, setRequests] = useState<ProductChangeRequest[]>([]);

  const syncUser = useCallback(async () => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/login?returnTo=/supplier");
      return;
    }
    const refreshed = await refreshCurrentUserFromServer();
    const nextUser = refreshed || currentUser;
    if (nextUser.role !== "supplier" && nextUser.role !== "admin") {
      router.replace("/profile");
      return;
    }
    setLoading(false);
  }, [router]);

  const fetchRequests = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setRequestsLoading(true);
    try {
      const response = await fetch("/api/products/change-requests/mine", {
        method: "GET",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to fetch requests");
      }
      setRequests(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch requests");
      setRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    void syncUser();
    return subscribeToAuthChanges(() => {
      void syncUser();
    });
  }, [syncUser]);

  useEffect(() => {
    if (!loading) {
      void fetchRequests();
    }
  }, [fetchRequests, loading]);

  const pendingCount = useMemo(
    () => requests.filter((item) => item.status === "PENDING").length,
    [requests]
  );

  const handleChange = (field: keyof ProductFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (
    field: "frontImg" | "backImg",
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      event.target.value = "";
      return;
    }

    try {
      if (field === "frontImg") setUploadingFront(true);
      if (field === "backImg") setUploadingBack(true);

      const imageDataUrl = await fileToDataUrl(file);
      setForm((prev) => ({ ...prev, [field]: imageDataUrl }));
      toast.success(`${field === "frontImg" ? "Front" : "Back"} image selected`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to read image");
    } finally {
      if (field === "frontImg") setUploadingFront(false);
      if (field === "backImg") setUploadingBack(false);
      event.target.value = "";
    }
  };

  const handleSubmit = async () => {
    const token = getToken();
    if (!token) {
      router.replace("/login?returnTo=/supplier");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/auth/admin-products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productID: form.productID.trim(),
          productName: form.productName.trim(),
          productPrice: Number(form.productPrice),
          productReviews: form.productReviews.trim(),
          frontImg: form.frontImg.trim(),
          backImg: form.backImg.trim(),
          stockQuantity: Number(form.stockQuantity),
          sizes: form.sizes
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          active: form.active,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to submit product");
      }
      toast.success(data?.message || "Product submission sent for admin approval");
      setForm(INITIAL_FORM);
      await fetchRequests();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to submit product");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "48px 16px", maxWidth: 1080, margin: "0 auto" }}>Loading supplier portal...</div>;
  }

  return (
    <div style={{ padding: "48px 16px", background: "#f6f7fb", minHeight: "70vh" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gap: 24 }}>
        <section style={{ background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)" }}>
          <h1 style={{ margin: 0, fontSize: 32 }}>Supplier portal</h1>
          <p style={{ marginTop: 10, color: "#475467" }}>
            Submit products for listing. Every submission stays pending until an admin approves it.
          </p>
          <p style={{ marginTop: 8, color: "#101828", fontWeight: 600 }}>
            Pending submissions: {pendingCount}
          </p>
        </section>

        <section style={{ background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)" }}>
          <h2 style={{ marginTop: 0 }}>Submit a product</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            <input value={form.productID} onChange={(event) => handleChange("productID", event.target.value)} placeholder="Product ID" style={inputStyle} />
            <input value={form.productName} onChange={(event) => handleChange("productName", event.target.value)} placeholder="Product name" style={inputStyle} />
            <input value={form.productPrice} onChange={(event) => handleChange("productPrice", event.target.value)} placeholder="Price" type="number" min="0" step="0.01" style={inputStyle} />
            <input value={form.stockQuantity} onChange={(event) => handleChange("stockQuantity", event.target.value)} placeholder="Stock quantity" type="number" min="0" style={inputStyle} />
            <input value={form.frontImg} onChange={(event) => handleChange("frontImg", event.target.value)} placeholder="Front image URL or data" style={inputStyle} />
            <div style={uploadFieldStyle}>
              <label style={uploadLabelStyle}>Choose front image from your computer</label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => void handleImageUpload("frontImg", event)}
                style={inputStyle}
              />
              <span style={uploadHintStyle}>{uploadingFront ? "Reading image..." : "Supports JPG, PNG, WEBP and similar image files."}</span>
            </div>
            <input value={form.backImg} onChange={(event) => handleChange("backImg", event.target.value)} placeholder="Back image URL or data" style={inputStyle} />
            <div style={uploadFieldStyle}>
              <label style={uploadLabelStyle}>Choose back image from your computer</label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => void handleImageUpload("backImg", event)}
                style={inputStyle}
              />
              <span style={uploadHintStyle}>{uploadingBack ? "Reading image..." : "Supports JPG, PNG, WEBP and similar image files."}</span>
            </div>
            <input value={form.sizes} onChange={(event) => handleChange("sizes", event.target.value)} placeholder="Sizes, comma separated" style={inputStyle} />
          </div>
          {(form.frontImg || form.backImg) ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 14 }}>
              {form.frontImg ? (
                <div style={previewCardStyle}>
                  <strong style={{ fontSize: 14 }}>Front preview</strong>
                  <img src={form.frontImg} alt="Front preview" style={previewImageStyle} />
                </div>
              ) : null}
              {form.backImg ? (
                <div style={previewCardStyle}>
                  <strong style={{ fontSize: 14 }}>Back preview</strong>
                  <img src={form.backImg} alt="Back preview" style={previewImageStyle} />
                </div>
              ) : null}
            </div>
          ) : null}
          <textarea
            value={form.productReviews}
            onChange={(event) => handleChange("productReviews", event.target.value)}
            placeholder="Short description or product review summary"
            rows={5}
            style={{ ...inputStyle, marginTop: 14, resize: "vertical" }}
          />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 14, color: "#344054" }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => handleChange("active", event.target.checked)}
            />
            Mark product as active when approved
          </label>
          <div style={{ marginTop: 18 }}>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving}
              style={{ border: "none", borderRadius: 999, padding: "12px 18px", background: "#101828", color: "#fff", fontWeight: 700, cursor: "pointer" }}
            >
              {saving ? "Submitting..." : "Submit for approval"}
            </button>
          </div>
        </section>

        <section style={{ background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Submission history</h2>
            <button
              type="button"
              onClick={() => void fetchRequests()}
              disabled={requestsLoading}
              style={{ border: "1px solid rgba(16, 24, 40, 0.12)", borderRadius: 999, padding: "10px 16px", background: "#fff", cursor: "pointer" }}
            >
              {requestsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <div style={{ overflowX: "auto", marginTop: 18 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={cellHead}>Action</th>
                  <th style={cellHead}>Product</th>
                  <th style={cellHead}>Status</th>
                  <th style={cellHead}>Created</th>
                  <th style={cellHead}>Admin note</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={cellEmpty}>No submissions yet.</td>
                  </tr>
                ) : (
                  requests.map((item) => (
                    <tr key={item.id}>
                      <td style={cellBody}>{item.actionType}</td>
                      <td style={cellBody}>{item.targetProductId || "-"}</td>
                      <td style={cellBody}>{item.status}</td>
                      <td style={cellBody}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}</td>
                      <td style={cellBody}>{item.reviewerNote || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid rgba(16, 24, 40, 0.12)",
  borderRadius: 12,
  padding: "12px 14px",
  background: "#fff",
  color: "#101828",
};

const uploadFieldStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const uploadLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#344054",
};

const uploadHintStyle: CSSProperties = {
  fontSize: 12,
  color: "#667085",
};

const previewCardStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 14,
  border: "1px solid rgba(16, 24, 40, 0.08)",
  borderRadius: 16,
  background: "#fcfcfd",
};

const previewImageStyle: CSSProperties = {
  width: "100%",
  maxHeight: 260,
  objectFit: "contain",
  borderRadius: 12,
  background: "#fff",
  border: "1px solid rgba(16, 24, 40, 0.08)",
};

const cellHead: CSSProperties = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid rgba(16, 24, 40, 0.08)",
  color: "#475467",
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const cellBody: CSSProperties = {
  padding: "14px 10px",
  borderBottom: "1px solid rgba(16, 24, 40, 0.08)",
  color: "#101828",
};

const cellEmpty: CSSProperties = {
  padding: "20px 10px",
  textAlign: "center",
  color: "#667085",
};
