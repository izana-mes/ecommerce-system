"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser, refreshCurrentUserFromServer, subscribeToAuthChanges } from "@/lib/auth";
import toast from "react-hot-toast";
import {
  Package,
  Plus,
  Search,
  RotateCw,
  Edit3,
  Trash2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Inbox,
  Handshake,
  Tag,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  FileText,
  DollarSign,
  Filter,
} from "lucide-react";

const CLOTHING_SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"] as const;
const FALLBACK_IMAGE = "/Products/product_1.jpg";

function resolveImage(src?: string | null): string {
  const val = String(src ?? "").trim();
  if (!val) return FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(val) || val.startsWith("/") || val.startsWith("data:image/")) {
    return val;
  }
  return FALLBACK_IMAGE;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

type ProductFormState = {
  productID: string;
  productName: string;
  sku: string;
  brand: string;
  category: string;
  productPrice: string;
  productReviews: string;
  frontImg: string;
  backImg: string;
  stockQuantity: string;
  sizes: string[];
  active: boolean;
  allowResale: boolean;
  minimumOrderQuantity: string;
  supplyTerms: string;
};

type SupplierCatalogProduct = {
  productID: string;
  productName: string;
  category?: string | null;
  sku?: string | null;
  brand?: string | null;
  productPrice?: number | null;
  productReviews?: string | null;
  frontImg?: string | null;
  backImg?: string | null;
  stockQuantity?: number | null;
  sizes?: string[] | null;
  active?: boolean | null;
  allowResale?: boolean;
  wholesalePrice?: number | null;
  minimumOrderQuantity?: number | null;
  supplyTerms?: string | null;
  resaleApproved?: boolean;
};

type ProductChangeRequest = {
  id: string;
  actionType: "CREATE" | "UPDATE" | "DELETE" | "BULK_UPSERT";
  targetProductId?: string | null;
  requestPayload?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  reviewerNote?: string | null;
  createdAt?: string | null;
  reviewedAt?: string | null;
};

const INITIAL_FORM: ProductFormState = {
  productID: "",
  productName: "",
  sku: "",
  brand: "",
  category: "",
  productPrice: "",
  productReviews: "",
  frontImg: "",
  backImg: "",
  stockQuantity: "50",
  sizes: ["M", "L"],
  active: true,
  allowResale: true,
  minimumOrderQuantity: "1",
  supplyTerms: "",
};

