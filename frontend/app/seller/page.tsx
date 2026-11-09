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
  Store,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Handshake,
  DollarSign,
  FileText,
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

type UnifiedProduct = {
  id: string; // ProductID for owned, ListingID for resale
  sourceType: "SELLER_OWNED" | "SUPPLIER_RESALE";
  title: string;
  originalProductName?: string;
  sku?: string;
  brand?: string;
  category?: string;
  price: number;
  wholesalePrice?: number;
  frontImg?: string;
  backImg?: string;
  sizes?: string[];
  stockQuantity: number;
  allocatedQuantity?: number;
  soldQuantity?: number;
  reservedQuantity?: number;
  remainingQuantity?: number;
  active: boolean;
  supplierName?: string;
  supplierProductId?: string;
  authorizationId?: string;
  description?: string;
};

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
};

type ResaleListingEditState = {
  listingId: string;
  customTitle: string;
  retailPrice: string;
  active: boolean;
};

type ActiveAuthorization = {
  id: string;
  supplierProductId: string;
  supplierProductName?: string;
  supplierProductImage?: string;
  supplierProductPrice?: number;
  supplierDisplayName?: string;
  initialAllocationQuantity?: number;
  active: boolean;
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
  stockQuantity: "25",
  sizes: ["M", "L"],
  active: true,
};

