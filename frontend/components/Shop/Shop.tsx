"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { FiHeart } from "react-icons/fi";
import { FaStar, FaRegStar, FaCartPlus } from "react-icons/fa";
import { IoFilterSharp, IoClose } from "react-icons/io5";
import { FaAngleRight, FaAngleLeft } from "react-icons/fa6";

import { RootState, useAppDispatch, useAppSelector } from "@/store/index";
import { addToCartAsync, updateQuantityAsync } from "@/store/cartSlice";
import {
  addToWishlistAsync,
  removeFromWishlistAsync,
  wishListProduct,
} from "@/store/wishListSlice";
import { getToken, getUser, isAuthenticated } from "@/lib/auth";
import { DataStore } from "@/data/StoreData";
import { useProducts } from "@/hooks/useProducts";
import { createPortal } from "react-dom";

import Filter from "./Filters/Filter";
import AuthRequiredModal from "@/components/Common/AuthRequiredModal";
import "./Shop.css";

const FALLBACK_PRODUCT_IMAGE = "/Products/product_1.jpg";
const ITEMS_PER_PAGE = 6;
const PRODUCT_DESCRIPTION_STORAGE_KEY = "shop-product-descriptions";
const REVIEW_INTERACTIONS_STORAGE_KEY = "shop-review-interactions";

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
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = (searchParams.get("q") ?? "").trim();
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

  const cartItems = useAppSelector((state: RootState) => state.cart.itemsById);
  const wishListItems = useAppSelector((state) => state.wishList.itemsById);

  useEffect(() => {
    setIsClient(true);
  }, []);

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
    setDescriptionDraft(productDescriptions[product.productID] ?? "");
    setReviewRatingDraft(5);
    setReviewCommentDraft("");
    void loadProductReviews(product.productID);
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
    setEditingReviewId(null);
    setReviewEditCommentDraft("");
    setReviewEditRatingDraft(5);
  };

  const handleSaveDescription = () => {
    if (!selectedProduct) {
      return;
    }
    setProductDescriptions((prev) => ({
      ...prev,
      [selectedProduct.productID]: descriptionDraft.trim(),
    }));
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
          color: "white",
        },
        iconTheme: {
          primary: "#fff",
          secondary: "#ff4b4b",
        },
      });
      return;
    }

    if (productInCart) {
      dispatch(
        updateQuantityAsync({
          productID: product.productID,
          quantity: (productInCart.quantity ?? 0) + 1,
        })
      )
        .unwrap()
        .then(() => {
          toast.success("Added to cart!", {
            duration: 2000,
            style: {
              backgroundColor: "#07bc0c",
              color: "white",
            },
            iconTheme: {
              primary: "#fff",
              secondary: "#07bc0c",
            },
          });
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
        stockQuantity: availableStock,
      })
    )
      .unwrap()
      .then(() => {
        toast.success("Added to cart!", {
          duration: 2000,
          style: {
            backgroundColor: "#07bc0c",
            color: "white",
          },
          iconTheme: {
            primary: "#fff",
            secondary: "#07bc0c",
          },
        });
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
              color: "#fff",
            },
            iconTheme: {
              primary: "#fff",
              secondary: "#fb0404",
            },
          });
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
            color: "#fff",
          },
          iconTheme: {
            primary: "#fff",
            secondary: "#07bc0c",
          },
        });
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
            stockQuantity: availableStock,
          })
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
      [summary.productID]: Array.isArray(summary.reviews) ? summary.reviews : [],
    }));
    setReviewStatsById((prev) => ({
      ...prev,
      [summary.productID]: {
        averageRating: Number(summary.averageRating ?? 0),
        reviewCount: Number(summary.reviewCount ?? 0),
      },
    }));
  };

  const loadProductReviews = async (productID: string) => {
    setIsLoadingReviews(true);
    try {
      const authorizationHeader = normalizeAuthorizationHeader(getToken());
      const response = await fetch(`/api/products/${encodeURIComponent(productID)}/reviews?limit=10`, {
        method: "GET",
        credentials: "include",
        headers: {
          ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
        },
      });
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
          "Content-Type": "application/json",
          ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
        },
        body: JSON.stringify({
          rating: safeRating,
          comment: trimmedComment,
        }),
      });

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
            "Content-Type": "application/json",
            ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
          },
          body: JSON.stringify({
            rating: safeRating,
            comment: trimmedComment,
          }),
        }
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
          headers: {
            ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
          },
        }
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
          headers: {
            ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
          },
        }
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
          headers: {
            ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
          },
        }
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
      [reviewID]: value,
    }));
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
            "Content-Type": "application/json",
            ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
          },
          body: JSON.stringify({ content: replyText }),
        }
      );

      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(data?.message || data?.error || "Failed to add reply");
      }

      applyReviewSummary(data as ProductReviewSummary);
      setReplyDraftByReviewId((prev) => ({
        ...prev,
        [reviewID]: "",
      }));
      setActiveReplyReviewId(null);
      toast.success("Reply added");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add reply";
      toast.error(message);
    }
  };

  const sortedProducts = useMemo(() => {
    const items = [...products];
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
  }, [products, sortBy]);

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

  const visibleStart = sortedProducts.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const visibleEnd = Math.min(currentPage * ITEMS_PER_PAGE, sortedProducts.length);
  const paginationNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
  const modalFocusHref = selectedProduct
    ? searchQuery
      ? `/shop?q=${encodeURIComponent(searchQuery)}&focus=${encodeURIComponent(selectedProduct.productID)}`
      : `/shop?focus=${encodeURIComponent(selectedProduct.productID)}`
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
            <Filter />
          </div>

          <div className="shopDetails__right">
            <div className="shopDetailsSorting">
              <div className="shopDetailsBreadcrumbLink">
                <Link href="/" onClick={scrollToTop}>
                  Home
                </Link>
                &nbsp;/&nbsp;
                <Link href="/shop">The Shop</Link>
              </div>

              <div className="filterLeft" onClick={toggleDrawer}>
                <IoFilterSharp />
                <p>Filter</p>
              </div>

              <div className="shopDetailsSort">
                <select
                  name="sort"
                  id="sort"
                  aria-label="Sort products"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortOption)}
                >
                  <option value="default">Default Sorting</option>
                  <option value="featured">Featured</option>
                  <option value="bestSelling">Best Selling</option>
                  <option value="a-z">Alphabetically, A-Z</option>
                  <option value="z-a">Alphabetically, Z-A</option>
                  <option value="lowToHigh">Price, Low to high</option>
                  <option value="highToLow">Price, high to low</option>
                  <option value="oldToNew">Date, old to new</option>
                  <option value="newToOld">Date, new to old</option>
                </select>

                <div className="filterRight" onClick={toggleDrawer}>
                  <div className="filterSeprator" />
                  <IoFilterSharp />
                  <p>Filter</p>
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
              <div className="shopDetailsProductsContainer">
                {loading && (
                  <>
                    {Array.from({ length: ITEMS_PER_PAGE }, (_, index) => (
                      <div className="sdProductSkeleton" key={`skeleton-${index}`} />
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
                    const focusHref = searchQuery
                      ? `/shop?q=${encodeURIComponent(searchQuery)}&focus=${encodeURIComponent(product.productID)}`
                      : `/shop?focus=${encodeURIComponent(product.productID)}`;
                    return (
                    <div className="sdProductContainer" key={product.productID} id={`product-${product.productID}`}>
                      <div className="sdProductImages">
                        {isOutOfStock && <span className="sdStockBadge">Out of stock</span>}
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
                            ? "Unavailable"
                            : isCartLimitReached
                              ? "Limit reached"
                              : "Add to Cart"}
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
                          <p>Dresses</p>
                          <FiHeart
                            onClick={() =>
                              handleWishlistClick({
                                productID: product.productID,
                                productName: product.productName,
                                productPrice: product.productPrice,
                                productReviews: product.productReviews,
                              })
                            }
                            style={{
                              color: wishListItems[product.productID]
                                ? "red"
                                : "#767676",
                              cursor: "pointer",
                            }}
                          />
                        </div>

                        <div className="sdProductNameInfo">
                          <Link href={focusHref} onClick={scrollToTop}>
                            <h5>{product.productName}</h5>
                          </Link>

                          <p>${product.productPrice}</p>
                          <button
                            type="button"
                            className="sdBuyNowButton"
                            disabled={isOutOfStock || isBuyNowBusy}
                            onClick={() => void handleBuyNow(product)}
                          >
                            {isBuyNowBusy ? "Processing..." : "Buy Now"}
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
                                ? `${reviewCount} user review${reviewCount > 1 ? "s" : ""}`
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
                  Prev
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
                  Next
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
          <p>Filter By</p>
          <IoClose onClick={closeDrawer} className="closeButton" size={26} />
        </div>
        <div className="drawerContent">
          <Filter />
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
                  <strong>ID:</strong> {selectedProduct.productID}
                </p>
                <p>
                  <strong>Price:</strong> ${selectedProduct.productPrice}
                </p>
                <p>
                  <strong>Reviews:</strong> {selectedProduct.productReviews}
                </p>
                <p>
                  <strong>User Rating:</strong> {getAverageRating(selectedProduct.productID)} / 5
                </p>
                <p>
                  <strong>User Reviews:</strong> {getReviewCount(selectedProduct.productID)}
                </p>
                <p>
                  <strong>Remaining Stock:</strong> {resolveAvailableStock(selectedProduct)}
                </p>
                <p>
                  <strong>Status:</strong> {selectedProduct.active === false ? "Inactive" : "Active"}
                </p>
                <button
                  type="button"
                  className="sdBuyNowButton"
                  disabled={resolveAvailableStock(selectedProduct) <= 0 || buyNowProductId === selectedProduct.productID}
                  onClick={() => void handleBuyNow(selectedProduct)}
                >
                  {buyNowProductId === selectedProduct.productID ? "Processing..." : "Buy Now"}
                </button>
                <p>
                  <strong>Focus Link:</strong>{" "}
                  <Link
                    href={modalFocusHref}
                    onClick={() => {
                      closeProductModal();
                      scrollToTop();
                    }}
                  >
                    View in product list
                  </Link>
                </p>

                <div className="sdReviewSection">
                  <h4>Rate & Comment</h4>
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
                    placeholder="Write your comment about this product..."
                    rows={4}
                  />

                  <button
                    type="button"
                    className="sdSaveDescriptionButton"
                    onClick={handleSubmitReview}
                  >
                    Submit Review
                  </button>

                  <div className="sdReviewList">
                    {isLoadingReviews ? (
                      <p className="sdReviewEmptyState">Loading reviews...</p>
                    ) : getProductReviews(selectedProduct.productID).length === 0 ? (
                      <p className="sdReviewEmptyState">No user reviews yet. Be the first to comment.</p>
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
                              className="sdReviewMetaButton"
                              onClick={() => toggleLikeReview(review.id)}
                            >
                              {review.likedByCurrentUser ? "Unlike" : "Like"} (
                              {review.likes ?? 0})
                            </button>
                            <button
                              type="button"
                              className="sdReviewMetaButton"
                              onClick={() => handleDislikeReview(review.id)}
                            >
                              Dislike ({review.dislikes ?? 0})
                            </button>
                            <button
                              type="button"
                              className="sdReviewMetaButton"
                              onClick={() => toggleReplyDraft(review.id)}
                            >
                              Reply ({replies.length})
                            </button>
                          </div>
                          {isReplyOpen && (
                            <div className="sdReviewReplyComposer">
                              <textarea
                                value={replyDraft}
                                onChange={(event) =>
                                  handleReplyDraftChange(review.id, event.target.value)
                                }
                                placeholder="Write your reply..."
                                rows={2}
                              />
                              <div className="sdReviewReplyComposerActions">
                                <button type="button" onClick={() => void submitReply(review.id)}>
                                  Post Reply
                                </button>
                                <button type="button" onClick={() => setActiveReplyReviewId(null)}>
                                  Cancel
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
                              <button type="button" onClick={() => beginEditReview(review)}>
                                Edit
                              </button>
                              <button type="button" onClick={() => handleDeleteReview(review.id)}>
                                Delete
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
                                  Save
                                </button>
                                <button type="button" onClick={cancelEditReview}>
                                  Cancel
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
                  <strong>Your Product Description</strong>
                </label>
                <textarea
                  id="sd-product-description"
                  value={descriptionDraft}
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                  placeholder="Write any product description you want..."
                  rows={4}
                />
                <button
                  type="button"
                  className="sdSaveDescriptionButton"
                  onClick={handleSaveDescription}
                >
                  Save Description
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