export default function SupplierPage() {
  const router = useRouter();
  const token = getUser();
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);

  // Form & Composer
  const [form, setForm] = useState<ProductFormState>(INITIAL_FORM);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  // Catalog & Requests Data
  const [catalog, setCatalog] = useState<SupplierCatalogProduct[]>([]);
  const [requests, setRequests] = useState<ProductChangeRequest[]>([]);
  const [distribution, setDistribution] = useState<
    Record<string, { enabled: boolean; wholesalePrice: string; moq: string; approved: boolean; terms: string }>
  >({});

  // Filtering, Searching & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE" | "RESALE">("ALL");
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 10;

  // Selected for Bulk Actions
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkActionBusy, setBulkActionBusy] = useState(false);

  // Modal States
  const [detailsProduct, setDetailsProduct] = useState<SupplierCatalogProduct | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<SupplierCatalogProduct | null>(null);
  const [activeTab, setActiveTab] = useState<"catalog" | "requests">("catalog");
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>("ALL");
  const [resubmittingId, setResubmittingId] = useState<string | null>(null);

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

  useEffect(() => {
    void syncUser();
    return subscribeToAuthChanges(() => {
      void syncUser();
    });
  }, [syncUser]);

  const fetchRequests = useCallback(async () => {
    if (!token) return;
    setRequestsLoading(true);
    try {
      const res = await fetch("/api/products/change-requests/mine", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to fetch change requests");
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      setRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, [token]);

  const fetchCatalog = useCallback(async () => {
    if (!token) return;
    setCatalogLoading(true);
    try {
      const [catRes, flagsRes, offersRes] = await Promise.all([
        fetch("/api/products/supplier/mine", { cache: "no-store" }),
        fetch("/api/v1/supplier/resale/catalog-flags", { cache: "no-store" }),
        fetch("/api/v1/supplier/products/mine", { cache: "no-store" }).catch(() => null),
      ]);

      const catData = await catRes.json();
      const rawCatalog: SupplierCatalogProduct[] = Array.isArray(catData) ? catData : [];

      const nextDist: Record<string, { enabled: boolean; wholesalePrice: string; moq: string; approved: boolean; terms: string }> = {};

      if (flagsRes.ok) {
        const flagsData = await flagsRes.json();
        (Array.isArray(flagsData) ? flagsData : []).forEach(
          (flag: {
            productId: string;
            resaleEnabled?: boolean;
            wholesalePrice?: number | null;
            minimumOrderQuantity?: number | null;
            supplierProductApproved?: boolean;
            commercialNote?: string | null;
          }) => {
            nextDist[flag.productId] = {
              enabled: Boolean(flag.resaleEnabled),
              wholesalePrice: flag.wholesalePrice == null ? "" : String(flag.wholesalePrice),
              moq: String(flag.minimumOrderQuantity || 1),
              approved: Boolean(flag.supplierProductApproved),
              terms: flag.commercialNote || "",
            };
          }
        );
      }

      if (offersRes && offersRes.ok) {
        const offersData = await offersRes.json();
        (Array.isArray(offersData) ? offersData : []).forEach(
          (offer: {
            productId: string;
            available?: boolean;
            allowResale?: boolean;
            wholesalePrice?: number;
            minimumOrderQuantity?: number;
            approved?: boolean;
            supplyTerms?: string;
          }) => {
            if (!nextDist[offer.productId]) {
              nextDist[offer.productId] = {
                enabled: offer.allowResale ?? offer.available ?? false,
                wholesalePrice: offer.wholesalePrice != null ? String(offer.wholesalePrice) : "",
                moq: offer.minimumOrderQuantity != null ? String(offer.minimumOrderQuantity) : "1",
                approved: Boolean(offer.approved),
                terms: offer.supplyTerms || "",
              };
            }
          }
        );
      }

      setDistribution(nextDist);

      // Merge resale flags into catalog items
      const enriched = rawCatalog.map((p) => {
        const dist = nextDist[p.productID];
        return {
          ...p,
          allowResale: dist ? dist.enabled : false,
          wholesalePrice: dist && dist.wholesalePrice ? parseFloat(dist.wholesalePrice) : p.productPrice,
          minimumOrderQuantity: dist && dist.moq ? parseInt(dist.moq, 10) : 1,
          resaleApproved: dist ? dist.approved : false,
          supplyTerms: dist ? dist.terms : "",
        };
      });

      setCatalog(enriched);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load product catalog");
      setCatalog([]);
    } finally {
      setCatalogLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!loading) {
      void fetchCatalog();
      void fetchRequests();
    }
  }, [fetchCatalog, fetchRequests, loading]);

  // Unique categories for filter dropdown
  const categories = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [catalog]);

  // Filtered Catalog
  const filteredCatalog = useMemo(() => {
    let result = catalog;
    if (categoryFilter !== "ALL") {
      result = result.filter((p) => p.category === categoryFilter);
    }
    if (statusFilter === "ACTIVE") {
      result = result.filter((p) => p.active !== false);
    } else if (statusFilter === "INACTIVE") {
      result = result.filter((p) => p.active === false);
    } else if (statusFilter === "RESALE") {
      result = result.filter((p) => p.allowResale);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.productName.toLowerCase().includes(q) ||
          p.productID.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
      );
    }
    return result;
  }, [catalog, categoryFilter, statusFilter, searchQuery]);

  const totalPages = Math.ceil(filteredCatalog.length / PAGE_SIZE) || 1;
  const paginatedCatalog = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredCatalog.slice(start, start + PAGE_SIZE);
  }, [filteredCatalog, currentPage]);

  // Form Handlers
  const handleFormChange = (field: keyof ProductFormState, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSize = (size: string) => {
    setForm((prev) => {
      const exists = prev.sizes.includes(size);
      return {
        ...prev,
        sizes: exists ? prev.sizes.filter((s) => s !== size) : [...prev.sizes, size],
      };
    });
  };

  const handleImageUpload = async (field: "frontImg" | "backImg", event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a valid image file");
      event.target.value = "";
      return;
    }

    try {
      if (field === "frontImg") setUploadingFront(true);
      if (field === "backImg") setUploadingBack(true);
      const dataUrl = await fileToDataUrl(file);
      setForm((prev) => ({ ...prev, [field]: dataUrl }));
      toast.success(`${field === "frontImg" ? "Front" : "Back"} image uploaded`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      if (field === "frontImg") setUploadingFront(false);
      if (field === "backImg") setUploadingBack(false);
      event.target.value = "";
    }
  };

  const openCreateComposer = () => {
    setEditingProductId(null);
    setForm({
      ...INITIAL_FORM,
      productID: `SP-${Date.now().toString().slice(-6)}`,
    });
    setIsComposerOpen(true);
  };

  const openEditComposer = (product: SupplierCatalogProduct) => {
    setEditingProductId(product.productID);
    setForm({
      productID: product.productID,
      productName: product.productName || "",
      sku: product.sku || "",
      brand: product.brand || "",
      category: product.category || "",
      productPrice: product.productPrice != null ? String(product.productPrice) : "",
      productReviews: product.productReviews || "",
      frontImg: product.frontImg || "",
      backImg: product.backImg || "",
      stockQuantity: product.stockQuantity != null ? String(product.stockQuantity) : "0",
      sizes: Array.isArray(product.sizes) ? product.sizes : [],
      active: product.active !== false,
      allowResale: product.allowResale ?? false,
      minimumOrderQuantity: product.minimumOrderQuantity != null ? String(product.minimumOrderQuantity) : "1",
      supplyTerms: product.supplyTerms || "",
    });
    setIsComposerOpen(true);
  };

  const closeComposer = () => {
    setIsComposerOpen(false);
    setEditingProductId(null);
    setForm(INITIAL_FORM);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productID.trim() || !form.productName.trim() || !form.category.trim()) {
      toast.error("Product ID, Name, and Category are required");
      return;
    }
    const priceNum = parseFloat(form.productPrice);
    if (!priceNum || priceNum <= 0) {
      toast.error("Enter a valid positive wholesale/retail price");
      return;
    }
    const stockNum = parseInt(form.stockQuantity, 10);
    if (isNaN(stockNum) || stockNum < 0) {
      toast.error("Stock quantity must be a non-negative whole number");
      return;
    }

    setSaving(true);
    try {
      const isCreate = editingProductId === null;
      const method = isCreate ? "POST" : "PUT";
      const payload = {
        productID: form.productID.trim(),
        productName: form.productName.trim(),
        sku: form.sku.trim() || undefined,
        brand: form.brand.trim() || undefined,
        category: form.category.trim(),
        productPrice: priceNum,
        productReviews: form.productReviews.trim() || undefined,
        frontImg: form.frontImg.trim() || undefined,
        backImg: form.backImg.trim() || undefined,
        stockQuantity: stockNum,
        sizes: form.sizes,
        active: form.active,
      };

      const res = await fetch("/api/auth/admin-products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData?.message || resData?.error || "Failed to save product");
      }

      // Also update resale flag terms in parallel
      try {
        const query = new URLSearchParams({
          enabled: String(form.allowResale),
          wholesalePrice: String(priceNum),
          minimumOrderQuantity: form.minimumOrderQuantity || "1",
          commercialNote: form.supplyTerms.trim() || "",
        });
        await fetch(`/api/v1/supplier/resale/catalog-flags/${encodeURIComponent(form.productID.trim())}?${query}`, {
          method: "PUT",
        });
      } catch {
        // Non-fatal
      }

      toast.success(
        isCreate
          ? "Product submitted for Admin approval!"
          : "Product update submitted for Admin review!"
      );
      closeComposer();
      await Promise.all([fetchCatalog(), fetchRequests()]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Delete product action (submits delete request for Admin moderation)
  const confirmDeleteProduct = async () => {
    if (!deletingProduct) return;
    try {
      const res = await fetch("/api/auth/admin-products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productID: deletingProduct.productID }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to delete product");
      toast.success(`Deletion request submitted for ${deletingProduct.productName}`);
      setDeletingProduct(null);
      await fetchRequests();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete request failed");
    }
  };

  // Toggle Resale Flag Quick Action
  const toggleResaleAvailability = async (product: SupplierCatalogProduct) => {
    const nextState = !product.allowResale;
    try {
      const query = new URLSearchParams({
        enabled: String(nextState),
        wholesalePrice: String(product.wholesalePrice ?? product.productPrice ?? 1),
        minimumOrderQuantity: String(product.minimumOrderQuantity ?? 1),
      });
      const res = await fetch(`/api/v1/supplier/resale/catalog-flags/${encodeURIComponent(product.productID)}?${query}`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Could not update resale availability");
      toast.success(nextState ? "Product opened for Seller resale!" : "Product removed from resale network");
      await fetchCatalog();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  // Resubmit a request that received CHANGES_REQUESTED
  const handleResubmitRequest = async (requestId: string) => {
    setResubmittingId(requestId);
    try {
      const res = await fetch(`/api/products/change-requests/${encodeURIComponent(requestId)}/resubmit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to resubmit request");
      toast.success("Change request resubmitted to Admin queue!");
      await fetchRequests();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Resubmit failed");
    } finally {
      setResubmittingId(null);
    }
  };

  // Bulk Operations
  const handleSelectAll = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedProductIds(paginatedCatalog.map((p) => p.productID));
    } else {
      setSelectedProductIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const executeBulkResale = async (enable: boolean) => {
    if (selectedProductIds.length === 0) return;
    setBulkActionBusy(true);
    try {
      await Promise.all(
        selectedProductIds.map((id) => {
          const item = catalog.find((p) => p.productID === id);
          const query = new URLSearchParams({
            enabled: String(enable),
            wholesalePrice: String(item?.wholesalePrice ?? item?.productPrice ?? 1),
            minimumOrderQuantity: String(item?.minimumOrderQuantity ?? 1),
          });
          return fetch(`/api/v1/supplier/resale/catalog-flags/${encodeURIComponent(id)}?${query}`, {
            method: "PUT",
          });
        })
      );
      toast.success(`Resale availability ${enable ? "enabled" : "disabled"} for ${selectedProductIds.length} items`);
      setSelectedProductIds([]);
      await fetchCatalog();
    } catch {
      toast.error("Bulk update failed partially");
    } finally {
      setBulkActionBusy(false);
    }
  };

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    if (requestStatusFilter === "ALL") return requests;
    return requests.filter((r) => r.status === requestStatusFilter);
  }, [requests, requestStatusFilter]);

  const pendingApprovalsCount = useMemo(
    () => requests.filter((r) => r.status === "PENDING").length,
    [requests]
  );
  const changesRequestedCount = useMemo(
    () => requests.filter((r) => r.status === "CHANGES_REQUESTED").length,
    [requests]
  );

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Supplier Product Management</h1>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void fetchCatalog()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition"
          >
            <RotateCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            type="button"
            onClick={openCreateComposer}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg shadow-sm hover:bg-slate-800 transition"
          >
            <Plus className="w-4 h-4" /> Add New Product
          </button>
        </div>
      </div>

      {/* Tabs: Catalog vs Moderation History */}
      <div className="flex items-center border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("catalog")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === "catalog"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>My Product Catalog ({catalog.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("requests")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === "requests"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Moderation History ({requests.length})</span>
          {pendingApprovalsCount > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">
              {pendingApprovalsCount}
            </span>
          )}
          {changesRequestedCount > 0 && (
            <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded-full text-[10px] font-bold">
              {changesRequestedCount} Action Required
            </span>
          )}
        </button>
      </div>

      {activeTab === "catalog" ? (
        <>
          {/* Search, Filters, Bulk Toolbar */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by ID, name, SKU, brand..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(0);
                  }}
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-4 py-2 text-xs focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(0);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 focus:border-slate-500 focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("ALL");
                    setCurrentPage(0);
                  }}
                  className={`px-3 py-1 rounded-md font-medium transition ${
                    statusFilter === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("ACTIVE");
                    setCurrentPage(0);
                  }}
                  className={`px-3 py-1 rounded-md font-medium transition ${
                    statusFilter === "ACTIVE" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("INACTIVE");
                    setCurrentPage(0);
                  }}
                  className={`px-3 py-1 rounded-md font-medium transition ${
                    statusFilter === "INACTIVE" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Inactive
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("RESALE");
                    setCurrentPage(0);
                  }}
                  className={`px-3 py-1 rounded-md font-medium transition ${
                    statusFilter === "RESALE" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Resale Enabled
                </button>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedProductIds.length > 0 && (
              <div className="flex items-center gap-2 bg-indigo-50/80 px-3 py-1.5 rounded-lg border border-indigo-200">
                <span className="text-xs font-semibold text-indigo-900">
                  {selectedProductIds.length} selected:
                </span>
                <button
                  type="button"
                  onClick={() => void executeBulkResale(true)}
                  disabled={bulkActionBusy}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                >
                  Enable Resale
                </button>
                <button
                  type="button"
                  onClick={() => void executeBulkResale(false)}
                  disabled={bulkActionBusy}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-white text-slate-700 border border-slate-300 rounded hover:bg-slate-50 transition"
                >
                  Disable Resale
                </button>
              </div>
            )}
          </div>

          {/* Product Data Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {catalogLoading ? (
              <div className="p-12 text-center text-slate-400 text-sm">Loading product catalog...</div>
            ) : paginatedCatalog.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="mx-auto h-10 w-10 text-slate-300" />
                <h3 className="mt-2 text-sm font-semibold text-slate-700">No products found</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {catalog.length === 0
                    ? "Add your first wholesale product to start receiving Seller requests."
                    : "No products match your current search or filter."}
                </p>
                {catalog.length === 0 && (
                  <button
                    type="button"
                    onClick={openCreateComposer}
                    className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition"
                  >
                    Add Product
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={
                            paginatedCatalog.length > 0 &&
                            paginatedCatalog.every((p) => selectedProductIds.includes(p.productID))
                          }
                          onChange={handleSelectAll}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="py-3 px-3">Product</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3 text-center">Sizes</th>
                      <th className="py-3 px-3 text-right">Wholesale / MSRP</th>
                      <th className="py-3 px-3 text-center">MOQ</th>
                      <th className="py-3 px-3 text-center">Stock</th>
                      <th className="py-3 px-3 text-center">Resale Allowed</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedCatalog.map((product) => {
                      const isSelected = selectedProductIds.includes(product.productID);
                      const isLowStock = (product.stockQuantity ?? 0) <= 5;

                      return (
                        <tr
                          key={product.productID}
                          className={`hover:bg-slate-50/50 transition ${isSelected ? "bg-indigo-50/30" : ""}`}
                        >
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectOne(product.productID)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={resolveImage(product.frontImg)}
                                alt={product.productName}
                                className="w-10 h-10 object-cover rounded-lg border border-slate-200 bg-slate-50"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                                }}
                              />
                              <div>
                                <div className="font-semibold text-slate-900">{product.productName}</div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  ID: {product.productID} {product.sku ? `· SKU: ${product.sku}` : ""}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-600">
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                              {product.category || "Uncategorized"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {Array.isArray(product.sizes) && product.sizes.length > 0 ? (
                              <div className="flex items-center justify-center gap-1 flex-wrap">
                                {product.sizes.map((s) => (
                                  <span
                                    key={s}
                                    className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900 text-sm">
                            ${Number(product.productPrice ?? 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-slate-700">
                            {product.minimumOrderQuantity ?? 1}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full font-bold text-xs ${
                                isLowStock ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-800"
                              }`}
                            >
                              {product.stockQuantity ?? 0}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => void toggleResaleAvailability(product)}
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition ${
                                product.allowResale
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                  : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                              }`}
                              title="Click to toggle resale availability"
                            >
                              {product.allowResale ? "Allowed" : "Disabled"}
                            </button>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                product.active !== false
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {product.active !== false ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDetailsProduct(product)}
                                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                                title="View Specifications"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditComposer(product)}
                                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"
                                title="Edit Product"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingProduct(product)}
                                className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition"
                                title="Delete Product"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {filteredCatalog.length > PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
                <div className="text-xs text-slate-500">
                  Showing <span className="font-semibold">{currentPage * PAGE_SIZE + 1}</span> to{" "}
                  <span className="font-semibold">
                    {Math.min((currentPage + 1) * PAGE_SIZE, filteredCatalog.length)}
                  </span>{" "}
                  of <span className="font-semibold">{filteredCatalog.length}</span> products
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
                    disabled={currentPage === 0}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </button>
                  <span className="text-xs text-slate-600 font-medium px-2">
                    {currentPage + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages - 1))}
                    disabled={currentPage >= totalPages - 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Moderation Requests Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Filter By Status:</span>
              <button
                type="button"
                onClick={() => setRequestStatusFilter("ALL")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  requestStatusFilter === "ALL" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All ({requests.length})
              </button>
              <button
                type="button"
                onClick={() => setRequestStatusFilter("PENDING")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  requestStatusFilter === "PENDING" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Pending Review ({requests.filter((r) => r.status === "PENDING").length})
              </button>
              <button
                type="button"
                onClick={() => setRequestStatusFilter("CHANGES_REQUESTED")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  requestStatusFilter === "CHANGES_REQUESTED"
                    ? "bg-rose-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Changes Requested ({requests.filter((r) => r.status === "CHANGES_REQUESTED").length})
              </button>
              <button
                type="button"
                onClick={() => setRequestStatusFilter("APPROVED")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  requestStatusFilter === "APPROVED" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Approved ({requests.filter((r) => r.status === "APPROVED").length})
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {requestsLoading ? (
              <div className="p-12 text-center text-slate-400 text-xs">Loading change requests...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">No moderation requests in this state.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target Product ID</th>
                    <th className="py-3 px-4">Submitted Date</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Reviewer Feedback</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{req.actionType}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{req.targetProductId || "New Product"}</td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {req.createdAt ? new Date(req.createdAt).toLocaleString() : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            req.status === "APPROVED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : req.status === "CHANGES_REQUESTED"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : req.status === "REJECTED"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {req.reviewerNote ? (
                          <div className="max-w-md bg-amber-50/60 p-2 rounded text-slate-800 border border-amber-200/60">
                            {req.reviewerNote}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No note attached</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {req.status === "CHANGES_REQUESTED" && (
                          <button
                            type="button"
                            onClick={() => void handleResubmitRequest(req.id)}
                            disabled={resubmittingId === req.id}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shadow-xs disabled:opacity-50"
                          >
                            {resubmittingId === req.id ? "Resubmitting..." : "Resubmit"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Product Composer Modal (Create & Edit) */}
      {isComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl my-8 rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingProductId ? `Edit Product: ${editingProductId}` : "Create New Product"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Organized into comprehensive sections matching Admin standards.
                </p>
              </div>
              <button
                type="button"
                onClick={closeComposer}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-6">
              {/* Section 1: Basic Information */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span>1. Basic Information</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Product ID *</label>
                    <input
                      type="text"
                      required
                      disabled={editingProductId !== null}
                      value={form.productID}
                      onChange={(e) => handleFormChange("productID", e.target.value)}
                      placeholder="e.g. SP-1002"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 disabled:bg-slate-100 focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Product Name *</label>
                    <input
                      type="text"
                      required
                      value={form.productName}
                      onChange={(e) => handleFormChange("productName", e.target.value)}
                      placeholder="e.g. Premium Cotton T-Shirt"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Supplier SKU</label>
                    <input
                      type="text"
                      value={form.sku}
                      onChange={(e) => handleFormChange("sku", e.target.value)}
                      placeholder="e.g. SKU-COT-001"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Brand</label>
                    <input
                      type="text"
                      value={form.brand}
                      onChange={(e) => handleFormChange("brand", e.target.value)}
                      placeholder="e.g. Acme Apparel"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700">Description / Specifications</label>
                    <textarea
                      rows={3}
                      value={form.productReviews}
                      onChange={(e) => handleFormChange("productReviews", e.target.value)}
                      placeholder="Detailed product specifications, materials, and care instructions..."
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Images & Media */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span>2. Product Media & Images</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Front Image */}
                  <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">Front Image</label>
                    <input
                      type="text"
                      value={form.frontImg}
                      onChange={(e) => handleFormChange("frontImg", e.target.value)}
                      placeholder="Image URL or upload"
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:border-slate-500 focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold inline-flex items-center gap-1">
                        <Upload className="w-3 h-3" />
                        <span>Upload File</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => void handleImageUpload("frontImg", e)}
                          className="hidden"
                        />
                      </label>
                      {uploadingFront && <span className="text-[11px] text-slate-400">Reading...</span>}
                      {form.frontImg && (
                        <button
                          type="button"
                          onClick={() => handleFormChange("frontImg", "")}
                          className="text-xs text-rose-600 hover:underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {form.frontImg && (
                      <img
                        src={resolveImage(form.frontImg)}
                        alt="Front preview"
                        className="w-full h-24 object-contain rounded border border-slate-200 bg-slate-50 mt-1"
                      />
                    )}
                  </div>

                  {/* Back Image */}
                  <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">Back Image</label>
                    <input
                      type="text"
                      value={form.backImg}
                      onChange={(e) => handleFormChange("backImg", e.target.value)}
                      placeholder="Image URL or upload"
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:border-slate-500 focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold inline-flex items-center gap-1">
                        <Upload className="w-3 h-3" />
                        <span>Upload File</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => void handleImageUpload("backImg", e)}
                          className="hidden"
                        />
                      </label>
                      {uploadingBack && <span className="text-[11px] text-slate-400">Reading...</span>}
                      {form.backImg && (
                        <button
                          type="button"
                          onClick={() => handleFormChange("backImg", "")}
                          className="text-xs text-rose-600 hover:underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {form.backImg && (
                      <img
                        src={resolveImage(form.backImg)}
                        alt="Back preview"
                        className="w-full h-24 object-contain rounded border border-slate-200 bg-slate-50 mt-1"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: Category & Variants */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <span>3. Category & Sizing Variants</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Category *</label>
                    <input
                      type="text"
                      required
                      value={form.category}
                      onChange={(e) => handleFormChange("category", e.target.value)}
                      placeholder="e.g. Clothing, Shoes, Accessories"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Clothing Sizes / Variants
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {CLOTHING_SIZE_OPTIONS.map((size) => {
                        const selected = form.sizes.includes(size);
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => toggleSize(size)}
                            className={`px-2.5 py-1 rounded text-xs font-semibold border transition ${
                              selected
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Pricing & Inventory */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  <span>4. Pricing & Original Inventory</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Wholesale Price ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={form.productPrice}
                      onChange={(e) => handleFormChange("productPrice", e.target.value)}
                      placeholder="29.99"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Minimum Order Qty (MOQ)</label>
                    <input
                      type="number"
                      min="1"
                      value={form.minimumOrderQuantity}
                      onChange={(e) => handleFormChange("minimumOrderQuantity", e.target.value)}
                      placeholder="1"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Original Stock Quantity *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={form.stockQuantity}
                      onChange={(e) => handleFormChange("stockQuantity", e.target.value)}
                      placeholder="100"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Resale Configuration & Publication */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Handshake className="w-4 h-4 text-slate-400" />
                  <span>5. Resale Configuration & Publication</span>
                </h4>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800">Enable Seller Resale Network</div>
                      <div className="text-[11px] text-slate-500">Allow authorized Sellers to discover and request to resell this product</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.allowResale}
                      onChange={(e) => handleFormChange("allowResale", e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Supply Terms / Commercial Notes <span className="text-slate-400 font-normal">(optional for sellers)</span>
                    </label>
                    <input
                      type="text"
                      value={form.supplyTerms}
                      onChange={(e) => handleFormChange("supplyTerms", e.target.value)}
                      placeholder="e.g. Ships within 2 business days; includes authentic manufacturer warranty"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-slate-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <div>
                      <div className="text-xs font-bold text-slate-800">Mark Product Active</div>
                      <div className="text-[11px] text-slate-500">Set active publication state upon Admin approval</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => handleFormChange("active", e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeComposer}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {saving
                    ? "Submitting..."
                    : editingProductId
                    ? "Submit Update for Approval"
                    : "Submit Product for Approval"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Details Modal */}
      {detailsProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{detailsProduct.productName}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Product ID: {detailsProduct.productID}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsProduct(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Images */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] font-semibold uppercase text-slate-400">Front View</span>
                <img
                  src={resolveImage(detailsProduct.frontImg)}
                  alt="Front view"
                  className="w-full h-32 object-contain rounded-lg border border-slate-200 bg-slate-50 mt-1"
                />
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase text-slate-400">Back View</span>
                <img
                  src={resolveImage(detailsProduct.backImg)}
                  alt="Back view"
                  className="w-full h-32 object-contain rounded-lg border border-slate-200 bg-slate-50 mt-1"
                />
              </div>
            </div>

            {/* Specifications Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
              <div>
                <span className="text-slate-400">SKU:</span>{" "}
                <span className="font-semibold text-slate-800">{detailsProduct.sku || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400">Brand:</span>{" "}
                <span className="font-semibold text-slate-800">{detailsProduct.brand || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400">Category:</span>{" "}
                <span className="font-semibold text-slate-800">{detailsProduct.category || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400">Wholesale Price:</span>{" "}
                <span className="font-bold text-slate-900">${Number(detailsProduct.productPrice ?? 0).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-400">Minimum Order Qty:</span>{" "}
                <span className="font-semibold text-slate-800">{detailsProduct.minimumOrderQuantity ?? 1}</span>
              </div>
              <div>
                <span className="text-slate-400">Stock Quantity:</span>{" "}
                <span className="font-semibold text-slate-800">{detailsProduct.stockQuantity ?? 0} units</span>
              </div>
              <div>
                <span className="text-slate-400">Resale Allowed:</span>{" "}
                <span className={`font-semibold ${detailsProduct.allowResale ? "text-emerald-700" : "text-slate-500"}`}>
                  {detailsProduct.allowResale ? "Yes" : "No"}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Catalog Visibility:</span>{" "}
                <span className="font-semibold text-slate-800">{detailsProduct.active !== false ? "Active" : "Inactive"}</span>
              </div>
            </div>

            {detailsProduct.productReviews && (
              <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
                <span className="font-semibold text-slate-800 block mb-1">Description:</span>
                {detailsProduct.productReviews}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDetailsProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">Request Product Deletion</h3>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to request deletion of{" "}
              <span className="font-bold text-slate-900">{deletingProduct.productName}</span> (ID:{" "}
              {deletingProduct.productID})?
            </p>
            <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              This will submit a deletion request to the Admin moderation team. Any active Seller allocations will be reviewed.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteProduct()}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition"
              >
                Submit Deletion Request
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
