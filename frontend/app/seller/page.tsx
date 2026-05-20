"use client";

import { CSSProperties, ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser, refreshCurrentUserFromServer, subscribeToAuthChanges } from "@/lib/auth";
import toast from "react-hot-toast";

type ProductFormState = {
  productID: string;
  productName: string;
  category: string;
  productPrice: string;
  productReviews: string;
  frontImg: string;
  backImg: string;
  stockQuantity: string;
  sizes: string;
  active: boolean;
};

type SellerCatalogProduct = {
  productID: string;
  productName: string;
  category?: string | null;
  productPrice?: number | null;
  productReviews?: string | null;
  frontImg?: string | null;
  backImg?: string | null;
  stockQuantity?: number | null;
  sizes?: string[] | null;
  active?: boolean | null;
};

type FormMode = "create" | "update";

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
  category: "",
  productPrice: "",
  productReviews: "",
  frontImg: "",
  backImg: "",
  stockQuantity: "",
  sizes: "",
  active: true};

function normalizeFormState(source?: SellerCatalogProduct | null): ProductFormState {
  return {
    productID: String(source?.productID || ""),
    productName: String(source?.productName || ""),
    category: String(source?.category || ""),
    productPrice: source?.productPrice === null || source?.productPrice === undefined ? "" : String(source.productPrice),
    productReviews: String(source?.productReviews || ""),
    frontImg: String(source?.frontImg || ""),
    backImg: String(source?.backImg || ""),
    stockQuantity:
      source?.stockQuantity === null || source?.stockQuantity === undefined ? "" : String(source.stockQuantity),
    sizes: Array.isArray(source?.sizes) ? source.sizes.join(", ") : "",
    active: source?.active !== false};
}

export default function SellerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [deleteSubmittingId, setDeleteSubmittingId] = useState<string | null>(null);
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [form, setForm] = useState<ProductFormState>(INITIAL_FORM);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalog, setCatalog] = useState<SellerCatalogProduct[]>([]);

  const syncUser = useCallback(async () => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/login?returnTo=/seller");
      return;
    }
    const refreshed = await refreshCurrentUserFromServer();
    const nextUser = refreshed || currentUser;
    if (nextUser.role !== "seller" && nextUser.role !== "admin") {
      router.replace("/profile");
      return;
    }
    setLoading(false);
  }, [router]);

  const fetchCatalog = useCallback(async (query?: string) => {
    const token = getToken();
    if (!token) return;

    setCatalogLoading(true);
    try {
      const search = (query ?? catalogQuery).trim();
      const endpoint = search
        ? `/api/v1/seller/products?q=${encodeURIComponent(search)}`
        : "/api/v1/seller/products";
      const response = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json"}});
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || "Failed to fetch catalog");
      }
      const items = payload?.data;
      setCatalog(Array.isArray(items) ? items : []);
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
      void fetchCatalog("");
    }
  }, [fetchCatalog, loading]);

  const handleChange = (field: keyof ProductFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetComposer = () => {
    setForm(INITIAL_FORM);
    setFormMode("create");
  };

  const loadIntoComposer = (source: SellerCatalogProduct | null | undefined, mode: FormMode) => {
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

  const submitProduct = async () => {
    const token = getToken();
    if (!token) {
      router.replace("/login?returnTo=/seller");
      return;
    }

    setSaving(true);
    try {
      const productID = form.productID.trim();
      const method = formMode === "create" ? "POST" : "PUT";
      const endpoint =
        formMode === "create"
          ? "/api/v1/seller/products"
          : `/api/v1/seller/products/${encodeURIComponent(productID)}`;

      const response = await fetch(endpoint, {
        method: method,
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({
          productID,
          productName: form.productName.trim(),
          category: form.category.trim(),
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
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Failed to ${formMode === "create" ? "create" : "update"} product`
        );
      }
      toast.success(
        data?.message ||
          (formMode === "create"
          ? "Product created"
          : "Product updated")
      );
      resetComposer();
      await fetchCatalog(catalogQuery);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${formMode === "create" ? "create" : "update"} product`
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (productID: string) => {
    const token = getToken();
    if (!token) {
      router.replace("/login?returnTo=/seller");
      return;
    }

    setDeleteSubmittingId(productID);
    try {
      const response = await fetch(`/api/v1/seller/products/${encodeURIComponent(productID)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"}});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to delete product");
      }
      toast.success(data?.message || `Deleted ${productID}`);
      await fetchCatalog(catalogQuery);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete product");
    } finally {
      setDeleteSubmittingId(null);
    }
  };

  if (loading) {
    return <div style={{ padding: "48px 16px", maxWidth: 1080, margin: "0 auto" }}>Loading seller portal...</div>;
  }

  return (
    <div style={{ padding: "48px 16px", background: "#f6f7fb", minHeight: "70vh" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gap: 24 }}>
        <section style={panelStyle}>
          <h1 style={{ margin: 0, fontSize: 32 }}>Seller workspace</h1>
          <p style={{ marginTop: 10, color: "#475467" }}>
            Create and manage your own product catalog.
          </p>
          <div style={summaryGridStyle}>
            <article style={summaryCardStyle}>
              <strong style={summaryValueStyle}>{catalog.length}</strong>
              <span style={summaryLabelStyle}>Products in your catalog</span>
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
                {formMode === "create" ? "Add a new product to your catalog." : "Edit one of your existing products."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={resetComposer}
                style={secondaryButtonStyle}
              >
                New product
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            <input value={form.productID} onChange={(event) => handleChange("productID", event.target.value)} placeholder="Product ID" style={inputStyle} />
            <input value={form.productName} onChange={(event) => handleChange("productName", event.target.value)} placeholder="Product name" style={inputStyle} />
            <input value={form.category} onChange={(event) => handleChange("category", event.target.value)} placeholder="Category" style={inputStyle} />
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
              onClick={() => void submitProduct()}
              disabled={saving}
              style={primaryButtonStyle}
            >
              {saving
                ? formMode === "create"
                  ? "Creating..."
                  : "Saving..."
                : formMode === "create"
                  ? "Create product"
                  : "Save changes"}
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
                Search your products, load one into the editor, or delete it.
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
                  <th style={cellHead}>Category</th>
                  <th style={cellHead}>Price</th>
                  <th style={cellHead}>Stock</th>
                  <th style={cellHead}>Status</th>
                  <th style={cellHead}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {catalog.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={cellEmpty}>
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
                        {product.category || "Uncategorized"}
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
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteProduct(product.productID)}
                            disabled={deleteSubmittingId === product.productID}
                            style={dangerButtonStyle}
                          >
                            {deleteSubmittingId === product.productID ? "Deleting..." : "Delete"}
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
