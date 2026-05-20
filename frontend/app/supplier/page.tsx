"use client";

import { CSSProperties, ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {getUser, refreshCurrentUserFromServer, subscribeToAuthChanges } from "@/lib/auth";
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

type SupplierCatalogProduct = {
  productID: string;
  productName: string;
  productPrice?: number | null;
  productReviews?: string | null;
  frontImg?: string | null;
  backImg?: string | null;
  stockQuantity?: number | null;
  sizes?: string[] | null;
  active?: boolean | null;
};

type ProductRequestPayload = {
  productID?: string;
  productName?: string;
  productPrice?: number | null;
  productReviews?: string | null;
  frontImg?: string | null;
  backImg?: string | null;
  stockQuantity?: number | null;
  sizes?: string[] | null;
  active?: boolean | null;
};

type ProductChangeRequest = {
  id: string;
  actionType: "CREATE" | "UPDATE" | "DELETE" | "BULK_UPSERT";
  targetProductId?: string | null;
  requestPayload?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewerNote?: string | null;
  createdAt?: string | null;
  reviewedAt?: string | null;
};

type FormMode = "create" | "update";
type RequestStatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

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
  active: true};

function normalizeFormState(source?: ProductRequestPayload | SupplierCatalogProduct | null): ProductFormState {
  return {
    productID: String(source?.productID || ""),
    productName: String(source?.productName || ""),
    productPrice: source?.productPrice === null || source?.productPrice === undefined ? "" : String(source.productPrice),
    productReviews: String(source?.productReviews || ""),
    frontImg: String(source?.frontImg || ""),
    backImg: String(source?.backImg || ""),
    stockQuantity:
      source?.stockQuantity === null || source?.stockQuantity === undefined ? "" : String(source.stockQuantity),
    sizes: Array.isArray(source?.sizes) ? source.sizes.join(", ") : "",
    active: source?.active !== false};
}

function parseRequestPayload(request: ProductChangeRequest): ProductRequestPayload | null {
  if (!request.requestPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(request.requestPayload) as ProductRequestPayload | ProductRequestPayload[];
    return Array.isArray(parsed) ? parsed[0] || null : parsed;
  } catch {
    return null;
  }
}

