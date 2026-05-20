"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { FiHeart, FiThumbsUp, FiThumbsDown, FiMessageCircle, FiEdit2, FiTrash2 } from "react-icons/fi";
import { FaStar, FaRegStar, FaCartPlus } from "react-icons/fa";
import { IoFilterSharp, IoClose } from "react-icons/io5";
import { FaAngleRight, FaAngleLeft } from "react-icons/fa6";

import { RootState, useAppDispatch, useAppSelector } from "@/store/index";
import { addToCartAsync, updateQuantityAsync } from "@/store/cartSlice";
import {
  addToWishlistAsync,
  removeFromWishlistAsync,
  wishListProduct} from "@/store/wishListSlice";
import { getToken, getUser, isAuthenticated } from "@/lib/auth";
import { DataStore } from "@/data/StoreData";
import { useProducts } from "@/hooks/useProducts";
import { createPortal } from "react-dom";

import Filter, { ShopFiltersState } from "./Filters/Filter";
import AuthRequiredModal from "@/components/Common/AuthRequiredModal";
import { useLocale } from "@/components/providers/LocaleProvider";
import "./Shop.css";

const FALLBACK_PRODUCT_IMAGE = "/Products/product_1.jpg";
const ITEMS_PER_PAGE = 6;
const PRODUCT_DESCRIPTION_STORAGE_KEY = "shop-product-descriptions";
const REVIEW_INTERACTIONS_STORAGE_KEY = "shop-review-interactions";
const DEFAULT_CLOTHING_SIZES = ["XS", "S", "M", "L", "XL"];

type ProductReview = {
  id: string;
  rating: number;
  comment: string;
  author: string;
  createdAt: string;
  dislikes?: number;
  likes?: number;
  likedByCurrentUser?: boolean;
  replies?: ReviewReply[];
  ownedByCurrentUser?: boolean;
};

type ReviewReply = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
};

type ProductReviewSummary = {
  productID: string;
  averageRating: number;
  reviewCount: number;
  reviews: ProductReview[];
};
type SortOption =
  | "default"
  | "featured"
  | "bestSelling"
  | "a-z"
  | "z-a"
  | "lowToHigh"
  | "highToLow"
  | "oldToNew"
  | "newToOld";

function normalizeAuthorizationHeader(token: string | null): string | null {
  const trimmed = (token ?? "").trim();
  if (!trimmed) {
    return null;
  }
  return /^bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

function resolveProductImage(src?: string | null): string {
  const value = String(src ?? "").trim();
  if (!value) {
    return FALLBACK_PRODUCT_IMAGE;
  }
  if (
    /^https?:\/\//i.test(value) ||
    value.startsWith("/Products/") ||
    value.startsWith("/uploads/") ||
    value.startsWith("/images/")
  ) {
    return value;
  }
  return FALLBACK_PRODUCT_IMAGE;
}

function extractReviewNumber(value: string | undefined): number {
  const numberMatch = String(value ?? "").match(/\d+/);
  return numberMatch ? Number(numberMatch[0]) : 0;
}

function getPriceChangeInfo(product: DataStore) {
  const oldPrice = Number(product.oldPrice ?? 0);
  const newPrice = Number(product.productPrice ?? 0);
  if (!Number.isFinite(oldPrice) || !Number.isFinite(newPrice) || oldPrice <= 0 || newPrice <= 0) {
    return null;
  }
  const delta = ((newPrice - oldPrice) / oldPrice) * 100;
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) {
    return null;
  }
  return {
    oldPrice,
    newPrice,
    delta,
    label: `${delta > 0 ? "+" : ""}${Math.round(delta)}%`,
    className: delta > 0 ? "priceChangeBadgeUp" : "priceChangeBadgeDown"};
}

function resolveReviewInteractionActorKey(): string {
  const user = getUser();
  if (!user) {
    return "guest";
  }

  const rawIdentity = String(user.id ?? user.email ?? user.username ?? "")
    .trim()
    .toLowerCase();

  if (!rawIdentity) {
    return "user:unknown";
  }

  return `user:${rawIdentity}`;
}

function buildReviewInteractionKey(productID: string, reviewID: string, actorKey: string): string {
  return `${actorKey}:${productID}:${reviewID}`;
}