export default function SellerPage() {
  const router = useRouter();
  const token = getUser();
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [savingOwned, setSavingOwned] = useState(false);
  const [savingResale, setSavingResale] = useState(false);

  // Unified items list
  const [items, setItems] = useState<UnifiedProduct[]>([]);
  const [requests, setRequests] = useState<ProductChangeRequest[]>([]);

  // Filtering & Pagination
  const [sourceFilter, setSourceFilter] = useState<"ALL" | "SELLER_OWNED" | "SUPPLIER_RESALE">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE" | "LOW_STOCK">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 10;

  // Selected items for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<"products" | "requests">("products");
  const [resubmittingId, setResubmittingId] = useState<string | null>(null);

  // Owned Product Modal State
  const [isOwnedComposerOpen, setIsOwnedComposerOpen] = useState(false);
  const [editingOwnedId, setEditingOwnedId] = useState<string | null>(null);
  const [ownedForm, setOwnedForm] = useState<ProductFormState>(INITIAL_FORM);
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);

  // Resale Product Edit Modal State
  const [resaleEditItem, setResaleEditItem] = useState<UnifiedProduct | null>(null);
  const [resaleEditForm, setResaleEditForm] = useState<ResaleListingEditState>({
    listingId: "",
    customTitle: "",
    retailPrice: "",
    active: true,
  });

  // Create Resale Listing Modal State
  const [isCreateResaleOpen, setIsCreateResaleOpen] = useState(false);
  const [authorizations, setAuthorizations] = useState<ActiveAuthorization[]>([]);
  const [selectedAuthId, setSelectedAuthId] = useState("");
  const [createResalePrice, setCreateResalePrice] = useState("");
  const [createResaleTitle, setCreateResaleTitle] = useState("");
  const [submittingResaleCreate, setSubmittingResaleCreate] = useState(false);

  // Product Details Modal
  const [detailsItem, setDetailsItem] = useState<UnifiedProduct | null>(null);

  // Delete Confirmation Modal
  const [deletingProduct, setDeletingProduct] = useState<UnifiedProduct | null>(null);

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

  useEffect(() => {
    void syncUser();
    return subscribeToAuthChanges(() => {
      void syncUser();
    });
  }, [syncUser]);

  const fetchUnifiedProducts = useCallback(async () => {
    if (!token) return;
    setDataLoading(true);
    try {
      const [ownedRes, resaleRes, reqRes] = await Promise.all([
        fetch("/api/products/seller/mine", { cache: "no-store" }).catch(() => null),
        fetch("/api/v1/seller/resale/listings?size=100", { cache: "no-store" }).catch(() => null),
        fetch("/api/products/change-requests/mine", { cache: "no-store" }).catch(() => null),
      ]);

      const unified: UnifiedProduct[] = [];

      // 1. Process Seller-Owned Products
      if (ownedRes && ownedRes.ok) {
        const ownedData = await ownedRes.json();
        (Array.isArray(ownedData) ? ownedData : []).forEach((p) => {
          unified.push({
            id: p.productID,
            sourceType: "SELLER_OWNED",
            title: p.productName,
            sku: p.sku,
            brand: p.brand,
            category: p.category,
            price: Number(p.productPrice ?? 0),
            frontImg: p.frontImg,
            backImg: p.backImg,
            sizes: Array.isArray(p.sizes) ? p.sizes : [],
            stockQuantity: p.stockQuantity ?? 0,
            remainingQuantity: p.stockQuantity ?? 0,
            active: p.active !== false,
            description: p.productReviews,
          });
        });
      }

      // 2. Process Supplier Resale Listings
      if (resaleRes && resaleRes.ok) {
        const resaleData = await resaleRes.json();
        const resaleItems = resaleData?.content || (Array.isArray(resaleData) ? resaleData : []);
        resaleItems.forEach((l: {
          id: string;
          customTitle?: string;
          supplierProductName?: string;
          supplierProductId: string;
          supplierDisplayName?: string;
          supplierWholesalePrice?: number;
          supplierSku?: string;
          retailPrice: number;
          supplierProductImage?: string;
          allocatedQuantity?: number;
          soldQuantity?: number;
          reservedQuantity?: number;
          remainingQuantity?: number;
          active?: boolean;
          authorizationId?: string;
        }) => {
          unified.push({
            id: l.id,
            sourceType: "SUPPLIER_RESALE",
            title: l.customTitle || l.supplierProductName || l.supplierProductId,
            originalProductName: l.supplierProductName,
            supplierProductId: l.supplierProductId,
            supplierName: l.supplierDisplayName || "Supplier",
            wholesalePrice: l.supplierWholesalePrice,
            sku: l.supplierSku,
            price: Number(l.retailPrice ?? 0),
            frontImg: l.supplierProductImage,
            stockQuantity: l.remainingQuantity ?? 0,
            allocatedQuantity: l.allocatedQuantity,
            soldQuantity: l.soldQuantity,
            reservedQuantity: l.reservedQuantity,
            remainingQuantity: l.remainingQuantity,
            active: l.active !== false,
            authorizationId: l.authorizationId,
          });
        });
      }

      setItems(unified);

      // 3. Process Change Requests
      if (reqRes && reqRes.ok) {
        const reqData = await reqRes.json();
        setRequests(Array.isArray(reqData) ? reqData : []);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setDataLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!loading) {
      void fetchUnifiedProducts();
    }
  }, [fetchUnifiedProducts, loading]);

  // Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [items]);

  // Filtering
  const filteredProducts = useMemo(() => {
    let result = items;
    if (sourceFilter !== "ALL") {
      result = result.filter((p) => p.sourceType === sourceFilter);
    }
    if (categoryFilter !== "ALL") {
      result = result.filter((p) => p.category === categoryFilter);
    }
    if (statusFilter === "ACTIVE") {
      result = result.filter((p) => p.active);
    } else if (statusFilter === "INACTIVE") {
      result = result.filter((p) => !p.active);
    } else if (statusFilter === "LOW_STOCK") {
      result = result.filter((p) => (p.remainingQuantity ?? p.stockQuantity) <= 5);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.supplierName && p.supplierName.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, sourceFilter, categoryFilter, statusFilter, searchQuery]);

  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE) || 1;
  const paginatedProducts = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, currentPage]);

  // Owned Product Form Handlers
  const handleOwnedFormChange = (field: keyof ProductFormState, value: unknown) => {
    setOwnedForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSize = (size: string) => {
    setOwnedForm((prev) => {
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
      toast.error("Please select an image file");
      return;
    }
    try {
      if (field === "frontImg") setUploadingFront(true);
      if (field === "backImg") setUploadingBack(true);
      const dataUrl = await fileToDataUrl(file);
      setOwnedForm((prev) => ({ ...prev, [field]: dataUrl }));
      toast.success(`${field === "frontImg" ? "Front" : "Back"} image uploaded`);
    } catch {
      toast.error("Failed to read image");
    } finally {
      if (field === "frontImg") setUploadingFront(false);
      if (field === "backImg") setUploadingBack(false);
      event.target.value = "";
    }
  };

  const openCreateOwned = () => {
    setEditingOwnedId(null);
    setOwnedForm({
      ...INITIAL_FORM,
      productID: `SEL-${Date.now().toString().slice(-6)}`,
    });
    setIsOwnedComposerOpen(true);
  };

  const openEditOwned = (p: UnifiedProduct) => {
    setEditingOwnedId(p.id);
    setOwnedForm({
      productID: p.id,
      productName: p.title,
      sku: p.sku || "",
      brand: p.brand || "",
      category: p.category || "",
      productPrice: String(p.price),
      productReviews: p.description || "",
      frontImg: p.frontImg || "",
      backImg: p.backImg || "",
      stockQuantity: String(p.stockQuantity),
      sizes: p.sizes || [],
      active: p.active,
    });
    setIsOwnedComposerOpen(true);
  };

  const handleSaveOwnedProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownedForm.productID.trim() || !ownedForm.productName.trim() || !ownedForm.category.trim()) {
      toast.error("ID, Name, and Category are required");
      return;
    }
    const priceNum = parseFloat(ownedForm.productPrice);
    if (!priceNum || priceNum <= 0) {
      toast.error("Price must be a positive number");
      return;
    }
    const stockNum = parseInt(ownedForm.stockQuantity, 10);
    if (isNaN(stockNum) || stockNum < 0) {
      toast.error("Stock quantity cannot be negative");
      return;
    }

    setSavingOwned(true);
    try {
      const isCreate = editingOwnedId === null;
      const res = await fetch("/api/auth/admin-products", {
        method: isCreate ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productID: ownedForm.productID.trim(),
          productName: ownedForm.productName.trim(),
          sku: ownedForm.sku.trim() || undefined,
          brand: ownedForm.brand.trim() || undefined,
          category: ownedForm.category.trim(),
          productPrice: priceNum,
          productReviews: ownedForm.productReviews.trim() || undefined,
          frontImg: ownedForm.frontImg.trim() || undefined,
          backImg: ownedForm.backImg.trim() || undefined,
          stockQuantity: stockNum,
          sizes: ownedForm.sizes,
          active: ownedForm.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed to save product");

      toast.success(
        isCreate
          ? "Seller-owned product submitted for Admin approval!"
          : "Product update submitted for Admin review!"
      );
      setIsOwnedComposerOpen(false);
      await fetchUnifiedProducts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingOwned(false);
    }
  };

  // Resale Listing Editing
  const openEditResale = (p: UnifiedProduct) => {
    setResaleEditItem(p);
    setResaleEditForm({
      listingId: p.id,
      customTitle: p.title !== p.originalProductName ? p.title : "",
      retailPrice: String(p.price),
      active: p.active,
    });
  };

  const handleSaveResaleListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resaleEditItem) return;
    const priceNum = parseFloat(resaleEditForm.retailPrice);
    if (!priceNum || priceNum <= 0) {
      toast.error("Please enter a valid retail price");
      return;
    }

    setSavingResale(true);
    try {
      const res = await fetch(`/api/v1/seller/resale/listings/${resaleEditItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retailPrice: priceNum,
          customTitle: resaleEditForm.customTitle.trim() || undefined,
          active: resaleEditForm.active,
        }),
      });
      if (!res.ok) throw new Error("Could not update listing");
      toast.success("Resale listing updated successfully");
      setResaleEditItem(null);
      await fetchUnifiedProducts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingResale(false);
    }
  };

  // Open Create Resale Listing Modal
  const openCreateResaleModal = async () => {
    setIsCreateResaleOpen(true);
    try {
      const res = await fetch("/api/v1/seller/resale/authorizations?activeOnly=true&size=100", {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) {
        const authList: ActiveAuthorization[] = data?.content || [];
        const existingAuthIds = new Set(items.map((i) => i.authorizationId).filter(Boolean));
        const unlisted = authList.filter((a) => !existingAuthIds.has(a.id));
        setAuthorizations(unlisted);
        if (unlisted.length > 0) {
          setSelectedAuthId(unlisted[0].id);
          setCreateResalePrice(
            unlisted[0].supplierProductPrice ? String(unlisted[0].supplierProductPrice * 1.25) : "29.99"
          );
        }
      }
    } catch {
      toast.error("Could not load authorized partnerships");
    }
  };

  const handleCreateResaleListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAuthId) {
      toast.error("Please select an authorized Supplier product");
      return;
    }
    const priceNum = parseFloat(createResalePrice);
    if (!priceNum || priceNum <= 0) {
      toast.error("Please enter a valid retail price");
      return;
    }

    setSubmittingResaleCreate(true);
    try {
      const res = await fetch("/api/v1/seller/resale/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorizationId: selectedAuthId,
          customTitle: createResaleTitle.trim() || undefined,
          retailPrice: priceNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to create listing");
      toast.success("Listing created and published to storefront!");
      setIsCreateResaleOpen(false);
      setCreateResalePrice("");
      setCreateResaleTitle("");
      await fetchUnifiedProducts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Creation failed");
    } finally {
      setSubmittingResaleCreate(false);
    }
  };

  // Toggle Visibility Quick Action
  const toggleVisibility = async (p: UnifiedProduct) => {
    const nextActive = !p.active;
    try {
      if (p.sourceType === "SUPPLIER_RESALE") {
        await fetch(`/api/v1/seller/resale/listings/${p.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ retailPrice: p.price, active: nextActive }),
        });
      } else {
        await fetch("/api/auth/admin-products", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productID: p.id, active: nextActive }),
        });
      }
      toast.success(nextActive ? "Product visible on store" : "Product hidden from store");
      await fetchUnifiedProducts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Visibility change failed");
    }
  };

  // Delete product action (for owned items)
  const confirmDeleteProduct = async () => {
    if (!deletingProduct) return;
    try {
      const res = await fetch("/api/auth/admin-products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productID: deletingProduct.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to submit deletion");
      toast.success("Deletion request submitted for Admin review");
      setDeletingProduct(null);
      await fetchUnifiedProducts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  // Bulk visibility change
  const executeBulkVisibility = async (activate: boolean) => {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all(
        selectedIds.map((id) => {
          const item = items.find((i) => i.id === id);
          if (!item) return Promise.resolve();
          if (item.sourceType === "SUPPLIER_RESALE") {
            return fetch(`/api/v1/seller/resale/listings/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ retailPrice: item.price, active: activate }),
            });
          } else {
            return fetch("/api/auth/admin-products", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productID: id, active: activate }),
            });
          }
        })
      );
      toast.success(`Updated visibility for ${selectedIds.length} products`);
      setSelectedIds([]);
      await fetchUnifiedProducts();
    } catch {
      toast.error("Bulk action failed partially");
    } finally {
      setBulkBusy(false);
    }
  };

  // Resubmit a change request
  const handleResubmit = async (requestId: string) => {
    setResubmittingId(requestId);
    try {
      const res = await fetch(`/api/products/change-requests/${encodeURIComponent(requestId)}/resubmit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to resubmit request");
      toast.success("Change request resubmitted for Admin review!");
      await fetchUnifiedProducts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Resubmit failed");
    } finally {
      setResubmittingId(null);
    }
  };

  const ownedCount = useMemo(() => items.filter((i) => i.sourceType === "SELLER_OWNED").length, [items]);
  const resaleCount = useMemo(() => items.filter((i) => i.sourceType === "SUPPLIER_RESALE").length, [items]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Seller Product Hub</h1>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void fetchUnifiedProducts()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition"
          >
            <RotateCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            type="button"
            onClick={openCreateOwned}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" /> Add Owned Product
          </button>
          <button
            type="button"
            onClick={() => void openCreateResaleModal()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg shadow-sm hover:bg-emerald-100 transition"
          >
            <Store className="w-4 h-4" /> Create Resale Listing
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("products")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === "products"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>My Storefront Catalog ({items.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("requests")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === "requests"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Moderation Requests ({requests.length})</span>
        </button>
      </div>

      {activeTab === "products" ? (
        <>
          {/* Source Banner & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => {
                setSourceFilter("ALL");
                setCurrentPage(0);
              }}
              className={`rounded-xl border p-4 text-left transition ${
                sourceFilter === "ALL"
                  ? "border-indigo-600 bg-indigo-50/40 shadow-xs"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">All Offerings</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{items.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Owned products + Resale listings</div>
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceFilter("SELLER_OWNED");
                setCurrentPage(0);
              }}
              className={`rounded-xl border p-4 text-left transition ${
                sourceFilter === "SELLER_OWNED"
                  ? "border-indigo-600 bg-indigo-50/40 shadow-xs"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Seller Owned</div>
              <div className="mt-1 text-2xl font-bold text-indigo-900">{ownedCount}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Self-managed stock & media</div>
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceFilter("SUPPLIER_RESALE");
                setCurrentPage(0);
              }}
              className={`rounded-xl border p-4 text-left transition ${
                sourceFilter === "SUPPLIER_RESALE"
                  ? "border-emerald-600 bg-emerald-50/40 shadow-xs"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Supplier Resale</div>
              <div className="mt-1 text-2xl font-bold text-emerald-900">{resaleCount}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Backed by Supplier allocations</div>
            </button>
          </div>

          {/* Search, Filter Toolbar & Bulk Actions */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search products by title, SKU, brand, supplier..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(0);
                  }}
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-4 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

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
                  Hidden
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("LOW_STOCK");
                    setCurrentPage(0);
                  }}
                  className={`px-3 py-1 rounded-md font-medium transition ${
                    statusFilter === "LOW_STOCK" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Low Stock (&le;5)
                </button>
              </div>
            </div>

            {/* Bulk Toolbar */}
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 bg-indigo-50/80 px-3 py-1.5 rounded-lg border border-indigo-200">
                <span className="text-xs font-semibold text-indigo-900">{selectedIds.length} selected:</span>
                <button
                  type="button"
                  onClick={() => void executeBulkVisibility(true)}
                  disabled={bulkBusy}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 transition"
                >
                  Activate
                </button>
                <button
                  type="button"
                  onClick={() => void executeBulkVisibility(false)}
                  disabled={bulkBusy}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-white text-slate-700 border border-slate-300 rounded hover:bg-slate-50 transition"
                >
                  Hide
                </button>
              </div>
            )}
          </div>

          {/* Catalog Data Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {dataLoading ? (
              <div className="p-12 text-center text-slate-400 text-sm">Loading storefront offerings...</div>
            ) : paginatedProducts.length === 0 ? (
              <div className="p-12 text-center">
                <Store className="mx-auto h-10 w-10 text-slate-300" />
                <h3 className="mt-2 text-sm font-semibold text-slate-700">No products found</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {items.length === 0
                    ? "Add your own products or discover Supplier products to begin selling."
                    : "No products match your search or filter."}
                </p>
                {items.length === 0 && (
                  <div className="mt-4 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={openCreateOwned}
                      className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 transition"
                    >
                      Add Owned Product
                    </button>
                    <Link
                      href="/seller/supplier-catalog"
                      className="px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition"
                    >
                      Discover Supplier Products
                    </Link>
                  </div>
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
                            paginatedProducts.length > 0 &&
                            paginatedProducts.every((p) => selectedIds.includes(p.id))
                          }
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds(paginatedProducts.map((p) => p.id));
                            else setSelectedIds([]);
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="py-3 px-3">Product Offering</th>
                      <th className="py-3 px-3">Product Source</th>
                      <th className="py-3 px-3 text-right">Selling Price</th>
                      <th className="py-3 px-3 text-center">Allocated</th>
                      <th className="py-3 px-3 text-center">Sold / Res</th>
                      <th className="py-3 px-3 text-center">Sellable Units</th>
                      <th className="py-3 px-3 text-center">Storefront Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedProducts.map((product) => {
                      const isSelected = selectedIds.includes(product.id);
                      const isResale = product.sourceType === "SUPPLIER_RESALE";
                      const remaining = product.remainingQuantity ?? product.stockQuantity;
                      const isOut = remaining <= 0;
                      const isLow = !isOut && remaining <= 5;

                      return (
                        <tr
                          key={product.id}
                          className={`hover:bg-slate-50/50 transition ${isSelected ? "bg-indigo-50/30" : ""}`}
                        >
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                setSelectedIds((prev) =>
                                  prev.includes(product.id)
                                    ? prev.filter((id) => id !== product.id)
                                    : [...prev, product.id]
                                )
                              }
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={resolveImage(product.frontImg)}
                                alt={product.title}
                                className="w-10 h-10 object-cover rounded-lg border border-slate-200 bg-slate-50"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                                }}
                              />
                              <div>
                                <div className="font-semibold text-slate-900">{product.title}</div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {isResale ? `Listing: ${product.id}` : `ID: ${product.id}`}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {isResale ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <Handshake className="w-3 h-3" /> Resale · {product.supplierName || "Supplier"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                <Package className="w-3 h-3" /> Seller Owned
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900 text-sm">
                            ${Number(product.price).toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-800">
                            {isResale ? product.allocatedQuantity ?? "—" : product.stockQuantity}
                          </td>
                          <td className="py-3 px-3 text-center text-slate-500 font-medium">
                            {isResale ? (
                              <span>
                                {product.soldQuantity ?? 0} <span className="text-slate-300">/</span>{" "}
                                {product.reservedQuantity ?? 0}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-xs ${
                                isOut
                                  ? "bg-rose-100 text-rose-800"
                                  : isLow
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {remaining}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                product.active
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {product.active ? "Active" : "Hidden"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDetailsItem(product)}
                                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                                title="View Product Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => (isResale ? openEditResale(product) : openEditOwned(product))}
                                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"
                                title="Edit Product"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void toggleVisibility(product)}
                                className={`px-2 py-1 rounded text-[11px] font-semibold border transition ${
                                  product.active
                                    ? "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    : "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                                }`}
                              >
                                {product.active ? "Hide" : "Show"}
                              </button>
                              {!isResale && (
                                <button
                                  type="button"
                                  onClick={() => setDeletingProduct(product)}
                                  className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition"
                                  title="Delete Product"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
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
            {filteredProducts.length > PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
                <div className="text-xs text-slate-500">
                  Showing <span className="font-semibold">{currentPage * PAGE_SIZE + 1}</span> to{" "}
                  <span className="font-semibold">
                    {Math.min((currentPage + 1) * PAGE_SIZE, filteredProducts.length)}
                  </span>{" "}
                  of <span className="font-semibold">{filteredProducts.length}</span> products
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
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {requests.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">No moderation requests submitted yet.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Product ID</th>
                  <th className="py-3 px-4">Date Submitted</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Reviewer Note</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{r.actionType}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{r.targetProductId || "New Product"}</td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          r.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700"
                            : r.status === "CHANGES_REQUESTED"
                            ? "bg-amber-50 text-amber-700"
                            : r.status === "REJECTED"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {r.reviewerNote ? (
                        <div className="bg-amber-50/70 p-2 rounded text-slate-800 border border-amber-200/60 max-w-md">
                          {r.reviewerNote}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No notes</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {r.status === "CHANGES_REQUESTED" && (
                        <button
                          type="button"
                          onClick={() => void handleResubmit(r.id)}
                          disabled={resubmittingId === r.id}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shadow-xs disabled:opacity-50"
                        >
                          {resubmittingId === r.id ? "Resubmitting..." : "Resubmit"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Owned Product Composer Modal (Create & Edit) */}
      {isOwnedComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl my-8 rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingOwnedId ? `Edit Owned Product: ${editingOwnedId}` : "Create Seller-Owned Product"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Directly owned product inventory managed by your seller store.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOwnedComposerOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOwnedProduct} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Product ID *</label>
                  <input
                    type="text"
                    required
                    disabled={editingOwnedId !== null}
                    value={ownedForm.productID}
                    onChange={(e) => handleOwnedFormChange("productID", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 disabled:bg-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={ownedForm.productName}
                    onChange={(e) => handleOwnedFormChange("productName", e.target.value)}
                    placeholder="e.g. Leather Travel Backpack"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Category *</label>
                  <input
                    type="text"
                    required
                    value={ownedForm.category}
                    onChange={(e) => handleOwnedFormChange("category", e.target.value)}
                    placeholder="e.g. Accessories"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Brand</label>
                  <input
                    type="text"
                    value={ownedForm.brand}
                    onChange={(e) => handleOwnedFormChange("brand", e.target.value)}
                    placeholder="e.g. Handmade Store"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Selling Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={ownedForm.productPrice}
                    onChange={(e) => handleOwnedFormChange("productPrice", e.target.value)}
                    placeholder="49.99"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Available Stock Qty *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={ownedForm.stockQuantity}
                    onChange={(e) => handleOwnedFormChange("stockQuantity", e.target.value)}
                    placeholder="25"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Clothing Sizes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Variants / Sizing</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {CLOTHING_SIZE_OPTIONS.map((size) => {
                    const selected = ownedForm.sizes.includes(size);
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => toggleSize(size)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold border transition ${
                          selected
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Images */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">Front Image</label>
                  <input
                    type="text"
                    value={ownedForm.frontImg}
                    onChange={(e) => handleOwnedFormChange("frontImg", e.target.value)}
                    placeholder="URL or upload"
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
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
                    {ownedForm.frontImg && (
                      <button
                        type="button"
                        onClick={() => handleOwnedFormChange("frontImg", "")}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {ownedForm.frontImg && (
                    <img
                      src={resolveImage(ownedForm.frontImg)}
                      alt="Front preview"
                      className="w-full h-20 object-contain rounded border border-slate-200 bg-slate-50 mt-1"
                    />
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">Back Image</label>
                  <input
                    type="text"
                    value={ownedForm.backImg}
                    onChange={(e) => handleOwnedFormChange("backImg", e.target.value)}
                    placeholder="URL or upload"
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
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
                    {ownedForm.backImg && (
                      <button
                        type="button"
                        onClick={() => handleOwnedFormChange("backImg", "")}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {ownedForm.backImg && (
                    <img
                      src={resolveImage(ownedForm.backImg)}
                      alt="Back preview"
                      className="w-full h-20 object-contain rounded border border-slate-200 bg-slate-50 mt-1"
                    />
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">Description / Presentation</label>
                <textarea
                  rows={3}
                  value={ownedForm.productReviews}
                  onChange={(e) => handleOwnedFormChange("productReviews", e.target.value)}
                  placeholder="Product description, features, materials..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-700">Activate on Storefront Upon Approval</span>
                <input
                  type="checkbox"
                  checked={ownedForm.active}
                  onChange={(e) => handleOwnedFormChange("active", e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOwnedComposerOpen(false)}
                  disabled={savingOwned}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOwned}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {savingOwned ? "Submitting..." : editingOwnedId ? "Submit Update" : "Submit for Approval"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Resale Listing Modal */}
      {resaleEditItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit Resale Listing</h3>
                <p className="text-xs text-slate-500 mt-0.5">Supplier: {resaleEditItem.supplierName}</p>
              </div>
              <button
                type="button"
                onClick={() => setResaleEditItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Protected Supplier Information */}
            <div className="rounded-xl bg-amber-50/70 p-3.5 border border-amber-200/80 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Protected Supplier Information</span>
              </div>
              <div className="text-[11px] text-amber-800 space-y-0.5 pt-1">
                <div>Original Product: <span className="font-semibold">{resaleEditItem.originalProductName || resaleEditItem.title}</span></div>
                <div>Wholesale Price: <span className="font-semibold">${resaleEditItem.wholesalePrice ?? "—"}</span></div>
                <div>Allocated Inventory: <span className="font-semibold">{resaleEditItem.allocatedQuantity ?? "—"} units</span></div>
              </div>
            </div>

            <form onSubmit={handleSaveResaleListing} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Storefront Retail Selling Price ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={resaleEditForm.retailPrice}
                  onChange={(e) =>
                    setResaleEditForm((prev) => ({ ...prev, retailPrice: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Custom Presentation Title <span className="text-slate-400 font-normal">(optional override)</span>
                </label>
                <input
                  type="text"
                  value={resaleEditForm.customTitle}
                  onChange={(e) =>
                    setResaleEditForm((prev) => ({ ...prev, customTitle: e.target.value }))
                  }
                  placeholder={resaleEditItem.originalProductName || "Leave blank to use supplier name"}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 border border-slate-200">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Storefront Visibility</div>
                  <div className="text-[11px] text-slate-500">Allow customers to purchase from your store</div>
                </div>
                <input
                  type="checkbox"
                  checked={resaleEditForm.active}
                  onChange={(e) =>
                    setResaleEditForm((prev) => ({ ...prev, active: e.target.checked }))
                  }
                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResaleEditItem(null)}
                  disabled={savingResale}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingResale}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {savingResale ? "Saving..." : "Save Listing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Resale Listing Modal */}
      {isCreateResaleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Publish Resale Listing</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select an approved Supplier product to activate in your storefront.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateResaleOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {authorizations.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <Store className="mx-auto h-8 w-8 text-slate-300" />
                <p className="text-xs text-slate-600">
                  No unlisted authorized products available. All your approved partnerships already have active listings.
                </p>
                <Link
                  href="/seller/supplier-catalog"
                  className="inline-block px-4 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition"
                >
                  Discover More Supplier Products
                </Link>
              </div>
            ) : (
              <form onSubmit={handleCreateResaleListing} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Approved Supplier Product
                  </label>
                  <select
                    value={selectedAuthId}
                    onChange={(e) => {
                      setSelectedAuthId(e.target.value);
                      const chosen = authorizations.find((a) => a.id === e.target.value);
                      if (chosen?.supplierProductPrice) {
                        setCreateResalePrice(String(chosen.supplierProductPrice * 1.25));
                      }
                    }}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                  >
                    {authorizations.map((auth) => (
                      <option key={auth.id} value={auth.id}>
                        {auth.supplierProductName || auth.supplierProductId} — Allocation:{" "}
                        {auth.initialAllocationQuantity ?? "MOQ"} units (Wholesale: ${auth.supplierProductPrice ?? "—"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Retail Selling Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={createResalePrice}
                    onChange={(e) => setCreateResalePrice(e.target.value)}
                    placeholder="e.g. 49.99"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Custom Storefront Title <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={createResaleTitle}
                    onChange={(e) => setCreateResaleTitle(e.target.value)}
                    placeholder="Leave blank to use original product title"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateResaleOpen(false)}
                    disabled={submittingResaleCreate}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingResaleCreate}
                    className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
                  >
                    {submittingResaleCreate ? "Publishing..." : "Publish Listing"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Product Details Modal */}
      {detailsItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{detailsItem.title}</h3>
                <span className="text-xs text-slate-400 font-mono">ID: {detailsItem.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setDetailsItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Product Source Header */}
              <div
                className={`rounded-xl p-3.5 border ${
                  detailsItem.sourceType === "SUPPLIER_RESALE"
                    ? "bg-emerald-50/50 border-emerald-200"
                    : "bg-indigo-50/50 border-indigo-200"
                }`}
              >
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {detailsItem.sourceType === "SUPPLIER_RESALE"
                    ? `Supplier Resale · Provided by ${detailsItem.supplierName || "Supplier"}`
                    : "Seller-Owned Independent Product"}
                </div>
                {detailsItem.sourceType === "SUPPLIER_RESALE" && (
                  <div className="text-xs text-slate-600 mt-1">
                    Original Product ID: <span className="font-mono">{detailsItem.supplierProductId}</span> · Wholesale Price:{" "}
                    <span className="font-semibold">${detailsItem.wholesalePrice ?? "—"}</span>
                  </div>
                )}
              </div>

              {/* Media Preview */}
              <div className="grid grid-cols-2 gap-3">
                <img
                  src={resolveImage(detailsItem.frontImg)}
                  alt="Front view"
                  className="w-full h-32 object-contain rounded-lg border border-slate-200 bg-slate-50"
                />
                {detailsItem.backImg ? (
                  <img
                    src={resolveImage(detailsItem.backImg)}
                    alt="Back view"
                    className="w-full h-32 object-contain rounded-lg border border-slate-200 bg-slate-50"
                  />
                ) : (
                  <div className="w-full h-32 flex items-center justify-center text-xs text-slate-400 border border-dashed rounded-lg">
                    No back image
                  </div>
                )}
              </div>

              {/* Inventory & Allocation Breakdown */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Inventory & Stock Health
                </div>
                {detailsItem.sourceType === "SUPPLIER_RESALE" ? (
                  <div className="grid grid-cols-4 gap-2 text-center pt-1">
                    <div className="rounded-lg bg-slate-50 p-2">
                      <div className="text-[10px] text-slate-400">Allocated</div>
                      <div className="text-base font-bold text-slate-900">{detailsItem.allocatedQuantity ?? "—"}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <div className="text-[10px] text-emerald-600">Sold</div>
                      <div className="text-base font-bold text-emerald-700">{detailsItem.soldQuantity ?? 0}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <div className="text-[10px] text-amber-600">Reserved</div>
                      <div className="text-base font-bold text-amber-700">{detailsItem.reservedQuantity ?? 0}</div>
                    </div>
                    <div className="rounded-lg bg-indigo-50 p-2">
                      <div className="text-[10px] text-indigo-700 font-semibold">Sellable</div>
                      <div className="text-base font-bold text-indigo-700">{detailsItem.remainingQuantity ?? "—"}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">Available Owned Stock:</span>
                    <span className="font-bold text-slate-900 text-sm">{detailsItem.stockQuantity} units</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDetailsItem(null)}
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
              <span className="font-bold text-slate-900">{deletingProduct.title}</span> (ID: {deletingProduct.id})?
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