export default function SupplierPage() {
  const router = useRouter();
  const token = getUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [deleteSubmittingId, setDeleteSubmittingId] = useState<string | null>(null);
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [form, setForm] = useState<ProductFormState>(INITIAL_FORM);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [historyFilter, setHistoryFilter] = useState<RequestStatusFilter>("ALL");
  const [catalog, setCatalog] = useState<SupplierCatalogProduct[]>([]);
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
    if (!token) return;

    setRequestsLoading(true);
    try {
      const response = await fetch("/api/products/change-requests/mine", {
        method: "GET",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json"}});
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

  const fetchCatalog = useCallback(async (query?: string) => {
    if (!token) return;

    setCatalogLoading(true);
    try {
      const search = (query ?? catalogQuery).trim();
      const endpoint = search
        ? `/api/auth/admin-products?q=${encodeURIComponent(search)}`
        : "/api/auth/admin-products";
      const response = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json"}});
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to fetch catalog");
      }
      setCatalog(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch catalog");
      setCatalog([]);
    } finally {
      setCatalogLoading(false);
    }
  }, [catalogQuery]);

  useEffect(() => {
    void syncUser();
    return subscribeToAuthChanges(() => {
      void syncUser();
    });
  }, [syncUser]);

  useEffect(() => {
    if (!loading) {
      void fetchRequests();
      void fetchCatalog("");
    }
  }, [fetchCatalog, fetchRequests, loading]);

  const pendingCount = useMemo(
    () => requests.filter((item) => item.status === "PENDING").length,
    [requests]
  );

  const filteredRequests = useMemo(() => {
    if (historyFilter === "ALL") return requests;
    return requests.filter((item) => item.status === historyFilter);
  }, [historyFilter, requests]);

  const latestRejectedRequest = useMemo(
    () => requests.find((item) => item.status === "REJECTED" && item.actionType !== "BULK_UPSERT") || null,
    [requests]
  );

  const handleChange = (field: keyof ProductFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetComposer = () => {
    setForm(INITIAL_FORM);
    setFormMode("create");
  };

  const loadIntoComposer = (
    source: SupplierCatalogProduct | ProductRequestPayload | null | undefined,
    mode: FormMode
  ) => {
    setForm(normalizeFormState(source));
    setFormMode(mode);
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

  const submitProductRequest = async () => {
    if (!token) {
      router.replace("/login?returnTo=/supplier");
      return;
    }

    setSaving(true);
    try {
      const method = formMode === "create" ? "POST" : "PUT";
      const response = await fetch("/api/auth/admin-products", {
        method,
        headers: {
          "Content-Type": "application/json"},
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
          active: form.active})});
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Failed to ${formMode === "create" ? "submit" : "update"} product`
        );
      }
      toast.success(
        data?.message ||
          (formMode === "create"
            ? "Product submission sent for admin approval"
            : "Product update request sent for admin approval")
      );
      resetComposer();
      await Promise.all([fetchRequests(), fetchCatalog(catalogQuery)]);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${formMode === "create" ? "submit" : "update"} product`
      );
    } finally {
      setSaving(false);
    }
  };

  const submitDeleteRequest = async (productID: string) => {
    if (!token) {
      router.replace("/login?returnTo=/supplier");
      return;
    }

    setDeleteSubmittingId(productID);
    try {
      const response = await fetch("/api/auth/admin-products", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({ productID })});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to submit delete request");
      }
      toast.success(data?.message || `Delete request submitted for ${productID}`);
      await fetchRequests();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to submit delete request");
    } finally {
      setDeleteSubmittingId(null);
    }
  };

  if (loading) {
    return <div style={{ padding: "48px 16px", maxWidth: 1080, margin: "0 auto" }}>Loading supplier portal...</div>;
  }

  return (
    <div style={{ padding: "48px 16px", background: "#f6f7fb", minHeight: "70vh" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gap: 24 }}>
        <section style={panelStyle}>
          <h1 style={{ margin: 0, fontSize: 32 }}>Supplier workspace</h1>
          <p style={{ marginTop: 10, color: "#475467" }}>
            Submit new products, propose catalog updates, and track approval outcomes in one place.
          </p>
          <div style={summaryGridStyle}>
            <article style={summaryCardStyle}>
              <strong style={summaryValueStyle}>{pendingCount}</strong>
              <span style={summaryLabelStyle}>Pending requests</span>
            </article>
            <article style={summaryCardStyle}>
              <strong style={summaryValueStyle}>{catalog.length}</strong>
              <span style={summaryLabelStyle}>Catalog items loaded</span>
            </article>
            <article style={summaryCardStyle}>
              <strong style={summaryValueStyle}>{latestRejectedRequest ? "1" : "0"}</strong>
              <span style={summaryLabelStyle}>Rejected request ready to revise</span>
            </article>
          </div>
        </section>

        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={{ margin: 0 }}>
                {formMode === "create" ? "Submit a new product" : `Submit an update for ${form.productID || "selected product"}`}
              </h2>
              <p style={sectionSubtleTextStyle}>
                {formMode === "create"
                  ? "Create a new product listing proposal."
                  : "Loaded from catalog or request history. Your changes will go through approval."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={resetComposer}
                style={secondaryButtonStyle}
              >
                New submission
              </button>
              {latestRejectedRequest ? (
                <button
                  type="button"
                  onClick={() => loadIntoComposer(parseRequestPayload(latestRejectedRequest), latestRejectedRequest.actionType === "CREATE" ? "create" : "update")}
                  style={secondaryButtonStyle}
                >
                  Revise latest rejection
                </button>
              ) : null}
            </div>
          </div>

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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.frontImg} alt="Front preview" style={previewImageStyle} />
                </div>
              ) : null}
              {form.backImg ? (
                <div style={previewCardStyle}>
                  <strong style={{ fontSize: 14 }}>Back preview</strong>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
          <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void submitProductRequest()}
              disabled={saving}
              style={primaryButtonStyle}
            >
              {saving
                ? formMode === "create"
                  ? "Submitting..."
                  : "Sending update..."
                : formMode === "create"
                  ? "Submit for approval"
                  : "Submit update request"}
            </button>
            {formMode === "update" ? (
              <button type="button" onClick={resetComposer} style={secondaryButtonStyle}>
                Cancel editing
              </button>
            ) : null}
          </div>
        </section>

        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={{ margin: 0 }}>Catalog workspace</h2>
              <p style={sectionSubtleTextStyle}>
                Search the current catalog, load a product into the composer, or submit a delete request.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchCatalog(catalogQuery)}
              disabled={catalogLoading}
              style={secondaryButtonStyle}
            >
              {catalogLoading ? "Refreshing..." : "Refresh catalog"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            <input
              value={catalogQuery}
              onChange={(event) => setCatalogQuery(event.target.value)}
              placeholder="Search product name or ID"
              style={{ ...inputStyle, maxWidth: 380 }}
            />
            <button type="button" onClick={() => void fetchCatalog(catalogQuery)} style={secondaryButtonStyle}>
              Search
            </button>
            {catalogQuery ? (
              <button
                type="button"
                onClick={() => {
                  setCatalogQuery("");
                  void fetchCatalog("");
                }}
                style={secondaryButtonStyle}
              >
                Clear
              </button>
            ) : null}
          </div>

          <div style={{ overflowX: "auto", marginTop: 18 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={cellHead}>Product</th>
                  <th style={cellHead}>Price</th>
                  <th style={cellHead}>Stock</th>
                  <th style={cellHead}>Status</th>
                  <th style={cellHead}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {catalog.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={cellEmpty}>
                      {catalogLoading ? "Loading catalog..." : "No products found."}
                    </td>
                  </tr>
                ) : (
                  catalog.map((product) => (
                    <tr key={product.productID}>
                      <td style={cellBody}>
                        <div style={{ display: "grid", gap: 2 }}>
                          <strong>{product.productName || product.productID}</strong>
                          <span style={mutedTextStyle}>{product.productID}</span>
                        </div>
                      </td>
                      <td style={cellBody}>
                        {typeof product.productPrice === "number" ? product.productPrice.toLocaleString() : "-"}
                      </td>
                      <td style={cellBody}>
                        {typeof product.stockQuantity === "number" ? product.stockQuantity : "-"}
                      </td>
                      <td style={cellBody}>{product.active === false ? "Inactive" : "Active"}</td>
                      <td style={cellBody}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => loadIntoComposer(product, "update")}
                            style={tableActionButtonStyle}
                          >
                            Edit request
                          </button>
                          <button
                            type="button"
                            onClick={() => void submitDeleteRequest(product.productID)}
                            disabled={deleteSubmittingId === product.productID}
                            style={dangerButtonStyle}
                          >
                            {deleteSubmittingId === product.productID ? "Sending..." : "Delete request"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={{ margin: 0 }}>Submission history</h2>
              <p style={sectionSubtleTextStyle}>
                Track decisions, inspect rejection notes, and reload previous payloads for revision.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={historyFilter}
                onChange={(event) => setHistoryFilter(event.target.value as RequestStatusFilter)}
                style={selectStyle}
              >
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <button
                type="button"
                onClick={() => void fetchRequests()}
                disabled={requestsLoading}
                style={secondaryButtonStyle}
              >
                {requestsLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto", marginTop: 18 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={cellHead}>Action</th>
                  <th style={cellHead}>Product</th>
                  <th style={cellHead}>Status</th>
                  <th style={cellHead}>Created</th>
                  <th style={cellHead}>Reviewed</th>
                  <th style={cellHead}>Admin note</th>
                  <th style={cellHead}>Next step</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={cellEmpty}>No submissions in this view.</td>
                  </tr>
                ) : (
                  filteredRequests.map((item) => {
                    const payload = parseRequestPayload(item);
                    const canReload = item.actionType !== "BULK_UPSERT" && item.actionType !== "DELETE";
                    return (
                      <tr key={item.id}>
                        <td style={cellBody}>{item.actionType}</td>
                        <td style={cellBody}>
                          {item.targetProductId || payload?.productID || payload?.productName || "-"}
                        </td>
                        <td style={cellBody}>{item.status}</td>
                        <td style={cellBody}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}</td>
                        <td style={cellBody}>{item.reviewedAt ? new Date(item.reviewedAt).toLocaleString() : "-"}</td>
                        <td style={cellBody}>{item.reviewerNote || "-"}</td>
                        <td style={cellBody}>
                          {canReload ? (
                            <button
                              type="button"
                              onClick={() => loadIntoComposer(payload, item.actionType === "CREATE" ? "create" : "update")}
                              style={tableActionButtonStyle}
                            >
                              {item.status === "REJECTED" ? "Revise" : "Reload"}
                            </button>
                          ) : (
                            <span style={mutedTextStyle}>View only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  background: "#fff",
  borderRadius: 20,
  padding: 28,
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)"};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
  marginTop: 20};

const summaryCardStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  padding: 18,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid rgba(16, 24, 40, 0.08)"};

const summaryValueStyle: CSSProperties = {
  fontSize: 28,
  color: "#111827"};

const summaryLabelStyle: CSSProperties = {
  color: "#667085",
  fontSize: 14};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap"};

const sectionSubtleTextStyle: CSSProperties = {
  marginTop: 8,
  marginBottom: 0,
  color: "#667085"};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid rgba(16, 24, 40, 0.12)",
  borderRadius: 12,
  padding: "12px 14px",
  background: "#fff",
  color: "#101828"};

const selectStyle: CSSProperties = {
  border: "1px solid rgba(16, 24, 40, 0.12)",
  borderRadius: 12,
  padding: "10px 14px",
  background: "#fff",
  color: "#101828"};

const uploadFieldStyle: CSSProperties = {
  display: "grid",
  gap: 6};

const uploadLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#344054"};

const uploadHintStyle: CSSProperties = {
  fontSize: 12,
  color: "#667085"};

const previewCardStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 14,
  border: "1px solid rgba(16, 24, 40, 0.08)",
  borderRadius: 16,
  background: "#fcfcfd"};

const previewImageStyle: CSSProperties = {
  width: "100%",
  maxHeight: 260,
  objectFit: "contain",
  borderRadius: 12,
  background: "#fff",
  border: "1px solid rgba(16, 24, 40, 0.08)"};

const primaryButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: 999,
  padding: "12px 18px",
  background: "#101828",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer"};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid rgba(16, 24, 40, 0.12)",
  borderRadius: 999,
  padding: "10px 16px",
  background: "#fff",
  color: "#101828",
  cursor: "pointer"};

const dangerButtonStyle: CSSProperties = {
  border: "1px solid rgba(185, 28, 28, 0.18)",
  borderRadius: 999,
  padding: "10px 16px",
  background: "#fff5f5",
  color: "#b42318",
  cursor: "pointer"};

const tableActionButtonStyle: CSSProperties = {
  border: "1px solid rgba(16, 24, 40, 0.12)",
  borderRadius: 999,
  padding: "8px 12px",
  background: "#fff",
  color: "#101828",
  cursor: "pointer"};

const cellHead: CSSProperties = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid rgba(16, 24, 40, 0.08)",
  color: "#475467",
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: "0.04em"};

const cellBody: CSSProperties = {
  padding: "14px 10px",
  borderBottom: "1px solid rgba(16, 24, 40, 0.08)",
  color: "#101828",
  verticalAlign: "top"};

const cellEmpty: CSSProperties = {
  padding: "20px 10px",
  textAlign: "center",
  color: "#667085"};

const mutedTextStyle: CSSProperties = {
  color: "#667085",
  fontSize: 13};