export default function Shop() {
  const { t } = useLocale();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = (searchParams.get("q") ?? "").trim();
  const categoryParam = (searchParams.get("category") ?? "").trim();
  const categoryQuery = categoryParam.toLowerCase();
  const focusProductId = (searchParams.get("focus") ?? "").trim();
  const { products, loading, error } = useProducts(searchQuery);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<DataStore | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [productDescriptions, setProductDescriptions] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") {
      return {};
    }
    try {
      const raw = window.localStorage.getItem(PRODUCT_DESCRIPTION_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });
  const [productReviewsById, setProductReviewsById] = useState<Record<string, ProductReview[]>>(
    {}
  );
  const [reviewStatsById, setReviewStatsById] = useState<
    Record<string, { averageRating: number; reviewCount: number }>
  >({});
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [reviewRatingDraft, setReviewRatingDraft] = useState(5);
  const [reviewCommentDraft, setReviewCommentDraft] = useState("");
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [reviewEditRatingDraft, setReviewEditRatingDraft] = useState(5);
  const [reviewEditCommentDraft, setReviewEditCommentDraft] = useState("");
  const [showAuthRequiredModal, setShowAuthRequiredModal] = useState(false);
  const [buyNowProductId, setBuyNowProductId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [replyDraftByReviewId, setReplyDraftByReviewId] = useState<Record<string, string>>({});
  const [activeReplyReviewId, setActiveReplyReviewId] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [filters, setFilters] = useState<ShopFiltersState>({
    categories: [],
    colors: [],
    sizes: [],
    brands: [],
    priceRange: [0, 300]});

  const cartItems = useAppSelector((state: RootState) => state.cart.itemsById);
  const wishListItems = useAppSelector((state) => state.wishList.itemsById);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (products.length === 0) return;
    const prices = products.map((item) => Number(item.productPrice || 0)).filter(Number.isFinite);
    if (prices.length === 0) return;
    const minPrice = Math.floor(Math.min(...prices));
    const maxPrice = Math.ceil(Math.max(...prices));
    setFilters((prev) => {
      const nextMin = Math.max(minPrice, prev.priceRange[0]);
      const nextMax = Math.min(maxPrice, prev.priceRange[1]);
      return {
        ...prev,
        priceRange: nextMin <= nextMax ? [nextMin, nextMax] : [minPrice, maxPrice]};
    });
  }, [products]);

  const resolveAvailableStock = (product: DataStore) =>
    product.active === false ? 0 : Number(product.stockQuantity ?? 25);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleDrawer = () => {
    setIsDrawerOpen((prev) => !prev);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
  };

  const openProductModal = (product: DataStore) => {
    setSelectedProduct(product);
    setSelectedSize(product.sizes?.[0] ?? "");
    setDescriptionDraft(productDescriptions[product.productID] ?? "");
    setReviewRatingDraft(5);
    setReviewCommentDraft("");
    void loadProductReviews(product.productID);
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
    setSelectedSize("");
    setEditingReviewId(null);
    setReviewEditCommentDraft("");
    setReviewEditRatingDraft(5);
  };

  const resolveProductSizes = (product: DataStore) => {
    const sizes = Array.isArray(product.sizes)
      ? product.sizes.map((size) => String(size ?? "").trim()).filter(Boolean)
      : [];
    return sizes.length > 0 ? sizes : DEFAULT_CLOTHING_SIZES;
  };

  const handleSaveDescription = () => {
    if (!selectedProduct) {
      return;
    }
    setProductDescriptions((prev) => ({
      ...prev,
      [selectedProduct.productID]: descriptionDraft.trim()}));
    toast.success("Product description saved");
  };

  useEffect(() => {
    if (!isDrawerOpen && !selectedProduct) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDrawerOpen, selectedProduct]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      PRODUCT_DESCRIPTION_STORAGE_KEY,
      JSON.stringify(productDescriptions)
    );
  }, [productDescriptions]);



  useEffect(() => {
    if (!selectedProduct) {
      return;
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeProductModal();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [selectedProduct]);

  const handleAddToCart = (product: DataStore) => {
    if (!isAuthenticated()) {
      setShowAuthRequiredModal(true);
      return;
    }

    const productInCart = cartItems[product.productID];
    const availableStock = resolveAvailableStock(product);

    if (availableStock <= 0) {
      toast.error("This product is out of stock");
      return;
    }

    const limit = Math.min(20, availableStock);
    if (productInCart && (productInCart.quantity ?? 0) >= limit) {
      toast.error("Product limit reached", {
        duration: 2000,
        style: {
          backgroundColor: "#ff4b4b",
          color: "white"},
        iconTheme: {
          primary: "#fff",
          secondary: "#ff4b4b"}});
      return;
    }

    if (productInCart) {
      dispatch(
        updateQuantityAsync({
          productID: product.productID,
          quantity: (productInCart.quantity ?? 0) + 1})
      )
        .unwrap()
        .then(() => {
          toast.success("Added to cart!", {
            duration: 2000,
            style: {
              backgroundColor: "#07bc0c",
              color: "white"},
            iconTheme: {
              primary: "#fff",
              secondary: "#07bc0c"}});
        })
        .catch((err) => {
          toast.error(err?.toString?.() ?? "Failed to update cart");
        });
      return;
    }

    dispatch(
      addToCartAsync({
        productID: product.productID,
        productName: product.productName,
        productPrice: product.productPrice,
        productReviews: product.productReviews,
        stockQuantity: availableStock})
    )
      .unwrap()
      .then(() => {
        toast.success("Added to cart!", {
          duration: 2000,
          style: {
            backgroundColor: "#07bc0c",
            color: "white"},
          iconTheme: {
            primary: "#fff",
            secondary: "#07bc0c"}});
      })
      .catch((err) => {
        toast.error(err?.toString?.() ?? "Failed to add to cart");
      });
  };

  const handleWishlistClick = (product: wishListProduct) => {
    const isInWishList = Boolean(wishListItems[product.productID]);

    if (isInWishList) {
      dispatch(removeFromWishlistAsync(product.productID))
        .unwrap()
        .then(() => {
          toast.success("Removed from wish list", {
            duration: 2000,
            style: {
              backgroundColor: "#fb0404",
              color: "#fff"},
            iconTheme: {
              primary: "#fff",
              secondary: "#fb0404"}});
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          toast.error(message || "Failed to remove from wishlist");
        });
      return;
    }

    dispatch(addToWishlistAsync(product))
      .unwrap()
      .then(() => {
        toast.success("Added to wish list", {
          duration: 2000,
          style: {
            backgroundColor: "#07bc0c",
            color: "#fff"},
          iconTheme: {
            primary: "#fff",
            secondary: "#07bc0c"}});
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(message || "Failed to add to wishlist");
      });
  };

  const handleBuyNow = async (product: DataStore) => {
    if (!isAuthenticated()) {
      setShowAuthRequiredModal(true);
      return;
    }

    const availableStock = resolveAvailableStock(product);
    if (availableStock <= 0) {
      toast.error("This product is out of stock");
      return;
    }

    if (buyNowProductId) {
      return;
    }

    setBuyNowProductId(product.productID);
    try {
      const existing = cartItems[product.productID];
      if (!existing) {
        await dispatch(
          addToCartAsync({
            productID: product.productID,
            productName: product.productName,
            productPrice: product.productPrice,
            productReviews: product.productReviews,
            stockQuantity: availableStock})
        ).unwrap();
      }
      closeProductModal();
      router.push(
        `/cart?step=checkout&buyNow=${encodeURIComponent(product.productID)}&payment=vnpay`
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to place order";
      toast.error(message);
    } finally {
      setBuyNowProductId(null);
    }
  };

  const getProductReviews = (productID: string): ProductReview[] => productReviewsById[productID] ?? [];

  const getAverageRating = (productID: string): number => reviewStatsById[productID]?.averageRating ?? 5;

  const getReviewCount = (productID: string): number => reviewStatsById[productID]?.reviewCount ?? 0;

  const applyReviewSummary = (summary: ProductReviewSummary) => {
    setProductReviewsById((prev) => ({
      ...prev,
      [summary.productID]: Array.isArray(summary.reviews) ? summary.reviews : []}));
    setReviewStatsById((prev) => ({
      ...prev,
      [summary.productID]: {
        averageRating: Number(summary.averageRating ?? 0),
        reviewCount: Number(summary.reviewCount ?? 0)}}));
  };

  const loadProductReviews = async (productID: string) => {
    setIsLoadingReviews(true);
    try {
      const authorizationHeader = normalizeAuthorizationHeader(getToken());
      const response = await fetch(`/api/products/${encodeURIComponent(productID)}/reviews?limit=10`, {
        method: "GET",
        credentials: "include",
        headers: {        }});
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(data?.message || data?.error || "Failed to load reviews");
      }
      applyReviewSummary(data as ProductReviewSummary);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load reviews";
      toast.error(message);
    } finally {
      setIsLoadingReviews(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedProduct) {
      return;
    }

    const trimmedComment = reviewCommentDraft.trim();
    if (trimmedComment.length < 2) {
      toast.error("Please enter a comment");
      return;
    }

    const safeRating = Math.max(1, Math.min(5, reviewRatingDraft));
    const productID = selectedProduct.productID;

    try {
      const authorizationHeader = normalizeAuthorizationHeader(getToken());
      const response = await fetch(`/api/products/${encodeURIComponent(productID)}/reviews`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({
          rating: safeRating,
          comment: trimmedComment})});

      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(data?.message || data?.error || "Failed to submit review");
      }

      applyReviewSummary(data as ProductReviewSummary);
      setReviewCommentDraft("");
      setReviewRatingDraft(5);
      toast.success("Review submitted");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to submit review";
      toast.error(message);
    }
  };

  const beginEditReview = (review: ProductReview) => {
    setEditingReviewId(review.id);
    setReviewEditRatingDraft(Math.max(1, Math.min(5, Number(review.rating ?? 5))));
    setReviewEditCommentDraft(review.comment ?? "");
  };

  const cancelEditReview = () => {
    setEditingReviewId(null);
    setReviewEditCommentDraft("");
    setReviewEditRatingDraft(5);
  };

  const handleUpdateReview = async (reviewID: string) => {
    if (!selectedProduct) {
      return;
    }

    const trimmedComment = reviewEditCommentDraft.trim();
    if (trimmedComment.length < 2) {
      toast.error("Please enter a comment");
      return;
    }

    const safeRating = Math.max(1, Math.min(5, reviewEditRatingDraft));
    const productID = selectedProduct.productID;

    try {
      const authorizationHeader = normalizeAuthorizationHeader(getToken());
      const response = await fetch(
        `/api/products/${encodeURIComponent(productID)}/reviews/${encodeURIComponent(reviewID)}`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"},
          body: JSON.stringify({
            rating: safeRating,
            comment: trimmedComment})}
      );

      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(data?.message || data?.error || "Failed to update review");
      }

      applyReviewSummary(data as ProductReviewSummary);
      cancelEditReview();
      toast.success("Review updated");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update review";
      toast.error(message);
    }
  };

  const handleDeleteReview = async (reviewID: string) => {
    if (!selectedProduct) {
      return;
    }

    const productID = selectedProduct.productID;
    try {
      const authorizationHeader = normalizeAuthorizationHeader(getToken());
      const response = await fetch(
        `/api/products/${encodeURIComponent(productID)}/reviews/${encodeURIComponent(reviewID)}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {          }}
      );

      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(data?.message || data?.error || "Failed to delete review");
      }

      applyReviewSummary(data as ProductReviewSummary);
      if (editingReviewId === reviewID) {
        cancelEditReview();
      }
      toast.success("Review deleted");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete review";
      toast.error(message);
    }
  };

  const handleDislikeReview = async (reviewID: string) => {
    if (!selectedProduct) {
      return;
    }
    if (!isAuthenticated()) {
      setShowAuthRequiredModal(true);
      return;
    }

    const productID = selectedProduct.productID;
    try {
      const authorizationHeader = normalizeAuthorizationHeader(getToken());
      const response = await fetch(
        `/api/products/${encodeURIComponent(productID)}/reviews/${encodeURIComponent(reviewID)}/dislike`,
        {
          method: "POST",
          credentials: "include",
          headers: {          }}
      );

      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(data?.message || data?.error || "Failed to dislike review");
      }

      applyReviewSummary(data as ProductReviewSummary);
      toast.success("Review disliked");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to dislike review";
      toast.error(message);
    }
  };

  const formatReviewDateTime = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return "Just now";
    }
    return date.toLocaleString();
  };

  const toggleLikeReview = async (reviewID: string) => {
    if (!selectedProduct) {
      return;
    }
    if (!isAuthenticated()) {
      setShowAuthRequiredModal(true);
      return;
    }

    const productID = selectedProduct.productID;
    try {
      const authorizationHeader = normalizeAuthorizationHeader(getToken());
      const response = await fetch(
        `/api/products/${encodeURIComponent(productID)}/reviews/${encodeURIComponent(reviewID)}/like`,
        {
          method: "POST",
          credentials: "include",
          headers: {          }}
      );

      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(data?.message || data?.error || "Failed to like review");
      }

      applyReviewSummary(data as ProductReviewSummary);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to like review";
      toast.error(message);
    }
  };

  const toggleReplyDraft = (reviewID: string) => {
    if (!selectedProduct) {
      return;
    }
    if (!isAuthenticated()) {
      setShowAuthRequiredModal(true);
      return;
    }
    setActiveReplyReviewId((prev) => (prev === reviewID ? null : reviewID));
  };

  const handleReplyDraftChange = (reviewID: string, value: string) => {
    if (!selectedProduct) {
      return;
    }
    setReplyDraftByReviewId((prev) => ({
      ...prev,
      [reviewID]: value}));
  };

  const submitReply = async (reviewID: string) => {
    if (!selectedProduct) {
      return;
    }
    if (!isAuthenticated()) {
      setShowAuthRequiredModal(true);
      return;
    }

    const replyText = (replyDraftByReviewId[reviewID] ?? "").trim();
    if (replyText.length < 2) {
      toast.error("Please enter a reply");
      return;
    }

    const productID = selectedProduct.productID;
    try {
      const authorizationHeader = normalizeAuthorizationHeader(getToken());
      const response = await fetch(
        `/api/products/${encodeURIComponent(productID)}/reviews/${encodeURIComponent(reviewID)}/replies`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"},
          body: JSON.stringify({ content: replyText })}
      );

      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(data?.message || data?.error || "Failed to add reply");
      }

      applyReviewSummary(data as ProductReviewSummary);
      setReplyDraftByReviewId((prev) => ({
        ...prev,
        [reviewID]: ""}));
      setActiveReplyReviewId(null);
      toast.success("Reply added");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add reply";
      toast.error(message);
    }
  };

  const filteredProducts = useMemo(() => {
    const [minPrice, maxPrice] = filters.priceRange;
    return products.filter((item) => {
      const category = String(item.category ?? "").trim().toLowerCase();
      const sizeList = Array.isArray(item.sizes) ? item.sizes : [];
      const price = Number(item.productPrice ?? 0);

      if (categoryQuery && category !== categoryQuery) return false;
      if (filters.categories.length > 0 && !filters.categories.some((c) => c.trim().toLowerCase() === category)) return false;
      if (filters.sizes.length > 0 && !filters.sizes.some((size) => sizeList.includes(size))) return false;
      if (Number.isFinite(price) && (price < minPrice || price > maxPrice)) return false;
      return true;
    });
  }, [categoryQuery, filters, products]);

  const sortedProducts = useMemo(() => {
    const items = [...filteredProducts];
    switch (sortBy) {
      case "a-z":
        return items.sort((a, b) => a.productName.localeCompare(b.productName));
      case "z-a":
        return items.sort((a, b) => b.productName.localeCompare(a.productName));
      case "lowToHigh":
        return items.sort((a, b) => Number(a.productPrice) - Number(b.productPrice));
      case "highToLow":
        return items.sort((a, b) => Number(b.productPrice) - Number(a.productPrice));
      case "bestSelling":
        return items.sort(
          (a, b) => extractReviewNumber(b.productReviews) - extractReviewNumber(a.productReviews)
        );
      case "oldToNew":
        return items.sort((a, b) => a.productID.localeCompare(b.productID));
      case "newToOld":
        return items.sort((a, b) => b.productID.localeCompare(a.productID));
      case "featured":
      case "default":
      default:
        return items;
    }
  }, [filteredProducts, sortBy]);

  const availableCategories = useMemo(
    () => Array.from(new Set(products.map((p) => String(p.category ?? "").trim()).filter(Boolean))).sort(),
    [products]
  );
  const availableSizes = useMemo(
    () => Array.from(new Set(products.flatMap((p) => (Array.isArray(p.sizes) ? p.sizes : [])))).sort(),
    [products]
  );
  const priceBounds = useMemo(() => {
    const prices = products.map((p) => Number(p.productPrice ?? 0)).filter(Number.isFinite);
    if (prices.length === 0) return { minPrice: 0, maxPrice: 300 };
    return { minPrice: Math.floor(Math.min(...prices)), maxPrice: Math.ceil(Math.max(...prices)) };
  }, [products]);

  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / ITEMS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!focusProductId || sortedProducts.length === 0) {
      return;
    }

    const targetIndex = sortedProducts.findIndex((item) => item.productID === focusProductId);
    if (targetIndex < 0) {
      return;
    }
    setCurrentPage(Math.floor(targetIndex / ITEMS_PER_PAGE) + 1);
  }, [focusProductId, sortedProducts]);

  const productsToShow = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, sortedProducts]);
  const hasSuccessfulSearch = !loading && !error && Boolean(searchQuery) && sortedProducts.length > 0;

  const visibleStart = sortedProducts.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const visibleEnd = Math.min(currentPage * ITEMS_PER_PAGE, sortedProducts.length);
  const paginationNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
  const modalFocusHref = selectedProduct
    ? searchQuery
      ? `/shop?q=${encodeURIComponent(searchQuery)}${categoryQuery ? `&category=${encodeURIComponent(categoryParam)}` : ""}&focus=${encodeURIComponent(selectedProduct.productID)}`
      : `/shop?${categoryQuery ? `category=${encodeURIComponent(categoryParam)}&` : ""}focus=${encodeURIComponent(selectedProduct.productID)}`
    : "/shop";

  useEffect(() => {
    if (!focusProductId || loading || productsToShow.length === 0) {
      return;
    }

    const targetId = `product-${focusProductId}`;
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("sdProductFocused");
    const timeout = window.setTimeout(() => {
      target.classList.remove("sdProductFocused");
    }, 1800);

    return () => {
      window.clearTimeout(timeout);
      target.classList.remove("sdProductFocused");
    };
  }, [focusProductId, loading, productsToShow]);

  return (
    <>
      <div className="shopDetails">
        <div className="shopDetailMain">
          <div className="shopDetails__left">
            <Filter
              filters={filters}
              onChange={setFilters}
              availableCategories={availableCategories}
              availableSizes={availableSizes}
              minPrice={priceBounds.minPrice}
              maxPrice={priceBounds.maxPrice}
            />
          </div>

          <div className="shopDetails__right">
            <div className="shopDetailsSorting" data-floating-banner>
              <div className="shopDetailsBreadcrumbLink">
                <Link href="/" onClick={scrollToTop}>
                  {t("shop_home")}
                </Link>
                &nbsp;/&nbsp;
                <Link href="/shop">{t("shop_the_shop")}</Link>
              </div>

              <div className="filterLeft" onClick={toggleDrawer}>
                <IoFilterSharp />
                <p>{t("shop_filter")}</p>
              </div>

              <div className="shopDetailsSort">
                <select
                  name="sort"
                  id="sort"
                  aria-label="Sort products"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortOption)}
                >
                  <option value="default">{t("shop_default_sorting")}</option>
                  <option value="featured">{t("shop_featured")}</option>
                  <option value="bestSelling">{t("shop_best_selling")}</option>
                  <option value="a-z">{t("shop_alpha_az")}</option>
                  <option value="z-a">{t("shop_alpha_za")}</option>
                  <option value="lowToHigh">{t("shop_price_low_high")}</option>
                  <option value="highToLow">{t("shop_price_high_low")}</option>
                  <option value="oldToNew">{t("shop_date_old_new")}</option>
                  <option value="newToOld">{t("shop_date_new_old")}</option>
                </select>

                <div className="filterRight" onClick={toggleDrawer}>
                  <div className="filterSeprator" />
                  <IoFilterSharp />
                  <p>{t("shop_filter")}</p>
                </div>
              </div>
            </div>

            <div className="shopDetailsProducts">
              {!loading && !error && (
                <div className="shopResultMeta">
                  <p>
                    Showing {visibleStart}-{visibleEnd} of {sortedProducts.length} products
                  </p>
                </div>
              )}
              {hasSuccessfulSearch && (
                <div className="shopSearchSuccess" role="status" aria-live="polite">
                  Found {sortedProducts.length} products for "{searchQuery}"
                </div>
              )}
              <div className="shopDetailsProductsContainer">
                {loading && (
                  <>
                    {Array.from({ length: ITEMS_PER_PAGE }, (_, index) => (
                      <div className="sdProductSkeleton sdProductSkeletonIn" key={`skeleton-${index}`} />
                    ))}
                  </>
                )}
                {error && <p className="shopStateText">{error}</p>}

                {!loading &&
                  !error &&
                  productsToShow.length === 0 &&
                  (searchQuery ? (
                    <p className="shopStateText">No products found for "{searchParams.get("q")}".</p>
                  ) : (
                    <p className="shopStateText">No products available right now.</p>
                  ))}

                {!loading &&
                  !error &&
                  productsToShow.map((product) => {
                    const frontImage = resolveProductImage(product.frontImg);
                    const backImage = resolveProductImage(product.backImg);
                    const availableStock = resolveAvailableStock(product);
                    const isOutOfStock = availableStock <= 0;
                    const productInCart = cartItems[product.productID];
                    const productLimit = Math.min(20, availableStock);
                    const isCartLimitReached =
                      !isOutOfStock && (productInCart?.quantity ?? 0) >= productLimit;
                    const isBuyNowBusy = buyNowProductId === product.productID;
                    const reviewCount = getReviewCount(product.productID);
                    const averageRating = getAverageRating(product.productID);
                    const priceChange = getPriceChangeInfo(product);
                    const focusHref = searchQuery
                      ? `/shop?q=${encodeURIComponent(searchQuery)}${categoryQuery ? `&category=${encodeURIComponent(categoryParam)}` : ""}&focus=${encodeURIComponent(product.productID)}`
                      : `/shop?${categoryQuery ? `category=${encodeURIComponent(categoryParam)}&` : ""}focus=${encodeURIComponent(product.productID)}`;
                    return (
                    <div className="sdProductContainer" key={product.productID} id={`product-${product.productID}`}>
                      <div className="sdProductImages">
                        {isOutOfStock && <span className="sdStockBadge">{t("shop_out_of_stock")}</span>}
                        {priceChange && <span className={`priceChangeBadge ${priceChange.className}`}>{priceChange.label}</span>}
                        <button
                          type="button"
                          className="sdProductPreviewButton"
                          onClick={() => openProductModal(product)}
                          aria-label={`View details for ${product.productName}`}
                        >
                          <img
                            src={frontImage}
                            alt={product.productName}
                            className="sdProduct_front"
                          />
                          <img
                            src={backImage}
                            alt={product.productName}
                            className="sdProduct_back"
                          />
                        </button>
                        <h4
                          className={isOutOfStock || isCartLimitReached ? "sdAddDisabled" : ""}
                          onClick={() => {
                            if (!isOutOfStock && !isCartLimitReached) {
                              handleAddToCart(product);
                            }
                          }}
                        >
                          {isOutOfStock
                            ? t("shop_unavailable")
                            : isCartLimitReached
                              ? t("shop_limit_reached")
                              : t("shop_add_to_cart")}
                        </h4>
                      </div>

                      <div
                        className={`sdProductImagesCart ${isOutOfStock ? "sdProductImagesCartDisabled" : ""}`}
                        onClick={() => handleAddToCart(product)}
                      >
                        <FaCartPlus />
                      </div>

                      <div className="sdProductInfo">
                        <div className="sdProductCategoryWishlist">
                          <p>{product.category || "Uncategorized"}</p>
                          <FiHeart
                            onClick={() =>
                              handleWishlistClick({
                                productID: product.productID,
                                productName: product.productName,
                                productPrice: product.productPrice,
                                productReviews: product.productReviews})
                            }
                            style={{
                              color: wishListItems[product.productID]
                                ? "red"
                                : "#767676",
                              cursor: "pointer"}}
                          />
                        </div>

                        <div className="sdProductNameInfo">
                          <Link href={focusHref} onClick={scrollToTop}>
                            <h5>{product.productName}</h5>
                          </Link>

                          {priceChange ? (
                            <p className="priceChangeText">
                              <span className="priceOld">${priceChange.oldPrice}</span>
                              <span className="priceNew">${priceChange.newPrice}</span>
                            </p>
                          ) : (
                            <p>${product.productPrice}</p>
                          )}
                          <button
                            type="button"
                            className="sdBuyNowButton"
                            disabled={isOutOfStock || isBuyNowBusy}
                            onClick={() => void handleBuyNow(product)}
                          >
                            {isBuyNowBusy ? t("shop_processing") : t("shop_buy_now")}
                          </button>

                          <div className="sdProductRatingReviews">
                            <div className="sdProductRatingStar">
                              {Array.from({ length: 5 }, (_, index) =>
                                index < Math.round(averageRating) ? (
                                  <FaStar key={`${product.productID}-star-${index}`} color="#FEC78A" size={10} />
                                ) : (
                                  <FaRegStar key={`${product.productID}-star-${index}`} color="#D1D5DB" size={10} />
                                )
                              )}
                            </div>
                            <span>
                              {reviewCount > 0
                                ? `${reviewCount} ${reviewCount > 1 ? t("shop_user_reviews") : t("shop_user_review")}`
                                : product.productReviews}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {!loading && !error && sortedProducts.length > 0 && (
              <div className="shopDetailsPagination">
              <div className="sdPaginationPrev">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage((prev) => Math.max(1, prev - 1));
                    scrollToTop();
                  }}
                  disabled={currentPage === 1}
                >
                  <FaAngleLeft />
                  {t("shop_prev")}
                </button>
              </div>

              <div className="sdPaginationNumber">
                <div className="paginationNum">
                  {paginationNumbers.map((page) => (
                    <button
                      type="button"
                      key={page}
                      className={page === currentPage ? "pageActive" : ""}
                      onClick={() => {
                        setCurrentPage(page);
                        scrollToTop();
                      }}
                    >
                      {page}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sdPaginationNext">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                    scrollToTop();
                  }}
                  disabled={currentPage === totalPages}
                >
                  {t("shop_next")}
                  <FaAngleRight />
                </button>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {isDrawerOpen && <div className="filterDrawerBackdrop" onClick={closeDrawer} />}
      <div className={`filterDrawer ${isDrawerOpen ? "open" : ""}`}>
        <div className="drawerHeader">
          <p>{t("shop_filter_by")}</p>
          <IoClose onClick={closeDrawer} className="closeButton" size={26} />
        </div>
        <div className="drawerContent">
          <Filter
            filters={filters}
            onChange={setFilters}
            availableCategories={availableCategories}
            availableSizes={availableSizes}
            minPrice={priceBounds.minPrice}
            maxPrice={priceBounds.maxPrice}
          />
        </div>
      </div>

      {isClient && selectedProduct && createPortal(
        <div className="sdProductModalOverlay" onClick={closeProductModal}>
          <div
            className="sdProductModal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedProduct.productName} details`}
          >
            <button
              type="button"
              className="sdProductModalClose"
              aria-label="Close product details"
              onClick={closeProductModal}
            >
              <IoClose />
            </button>

            <div className="sdProductModalContent">
              <div className="sdProductModalImageWrap">
                <img
                  src={resolveProductImage(selectedProduct.frontImg)}
                  alt={selectedProduct.productName}
                />
              </div>

              <div className="sdProductModalInfo">
                <h3>{selectedProduct.productName}</h3>
                <p>
                  <strong>{t("shop_product_id")}</strong> {selectedProduct.productID}
                </p>
                <p>
                  <strong>{t("shop_product_price")}</strong> ${selectedProduct.productPrice}
                </p>
                <p>
                  <strong>{t("shop_product_reviews")}</strong> {selectedProduct.productReviews}
                </p>
                <p>
                  <strong>{t("shop_user_rating")}</strong> {getAverageRating(selectedProduct.productID)} / 5
                </p>
                <p>
                  <strong>User Reviews:</strong> {getReviewCount(selectedProduct.productID)}
                </p>
                <p>
                  <strong>{t("shop_remaining_stock")}</strong> {resolveAvailableStock(selectedProduct)}
                </p>
                <p>
                  <strong>{t("shop_status")}</strong> {selectedProduct.active === false ? t("shop_inactive") : t("shop_active")}
                </p>
                <div className="sdSizeSection">
                  <strong>Available Sizes</strong>
                  <div className="sdSizeOptions" role="list" aria-label="Available clothing sizes">
                    {resolveProductSizes(selectedProduct).map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`sdSizeButton${selectedSize === size ? " sdSizeButtonActive" : ""}`}
                        onClick={() => setSelectedSize(size)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                  <span className="sdSizeHint">
                    {selectedSize ? `Selected size: ${selectedSize}` : "Choose a size to preview availability."}
                  </span>
                </div>
                <button
                  type="button"
                  className="sdBuyNowButton"
                  disabled={resolveAvailableStock(selectedProduct) <= 0 || buyNowProductId === selectedProduct.productID}
                  onClick={() => void handleBuyNow(selectedProduct)}
                >
                  {buyNowProductId === selectedProduct.productID ? t("shop_processing") : t("shop_buy_now")}
                </button>
                <p>
                  <strong>{t("shop_focus_link")}</strong>{" "}
                  <Link
                    href={modalFocusHref}
                    onClick={() => {
                      closeProductModal();
                      scrollToTop();
                    }}
                  >
                    {t("shop_view_in_list")}
                  </Link>
                </p>

                <div className="sdReviewSection">
                  <h4>{t("shop_rate_comment")}</h4>
                  <div className="sdReviewRatingInput" role="group" aria-label="Product rating">
                    {Array.from({ length: 5 }, (_, index) => {
                      const ratingValue = index + 1;
                      const selected = ratingValue <= reviewRatingDraft;
                      return (
                        <button
                          type="button"
                          key={`review-rate-${ratingValue}`}
                          className="sdReviewStarButton"
                          onClick={() => setReviewRatingDraft(ratingValue)}
                          aria-label={`Rate ${ratingValue} star${ratingValue > 1 ? "s" : ""}`}
                        >
                          {selected ? <FaStar color="#F59E0B" size={16} /> : <FaRegStar color="#9CA3AF" size={16} />}
                        </button>
                      );
                    })}
                  </div>

                  <textarea
                    value={reviewCommentDraft}
                    onChange={(event) => setReviewCommentDraft(event.target.value)}
                    placeholder={t("shop_write_comment")}
                    rows={4}
                  />

                  <button
                    type="button"
                    className="sdSaveDescriptionButton"
                    onClick={handleSubmitReview}
                  >
                    {t("shop_submit_review")}
                  </button>

                  <div className="sdReviewList">
                    {isLoadingReviews ? (
                      <p className="sdReviewEmptyState">{t("shop_loading_reviews")}</p>
                    ) : getProductReviews(selectedProduct.productID).length === 0 ? (
                      <p className="sdReviewEmptyState">{t("shop_no_reviews")}</p>
                    ) : (
                      getProductReviews(selectedProduct.productID).map((review) => (
                        <article key={review.id} className="sdReviewCard">
                          {(() => {
                            const replyDraft = replyDraftByReviewId[review.id] ?? "";
                            const isReplyOpen = activeReplyReviewId === review.id;
                            const replies = review.replies || [];
                            return (
                              <>
                          <div className="sdReviewCardHeader">
                            <strong>{review.author}</strong>
                            <span>{formatReviewDateTime(review.createdAt)}</span>
                          </div>
                          <div className="sdReviewCardStars">
                            {Array.from({ length: 5 }, (_, index) =>
                              index < review.rating ? (
                                <FaStar key={`${review.id}-star-${index}`} color="#F59E0B" size={12} />
                              ) : (
                                <FaRegStar key={`${review.id}-star-${index}`} color="#D1D5DB" size={12} />
                              )
                            )}
                          </div>
                          <p>{review.comment}</p>
                          <div className="sdReviewMetaActions">
                            <button
                              type="button"
                              className={`sdReviewMetaButton ${review.likedByCurrentUser ? 'active' : ''}`}
                              onClick={() => toggleLikeReview(review.id)}
                              title={review.likedByCurrentUser ? t("shop_unlike") : t("shop_like")}
                            >
                              <FiThumbsUp /> <span>{review.likes ?? 0}</span>
                            </button>
                            <button
                              type="button"
                              className="sdReviewMetaButton"
                              onClick={() => handleDislikeReview(review.id)}
                              title={t("shop_dislike")}
                            >
                              <FiThumbsDown /> <span>{review.dislikes ?? 0}</span>
                            </button>
                            <button
                              type="button"
                              className="sdReviewMetaButton"
                              onClick={() => toggleReplyDraft(review.id)}
                              title={t("shop_reply")}
                            >
                              <FiMessageCircle /> <span>{replies.length}</span>
                            </button>
                          </div>
                          {isReplyOpen && (
                            <div className="sdReviewReplyComposer">
                              <textarea
                                value={replyDraft}
                                onChange={(event) =>
                                  handleReplyDraftChange(review.id, event.target.value)
                                }
                                placeholder={t("shop_write_reply")}
                                rows={2}
                              />
                              <div className="sdReviewReplyComposerActions">
                                <button type="button" onClick={() => void submitReply(review.id)}>
                                  {t("shop_post_reply")}
                                </button>
                                <button type="button" onClick={() => setActiveReplyReviewId(null)}>
                                  {t("shop_cancel")}
                                </button>
                              </div>
                            </div>
                          )}
                          {replies.length > 0 && (
                            <div className="sdReviewReplyList">
                              {replies.map((reply) => (
                                <article key={reply.id} className="sdReviewReplyCard">
                                  <div className="sdReviewReplyHeader">
                                    <strong>{reply.author}</strong>
                                    <span>{formatReviewDateTime(reply.createdAt)}</span>
                                  </div>
                                  <p>{reply.content}</p>
                                </article>
                              ))}
                            </div>
                          )}
                          {review.ownedByCurrentUser && (
                            <div className="sdReviewCardActions">
                              <button type="button" onClick={() => beginEditReview(review)} title="Edit">
                                <FiEdit2 size={15} />
                              </button>
                              <button type="button" onClick={() => handleDeleteReview(review.id)} title="Delete">
                                <FiTrash2 size={15} />
                              </button>
                            </div>
                          )}
                          {review.ownedByCurrentUser && editingReviewId === review.id && (
                            <div className="sdReviewEditForm">
                              <div className="sdReviewRatingInput" role="group" aria-label="Edit product rating">
                                {Array.from({ length: 5 }, (_, index) => {
                                  const ratingValue = index + 1;
                                  const selected = ratingValue <= reviewEditRatingDraft;
                                  return (
                                    <button
                                      type="button"
                                      key={`${review.id}-edit-star-${ratingValue}`}
                                      className="sdReviewStarButton"
                                      onClick={() => setReviewEditRatingDraft(ratingValue)}
                                      aria-label={`Rate ${ratingValue} star${ratingValue > 1 ? "s" : ""}`}
                                    >
                                      {selected ? (
                                        <FaStar color="#F59E0B" size={16} />
                                      ) : (
                                        <FaRegStar color="#9CA3AF" size={16} />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                              <textarea
                                value={reviewEditCommentDraft}
                                onChange={(event) => setReviewEditCommentDraft(event.target.value)}
                                rows={3}
                              />
                              <div className="sdReviewEditActions">
                                <button type="button" onClick={() => handleUpdateReview(review.id)}>
                                  {t("shop_save")}
                                </button>
                                <button type="button" onClick={cancelEditReview}>
                                  {t("shop_cancel")}
                                </button>
                              </div>
                            </div>
                          )}
                              </>
                            );
                          })()}
                        </article>
                      ))
                    )}
                  </div>
                </div>

                <label htmlFor="sd-product-description">
                  <strong>{t("shop_your_description")}</strong>
                </label>
                <textarea
                  id="sd-product-description"
                  value={descriptionDraft}
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                  placeholder={t("shop_write_description")}
                  rows={4}
                />
                <button
                  type="button"
                  className="sdSaveDescriptionButton"
                  onClick={handleSaveDescription}
                >
                  {t("shop_save_description")}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      <AuthRequiredModal
        open={showAuthRequiredModal}
        onClose={() => setShowAuthRequiredModal(false)}
        onLogin={() => {
          setShowAuthRequiredModal(false);
          router.push("/login");
        }}
      />
    </>
  );
}
