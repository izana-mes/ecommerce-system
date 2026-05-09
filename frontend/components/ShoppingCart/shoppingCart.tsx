"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MdOutlineClose } from "react-icons/md";
import toast from "react-hot-toast";

import { useProducts } from "@/hooks/useProducts";
import {
  cartProduct,
  clearCart,
  fetchCartAsync,
  removeFromCart,
  removeFromCartAsync,
  selectCartTotalAmount,
  updateQuantityAsync,
} from "@/store/cartSlice";
import { useAppDispatch, useAppSelector } from "@/store";
import { getToken, getUser, refreshCurrentUserFromServer } from "@/lib/auth";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { TranslationKey } from "@/lib/i18n";

import "./shoppingCart.css";

function shippingEstimateKey(country: string): TranslationKey {
  const map: Record<string, TranslationKey> = {
    India: "checkout_shipping_est_india",
    Canada: "checkout_shipping_est_canada",
    "United Kingdom": "checkout_shipping_est_uk",
    "United States": "checkout_shipping_est_us",
    Turkey: "checkout_shipping_est_turkey",
  };
  return map[country] ?? "checkout_shipping_est_default";
}

const success = "/success.png";

type CartTab = "cartTab1" | "cartTab2" | "cartTab3";
type CheckoutInvalidItem = {
  productID: string;
  productName: string;
  requestedQuantity: number;
  availableQuantity: number;
  active: boolean;
  reason: string;
};

type CheckoutHealthResponse = {
  canCheckout?: boolean;
  invalidItems?: CheckoutInvalidItem[];
};

type CheckoutForm = {
  firstName: string;
  lastName: string;
  companyName: string;
  country: string;
  streetAddress1: string;
  streetAddress2: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  createAccount: boolean;
  shipToDifferentAddress: boolean;
  notes: string;
};

type CheckoutErrorFields = Partial<Record<keyof CheckoutForm, string>>;
type CapturedLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  label: string;
  capturedAt: number;
};
type AppliedCoupon = {
  couponId: number;
  code: string;
  title: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountAmount: number;
};
type AddressSuggestion = {
  displayName: string;
  latitude: number;
  longitude: number;
  streetAddress1: string;
  streetAddress2: string;
  city: string;
  postalCode: string;
  country: string;
};
type LoyaltySnapshot = {
  redeemed: number;
  earned: number;
  remaining: number;
  discountAmount: number;
};

const POINTS_PER_USD_DISCOUNT = 100;
const MAX_POINTS_DISCOUNT_RATE = 0.25;

function normalizeAuthorizationHeader(token: string | null): string | null {
  if (!token) return null;
  const trimmed = token.trim();
  if (!trimmed) return null;
  const normalizedToken = trimmed.replace(/^Bearer\s+/i, "");
  return `Bearer ${normalizedToken}`;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function mapGeolocationError(error: GeolocationPositionError): string {
  switch (error.code) {
    case 1:
      return "Location access was denied. Please allow location permission and try again.";
    case 2:
      return "Location is unavailable right now. Please turn on location services and try again.";
    case 3:
      return "Location request timed out. Please move to an open area and try again.";
    default:
      return error.message ? `Location error: ${error.message}` : "Unable to read current location.";
  }
}

export default function ShoppingCart() {
  const { t } = useLocale();
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const { products } = useProducts();

  const cartItemsById = useAppSelector((state) => state.cart.itemsById);
  const cartItems = Object.values(cartItemsById);
  const totalPrice = useAppSelector(selectCartTotalAmount);

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<CartTab>("cartTab1");
  const [payments, setPayments] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState("Direct Bank Transfer");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<string | null>(null);
  const [lastTrackingSecret, setLastTrackingSecret] = useState<string | null>(null);
  const [buyNowProductId, setBuyNowProductId] = useState<string | null>(null);
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({
    firstName: "",
    lastName: "",
    companyName: "",
    country: "",
    streetAddress1: "",
    streetAddress2: "",
    city: "",
    postalCode: "",
    phone: "",
    email: "",
    createAccount: false,
    shipToDifferentAddress: false,
    notes: "",
  });
  const [checkoutErrors, setCheckoutErrors] = useState<CheckoutErrorFields>({});
  const [checkoutLocation, setCheckoutLocation] = useState<CapturedLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSearching, setAddressSearching] = useState(false);
  const [addressResults, setAddressResults] = useState<AddressSuggestion[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplying, setCouponApplying] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [availablePoints, setAvailablePoints] = useState(0);
  const [pointsToRedeemInput, setPointsToRedeemInput] = useState("0");
  const [lastLoyaltySnapshot, setLastLoyaltySnapshot] = useState<LoyaltySnapshot | null>(null);
  const [lastPlacedItems, setLastPlacedItems] = useState<cartProduct[]>([]);
  const [lastPlacedTotal, setLastPlacedTotal] = useState(0);
  const [lastOrderPricing, setLastOrderPricing] = useState({
    subtotal: 0,
    shipping: 0,
    vat: 0,
    couponDiscount: 0,
    pointsDiscount: 0,
    total: 0,
  });
  const requestedStep = (searchParams.get("step") || "").trim().toLowerCase();
  const requestedBuyNow = (searchParams.get("buyNow") || "").trim();
  const requestedPayment = (searchParams.get("payment") || "").trim().toLowerCase();
  const requestedCoupon = (searchParams.get("coupon") || "").trim().toUpperCase();
  const countryOptions = [
    "India",
    "Canada",
    "United Kingdom",
    "United States",
    "Turkey",
  ];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    dispatch(fetchCartAsync());
  }, [dispatch]);

  useEffect(() => {
    const user = getUser();
    if (!user) return;

    setCheckoutForm((prev) => ({
      ...prev,
      firstName: prev.firstName || user.firstName || "",
      lastName: prev.lastName || user.lastName || "",
      email: prev.email || user.email || "",
    }));
  }, []);

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    setAvailablePoints(Math.max(0, Number(user?.loyaltyPoints ?? 0)));
    if (!token) return;
    void refreshCurrentUserFromServer().then((refreshed) => {
      setAvailablePoints(Math.max(0, Number(refreshed?.loyaltyPoints ?? 0)));
    });
  }, []);

  useEffect(() => {
    if (requestedStep === "checkout") {
      setActiveTab("cartTab2");
    }
    if (requestedPayment === "vnpay") {
      setSelectedPayment("VNPAY");
    }
    if (requestedBuyNow) {
      setBuyNowProductId(String(requestedBuyNow));
    }
  }, [requestedBuyNow, requestedPayment, requestedStep]);

  useEffect(() => {
    if (!buyNowProductId) return;
    const hasSelectedItem = cartItems.some(
      (item) => String(item.productID) === String(buyNowProductId)
    );
    if (!hasSelectedItem) {
      setBuyNowProductId(null);
    }
  }, [buyNowProductId, cartItems]);

  const checkoutItems = useMemo(() => {
    if (!buyNowProductId) return cartItems;
    return cartItems.filter((item) => String(item.productID) === String(buyNowProductId));
  }, [buyNowProductId, cartItems]);

  const checkoutSubtotal = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + item.productPrice * (item.quantity ?? 1), 0),
    [checkoutItems]
  );
  const shippingFee = checkoutSubtotal === 0 ? 0 : 5;
  const vatAmount = checkoutSubtotal === 0 ? 0 : 11;
  const discountAmount = Math.min(checkoutSubtotal, Number(appliedCoupon?.discountAmount || 0));
  const prePointsTotal = Math.max(0, checkoutSubtotal + shippingFee + vatAmount - discountAmount);
  const maxRedeemablePointsByRate = Math.floor(prePointsTotal * MAX_POINTS_DISCOUNT_RATE * POINTS_PER_USD_DISCOUNT);
  const requestedPointsToRedeem = Math.max(0, Number.parseInt(pointsToRedeemInput || "0", 10) || 0);
  const pointsRedeemApplied = Math.max(
    0,
    Math.min(requestedPointsToRedeem, availablePoints, maxRedeemablePointsByRate)
  );
  const pointsDiscountAmount = pointsRedeemApplied / POINTS_PER_USD_DISCOUNT;
  const checkoutGrandTotal = Math.max(0, prePointsTotal - pointsDiscountAmount);

  const handleCheckoutFieldChange = (field: keyof CheckoutForm, value: string | boolean) => {
    setCheckoutForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    setCheckoutErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));
  };

  const validateCheckoutForm = (): boolean => {
    const nextErrors: CheckoutErrorFields = {};

    if (!checkoutForm.firstName.trim()) nextErrors.firstName = "First name is required";
    if (!checkoutForm.lastName.trim()) nextErrors.lastName = "Last name is required";
    if (!checkoutForm.country.trim()) nextErrors.country = "Country is required";
    if (!checkoutForm.streetAddress1.trim()) nextErrors.streetAddress1 = "Street address is required";
    if (!checkoutForm.city.trim()) nextErrors.city = "City is required";
    if (!checkoutForm.postalCode.trim()) nextErrors.postalCode = "Postal code is required";
    if (!checkoutForm.phone.trim()) nextErrors.phone = "Phone is required";
    if (!checkoutForm.email.trim()) {
      nextErrors.email = "Email is required";
    } else if (!isValidEmail(checkoutForm.email.trim())) {
      nextErrors.email = "Email is invalid";
    }

    setCheckoutErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleTabClick = (tab: CartTab) => {
    if (tab === "cartTab1" || cartItems.length > 0) {
      setActiveTab(tab);
    }
  };

  const handleQuantityChange = async (productId: string, quantity: number) => {
    if (quantity < 1) return;
    const product = products.find((p) => p.productID === productId);
    const stockQuantity = Math.max(0, Number(product?.stockQuantity ?? 25));
    const allowedMax = Math.min(20, stockQuantity);
    if (allowedMax <= 0) {
      toast.error("This product is out of stock");
      return;
    }
    if (quantity > allowedMax) {
      toast.error(`Only ${allowedMax} item(s) available`);
      return;
    }

    try {
      await dispatch(updateQuantityAsync({ productID: productId, quantity })).unwrap();
      dispatch(fetchCartAsync());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to update quantity:", message);
    }
  };

  const handleRemoveFromCart = async (productId: string) => {
    try {
      await dispatch(removeFromCartAsync(productId)).unwrap();
      dispatch(fetchCartAsync());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to remove item:", message);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const currentDate = new Date();
  const formatDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const orderNumber = Math.floor(Math.random() * 100000);

  const handlePaymentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedPayment(e.target.value);
  };

  const captureBrowserLocation = useCallback(async (): Promise<CapturedLocation> => {
    if (!window.isSecureContext) {
      throw new Error("Location requires HTTPS (or localhost in development).");
    }
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      throw new Error("This device does not support location detection.");
    }

    const readPosition = (enableHighAccuracy: boolean) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy,
          timeout: 15_000,
          maximumAge: 0,
        });
      });

    let position: GeolocationPosition;
    try {
      position = await readPosition(true);
    } catch (error) {
      const geoError = error as GeolocationPositionError;
      if (geoError?.code === 3) {
        position = await readPosition(false);
      } else {
        throw new Error(mapGeolocationError(geoError));
      }
    }

    const latitude = Number(position.coords.latitude);
    const longitude = Number(position.coords.longitude);
    const accuracyMeters = Number.isFinite(position.coords.accuracy)
      ? Math.round(position.coords.accuracy)
      : null;
    const capturedAt = Date.now();

    let label = `GPS ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    try {
      const reverseResponse = await fetch(
        `/api/location/reverse?lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(
          String(longitude)
        )}`,
        { cache: "no-store" }
      );
      const reversePayload = await reverseResponse.json().catch(() => ({}));
      if (reverseResponse.ok) {
        const streetAddress1 = String(reversePayload?.streetAddress1 || "").trim();
        const streetAddress2 = String(reversePayload?.streetAddress2 || "").trim();
        const city = String(reversePayload?.city || "").trim();
        const postalCode = String(reversePayload?.postalCode || "").trim();
        const country = String(reversePayload?.country || "").trim();
        const displayName = String(reversePayload?.displayName || "").trim();

        setCheckoutForm((prev) => ({
          ...prev,
          streetAddress1: prev.streetAddress1 || streetAddress1,
          streetAddress2:
            prev.streetAddress2 || streetAddress2 || `Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)}`,
          city: prev.city || city,
          postalCode: prev.postalCode || postalCode,
          country: prev.country || country,
        }));
        label = displayName || streetAddress1 || label;
      } else {
        setCheckoutForm((prev) => ({
          ...prev,
          streetAddress2: prev.streetAddress2 || `Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)}`,
        }));
      }
    } catch {
      setCheckoutForm((prev) => ({
        ...prev,
        streetAddress2: prev.streetAddress2 || `Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)}`,
      }));
    }

    setCheckoutErrors((prev) => ({
      ...prev,
      streetAddress1: undefined,
      city: undefined,
      postalCode: undefined,
      country: undefined,
    }));

    return {
      latitude,
      longitude,
      accuracyMeters,
      label,
      capturedAt,
    };
  }, []);

  const handleUseCurrentLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const location = await captureBrowserLocation();
      setCheckoutLocation(location);
      toast.success("Current location added to delivery details");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to read current location";
      toast.error(message);
    } finally {
      setLocationLoading(false);
    }
  }, [captureBrowserLocation]);

  const handleSearchAddress = useCallback(async () => {
    const query = addressQuery.trim();
    if (query.length < 3) {
      toast.error("Please type at least 3 characters to search address");
      return;
    }
    setAddressSearching(true);
    try {
      const response = await fetch(
        `/api/location/search?q=${encodeURIComponent(query)}&limit=5`,
        { cache: "no-store" }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Address search failed");
      }
      const rows = Array.isArray(payload?.results) ? (payload.results as AddressSuggestion[]) : [];
      setAddressResults(rows);
      if (rows.length === 0) {
        toast.error("No address results found");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Address search failed";
      toast.error(message);
      setAddressResults([]);
    } finally {
      setAddressSearching(false);
    }
  }, [addressQuery]);

  const handleSelectAddress = useCallback((result: AddressSuggestion) => {
    setCheckoutForm((prev) => ({
      ...prev,
      country: result.country || prev.country,
      streetAddress1: result.streetAddress1 || prev.streetAddress1,
      streetAddress2: result.streetAddress2 || prev.streetAddress2,
      city: result.city || prev.city,
      postalCode: result.postalCode || prev.postalCode,
    }));
    setCheckoutErrors((prev) => ({
      ...prev,
      streetAddress1: undefined,
      city: undefined,
      postalCode: undefined,
      country: undefined,
    }));
    setCheckoutLocation({
      latitude: result.latitude,
      longitude: result.longitude,
      accuracyMeters: null,
      label: result.displayName || result.streetAddress1,
      capturedAt: Date.now(),
    });
    setAddressResults([]);
    setAddressQuery(result.displayName || result.streetAddress1);
    toast.success("Address selected");
  }, []);

  const handlePlaceOrder = async () => {
    if (checkoutItems.length === 0 || isPlacingOrder) return;
    if (!validateCheckoutForm()) {
      toast.error("Please complete billing details before placing order");
      return;
    }

    const localInvalidCartItem = checkoutItems.find((item) => {
      if (item.purchasable === false) return true;
      const product = products.find((p) => p.productID === item.productID);
      const stockQuantity = Math.max(0, Number(product?.stockQuantity ?? item.availableStock ?? 25));
      return stockQuantity <= 0 || (item.quantity ?? 1) > Math.min(20, stockQuantity);
    });
    if (localInvalidCartItem) {
      toast.error(
        `Please update cart. ${localInvalidCartItem.productName} is out of stock or over limit.`
      );
      return;
    }

    setIsPlacingOrder(true);
    const placedItemsSnapshot = checkoutItems.map((item) => ({ ...item }));
    try {
      const token = getToken();
      const checkoutHealthResponse = await fetch("/api/cart/checkout-health", {
        method: "GET",
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (checkoutHealthResponse.ok) {
        const checkoutHealth = (await checkoutHealthResponse.json()) as CheckoutHealthResponse;
        const invalidItems = checkoutHealth.invalidItems ?? [];
        const blockingInvalidItem = buyNowProductId
          ? invalidItems.find((item) => String(item.productID) === String(buyNowProductId))
          : invalidItems[0];

        if (blockingInvalidItem) {
          const blockedMessage = `Cannot checkout: ${blockingInvalidItem.productName} has only ${blockingInvalidItem.availableQuantity} item(s) available.`;
          toast.error(blockedMessage);
          dispatch(fetchCartAsync());
          return;
        }
      }

      const user = getUser();
      const isVnpay = selectedPayment === "VNPAY";
      const isMomo = selectedPayment === "MOMO";
      const normalizedCompany = checkoutForm.companyName.trim();
      const normalizedNotes = checkoutForm.notes.trim();
      const combinedNotes = [normalizedCompany ? `Company: ${normalizedCompany}` : "", normalizedNotes]
        .filter(Boolean)
        .join("\n");

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          customerEmail: checkoutForm.email.trim().toLowerCase() || user?.email || "guest@example.com",
          customerFirstName: checkoutForm.firstName.trim() || user?.firstName || "",
          customerLastName: checkoutForm.lastName.trim() || user?.lastName || "",
          customerPhone: checkoutForm.phone.trim(),
          shippingAddressLine1: checkoutForm.streetAddress1.trim(),
          shippingAddressLine2: checkoutForm.streetAddress2.trim() || undefined,
          shippingCity: checkoutForm.city.trim(),
          shippingPostalCode: checkoutForm.postalCode.trim(),
          shippingCountry: checkoutForm.country.trim(),
          deliveryLatitude: checkoutLocation?.latitude,
          deliveryLongitude: checkoutLocation?.longitude,
          deliveryLocationLabel: checkoutLocation?.label,
          deliveryLocationAccuracyMeters: checkoutLocation?.accuracyMeters ?? undefined,
          deliveryLocationCapturedAt: checkoutLocation?.capturedAt,
          notes: combinedNotes || undefined,
          paymentMethod: selectedPayment,
          orderSource: buyNowProductId ? "buy-now" : "checkout-ui",
          // Product prices in cart are USD-based; server converts to VND for VNPAY.
          currency: "USD",
          shippingFee: checkoutSubtotal === 0 ? 0 : 5,
          vat: checkoutSubtotal === 0 ? 0 : 11,
          couponCode: appliedCoupon?.code,
          couponDiscount: discountAmount,
          pointsToRedeem: pointsRedeemApplied,
          items: checkoutItems.map((item) => ({
            productID: item.productID,
            productName: item.productName,
            productPrice: item.productPrice,
            quantity: item.quantity ?? 1,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Failed to place order");
      }

      const orderId = data?.data?.orderId as number | undefined;
      const orderNumber = data?.data?.orderNumber as string | undefined;
      const trackingSecret = data?.data?.trackingSecret as string | undefined;
      const pointsRedeemed = Number(data?.data?.pointsRedeemed ?? 0);
      const pointsEarned = Number(data?.data?.pointsEarned ?? 0);
      const remainingPoints = Number(data?.data?.remainingPoints ?? availablePoints);
      const serverPointsDiscountAmount = Number(data?.data?.pointsDiscountAmount ?? pointsDiscountAmount);
      if (orderNumber) setLastOrderNumber(orderNumber);
      setLastTrackingSecret(trackingSecret && String(trackingSecret).trim() ? String(trackingSecret).trim() : null);
      setLastPlacedItems(placedItemsSnapshot);
      setLastPlacedTotal(checkoutGrandTotal);
      setLastOrderPricing({
        subtotal: checkoutSubtotal,
        shipping: shippingFee,
        vat: vatAmount,
        couponDiscount: discountAmount,
        pointsDiscount: Math.max(0, serverPointsDiscountAmount),
        total: checkoutGrandTotal,
      });
      setLastLoyaltySnapshot({
        redeemed: Math.max(0, pointsRedeemed),
        earned: Math.max(0, pointsEarned),
        remaining: Math.max(0, remainingPoints),
        discountAmount: Math.max(0, serverPointsDiscountAmount),
      });
      setAvailablePoints(Math.max(0, remainingPoints));
      setPointsToRedeemInput("0");

      if (isVnpay && orderId && orderNumber) {
        const paymentResponse = await fetch("/api/vnpay/create-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            orderId,
            orderNumber,
            amount: checkoutGrandTotal,
          }),
        });
        const paymentData = await paymentResponse.json();
        if (!paymentResponse.ok) {
          throw new Error(paymentData?.error || "Cannot create VNPAY payment URL");
        }

        const paymentUrl = paymentData?.data?.paymentUrl as string | undefined;
        if (!paymentUrl) {
          throw new Error("Invalid VNPAY payment URL");
        }

        window.location.href = paymentUrl;
        return;
      }

      if (isMomo && orderId && orderNumber) {
        const paymentResponse = await fetch("/api/momo/create-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            orderId,
            orderNumber,
            amount: checkoutGrandTotal,
          }),
        });
        const paymentData = await paymentResponse.json();
        if (!paymentResponse.ok) {
          throw new Error(paymentData?.error || "Cannot create MOMO payment URL");
        }

        const paymentUrl = paymentData?.data?.paymentUrl as string | undefined;
        if (!paymentUrl) {
          throw new Error("Invalid MOMO payment URL");
        }

        window.location.href = paymentUrl;
        return;
      }

      if (buyNowProductId) {
        await dispatch(removeFromCartAsync(buyNowProductId)).unwrap().catch(() => null);
        dispatch(removeFromCart(buyNowProductId));
        setBuyNowProductId(null);
      } else {
        await fetch("/api/cart/clear", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }).catch(() => null);
        dispatch(clearCart());
      }
      dispatch(fetchCartAsync());
      void refreshCurrentUserFromServer();

      setPayments(true);
      handleTabClick("cartTab3");
      scrollToTop();
      toast.success("Order placed successfully");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to place order";
      toast.error(message);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleApplyCoupon = useCallback(async (inputCode?: string) => {
    const normalizedCode = (inputCode ?? couponCode).trim().toUpperCase();
    if (!normalizedCode) {
      toast.error("Please enter a coupon code");
      return;
    }
    if (checkoutSubtotal <= 0) {
      toast.error("Add items to cart before applying coupon");
      return;
    }

    setCouponApplying(true);
    try {
      const authorizationHeader = normalizeAuthorizationHeader(getToken());
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
        },
        body: JSON.stringify({
          code: normalizedCode,
          subtotal: checkoutSubtotal,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Coupon is not valid");
      }
      const coupon = data?.data as AppliedCoupon;
      setAppliedCoupon(coupon);
      setCouponCode(coupon.code);
      toast.success(`Coupon applied: -$${Number(coupon.discountAmount || 0).toFixed(2)}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Coupon is not valid";
      setAppliedCoupon(null);
      toast.error(message);
    } finally {
      setCouponApplying(false);
    }
  }, [checkoutSubtotal, couponCode]);

  useEffect(() => {
    if (!requestedCoupon || couponApplying || appliedCoupon?.code === requestedCoupon || checkoutSubtotal <= 0) {
      return;
    }
    setCouponCode(requestedCoupon);
    void handleApplyCoupon(requestedCoupon);
  }, [appliedCoupon?.code, checkoutSubtotal, couponApplying, handleApplyCoupon, requestedCoupon]);

  return (
    <div className="shoppingCartSection">
      <h2>{t("cart_title")}</h2>

      <div className="shoppingCartTabsContainer">
        <div className={`shoppingCartTabs ${activeTab}`}>
          <button
            className={activeTab === "cartTab1" ? "active" : ""}
            onClick={() => {
              handleTabClick("cartTab1");
              setPayments(false);
            }}
          >
            <div className="shoppingCartTabsNumber">
              <h3>01</h3>
              <div className="shoppingCartTabsHeading">
                <h3>{t("cart_tab_1")}</h3>
                <p>{t("cart_tab_1_desc")}</p>
              </div>
            </div>
          </button>

          <button
            className={activeTab === "cartTab2" ? "active" : ""}
            onClick={() => {
              handleTabClick("cartTab2");
              setPayments(false);
            }}
            disabled={mounted && cartItems.length === 0}
          >
            <div className="shoppingCartTabsNumber">
              <h3>02</h3>
              <div className="shoppingCartTabsHeading">
                <h3>{t("cart_tab_2")}</h3>
                <p>{t("cart_tab_2_desc")}</p>
              </div>
            </div>
          </button>

          <button
            className={activeTab === "cartTab3" ? "active" : ""}
            onClick={() => handleTabClick("cartTab3")}
            disabled={cartItems.length === 0 || payments === false}
          >
            <div className="shoppingCartTabsNumber">
              <h3>03</h3>
              <div className="shoppingCartTabsHeading">
                <h3>{t("cart_tab_3")}</h3>
                <p>{t("cart_tab_3_desc")}</p>
              </div>
            </div>
          </button>
        </div>

        <div className="shoppingCartTabsContent">
          {activeTab === "cartTab1" && (
            <div className="shoppingBagSection">
              <div className="shoppingBagTableSection">
                <table className="shoppingBagTable">
                  <thead>
                    <tr>
                      <th>{t("cart_table_product")}</th>
                      <th>{t("cart_table_action")}</th>
                      <th>{t("cart_table_price")}</th>
                      <th>{t("cart_table_quantity")}</th>
                      <th>{t("cart_table_subtotal")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartItems.length > 0 ? (
                      cartItems.map((item: cartProduct) => {
                        const product = products.find((p) => p.productID === item.productID);
                        return (
                          <tr key={item.productID}>
                            <td data-label="Product">
                              <div className="shoppingBagTableImg">
                                <Link href="/shop" onClick={scrollToTop}>
                                  <img
                                    src={product?.frontImg || "/Products/product_1.jpg"}
                                    alt={item.productName}
                                  />
                                </Link>
                              </div>
                            </td>
                            <td data-label="">
                              <div className="shoppingBagTableProductDetail">
                                <Link href="/shop" onClick={scrollToTop}>
                                  <h4>{item.productName}</h4>
                                </Link>
                                <p>{item.productReviews}</p>
                              </div>
                            </td>
                            <td data-label="Price" style={{ textAlign: "center" }}>
                              ${item.productPrice}
                            </td>
                            <td data-label="Quantity">
                              <div className="ShoppingBagTableQuantity">
                                <button
                                  onClick={() =>
                                    handleQuantityChange(item.productID, (item.quantity ?? 1) - 1)
                                  }
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={20}
                                  value={item.quantity ?? 1}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const parsed = Number(e.target.value);
                                    if (Number.isNaN(parsed)) return;
                                    handleQuantityChange(item.productID, parsed);
                                  }}
                                />
                                <button
                                  onClick={() =>
                                    handleQuantityChange(item.productID, (item.quantity ?? 1) + 1)
                                  }
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td data-label="Subtotal">
                              <p style={{ textAlign: "center", fontWeight: "500" }}>
                                ${(item.quantity ?? 1) * item.productPrice}
                              </p>
                            </td>
                            <td data-label="">
                              <div className="shoppingCartRowActions">
                                <button
                                  type="button"
                                  className="shoppingCartBuyNowButton"
                                  onClick={() => {
                                    setBuyNowProductId(String(item.productID));
                                    setSelectedPayment("VNPAY");
                                    handleTabClick("cartTab2");
                                    scrollToTop();
                                  }}
                                >
                                  {t("cart_buy_now")}
                                </button>
                                <MdOutlineClose
                                  onClick={() => void handleRemoveFromCart(item.productID)}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6}>
                          <div className="shoppingCartEmpty">
                            <span>{t("cart_empty")}</span>
                            <Link href="/shop" onClick={scrollToTop}>
                              <button>{t("cart_shop_now")}</button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th
                        colSpan={6}
                        className="shopCartFooter"
                        style={{ borderBottom: "none", padding: "20px 0px" }}
                      >
                        {cartItems.length > 0 && (
                          <div className="shopCartFooterContainer">
                            <form>
                              <input
                                type="text"
                                placeholder={t("cart_coupon_placeholder")}
                                value={couponCode}
                                onChange={(event) => setCouponCode(event.target.value)}
                              />
                              <button
                                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                  e.preventDefault();
                                  void handleApplyCoupon();
                                }}
                              >
                                {couponApplying ? t("cart_applying_coupon") : t("cart_apply_coupon")}
                              </button>
                            </form>
                            <button
                              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                e.preventDefault();
                              }}
                              className="shopCartFooterbutton"
                            >
                              {t("cart_update_cart")}
                            </button>
                          </div>
                        )}
                      </th>
                    </tr>
                  </tfoot>
                </table>

                <div className="shoppingBagTableMobile">
                  {cartItems.length > 0 ? (
                    <>
                      {cartItems.map((item: cartProduct) => {
                        const product = products.find((p) => p.productID === item.productID);
                        return (
                          <div key={item.productID}>
                            <div className="shoppingBagTableMobileItems">
                              <div className="shoppingBagTableMobileItemsImg">
                                <Link href="/shop" onClick={scrollToTop}>
                                  <img
                                    src={product?.frontImg || "/Products/product_1.jpg"}
                                    alt={item.productName}
                                  />
                                </Link>
                              </div>
                              <div className="shoppingBagTableMobileItemsDetail">
                                <div className="shoppingBagTableMobileItemsDetailMain">
                                  <Link href="/shop" onClick={scrollToTop}>
                                    <h4>{item.productName}</h4>
                                  </Link>
                                  <p>{item.productReviews}</p>
                                  <div className="shoppingBagTableMobileQuantity">
                                    <button
                                      onClick={() =>
                                        handleQuantityChange(item.productID, (item.quantity ?? 1) - 1)
                                      }
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min={1}
                                      max={20}
                                      value={item.quantity ?? 1}
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const parsed = Number(e.target.value);
                                        if (Number.isNaN(parsed)) return;
                                        handleQuantityChange(item.productID, parsed);
                                      }}
                                    />
                                    <button
                                      onClick={() =>
                                        handleQuantityChange(item.productID, (item.quantity ?? 1) + 1)
                                      }
                                    >
                                      +
                                    </button>
                                  </div>
                                  <span>${item.productPrice}</span>
                                </div>
                                <div className="shoppingBagTableMobileItemsDetailTotal">
                                  <button
                                    type="button"
                                    className="shoppingCartBuyNowButton mobile"
                                    onClick={() => {
                                      setBuyNowProductId(String(item.productID));
                                      setSelectedPayment("VNPAY");
                                      handleTabClick("cartTab2");
                                      scrollToTop();
                                    }}
                                  >
                                    {t("cart_buy_now")}
                                  </button>
                                  <MdOutlineClose
                                    size={20}
                                    onClick={() => void handleRemoveFromCart(item.productID)}
                                  />
                                  <p>${(item.quantity ?? 1) * item.productPrice}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <div className="shopCartFooter">
                        <div className="shopCartFooterContainer">
                          <form>
                            <input
                              type="text"
                              placeholder={t("cart_coupon_placeholder")}
                              value={couponCode}
                              onChange={(event) => setCouponCode(event.target.value)}
                            />
                            <button
                              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                e.preventDefault();
                                void handleApplyCoupon();
                              }}
                            >
                              {couponApplying ? t("cart_applying_coupon") : t("cart_apply_coupon")}
                            </button>
                          </form>
                          <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                              e.preventDefault();
                            }}
                            className="shopCartFooterbutton"
                          >
                            {t("cart_update_cart")}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="shoppingCartEmpty">
                      <span>{t("cart_empty")}</span>
                      <Link href="/shop" onClick={scrollToTop}>
                        <button>{t("cart_shop_now")}</button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              <div className="shoppingBagTotal">
                <h3>{t("cart_totals")}</h3>
                <table className="shoppingBagTotalTable">
                  <tbody>
                    <tr>
                      <th>{t("cart_table_subtotal")}</th>
                      <td>${totalPrice.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <th>{t("cart_shipping")}</th>
                      <td>
                        <div className="shoppingBagTotalTableCheck">
                          <p>${(totalPrice === 0 ? 0 : 5).toFixed(2)}</p>
                          <p>Shipping to Al..</p>
                          <p onClick={scrollToTop} style={{ cursor: "pointer" }}>
                            {t("cart_change_address")}
                          </p>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <th>{t("cart_vat")}</th>
                      <td>${(totalPrice === 0 ? 0 : 11).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <th>{t("cart_discount")}</th>
                      <td style={{ color: discountAmount > 0 ? "#188038" : undefined }}>
                        -${discountAmount.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <th>{t("cart_total")}</th>
                      <td>${Math.max(0, totalPrice + (totalPrice === 0 ? 0 : 16) - discountAmount).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
                <button
                  onClick={() => {
                    setBuyNowProductId(null);
                    handleTabClick("cartTab2");
                    scrollToTop();
                  }}
                  disabled={mounted && cartItems.length === 0}
                >
                  {t("cart_proceed_checkout")}
                </button>
              </div>
            </div>
          )}

          {activeTab === "cartTab2" && (
            <div className="checkoutSection">
              <div className="checkoutDetailsSection">
                <h4>{t("checkout_billing_details")}</h4>
                <div className="checkoutDetailsForm">
                  <form>
                    <div className="checkoutDetailsFormRow">
                      <input
                        type="text"
                        placeholder={t("checkout_first_name")}
                        value={checkoutForm.firstName}
                        onChange={(event) => handleCheckoutFieldChange("firstName", event.target.value)}
                        style={checkoutErrors.firstName ? { borderColor: "#d93025" } : undefined}
                      />
                      <input
                        type="text"
                        placeholder={t("checkout_last_name")}
                        value={checkoutForm.lastName}
                        onChange={(event) => handleCheckoutFieldChange("lastName", event.target.value)}
                        style={checkoutErrors.lastName ? { borderColor: "#d93025" } : undefined}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder={t("checkout_company")}
                      value={checkoutForm.companyName}
                      onChange={(event) => handleCheckoutFieldChange("companyName", event.target.value)}
                    />
                    <div className="checkoutLocationBar">
                      <button
                        type="button"
                        className="checkoutLocationButton"
                        onClick={() => void handleUseCurrentLocation()}
                        disabled={locationLoading}
                      >
                        {locationLoading ? "Detecting current location..." : "Use current location"}
                      </button>
                      <p>
                        {checkoutLocation
                          ? `${checkoutLocation.label}${checkoutLocation.accuracyMeters ? ` · ±${checkoutLocation.accuracyMeters}m` : ""}`
                          : "Fill delivery details from your device location"}
                      </p>
                      {checkoutLocation ? (
                        <p className="checkoutDeliveryCapturedNote">{t("checkout_delivery_captured")}</p>
                      ) : null}
                    </div>
                    <div className="checkoutAddressLookup">
                      <div className="checkoutAddressLookupRow">
                        <input
                          type="text"
                          placeholder="Search address (if not using current location)"
                          value={addressQuery}
                          onChange={(event) => setAddressQuery(event.target.value)}
                        />
                        <button
                          type="button"
                          className="checkoutAddressSearchButton"
                          onClick={() => void handleSearchAddress()}
                          disabled={addressSearching}
                        >
                          {addressSearching ? "Searching..." : "Search"}
                        </button>
                      </div>
                      {addressResults.length > 0 ? (
                        <div className="checkoutAddressResults" role="listbox" aria-label="Address results">
                          {addressResults.map((result, index) => (
                            <button
                              key={`${result.latitude}-${result.longitude}-${index}`}
                              type="button"
                              className="checkoutAddressResultItem"
                              onClick={() => handleSelectAddress(result)}
                            >
                              {result.displayName}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <select
                      name="country"
                      id="country"
                      value={checkoutForm.country}
                      onChange={(event) => handleCheckoutFieldChange("country", event.target.value)}
                      style={checkoutErrors.country ? { borderColor: "#d93025" } : undefined}
                    >
                      <option value="" disabled>
                        {t("checkout_country")}
                      </option>
                      {!countryOptions.includes(checkoutForm.country) && checkoutForm.country ? (
                        <option value={checkoutForm.country}>{checkoutForm.country}</option>
                      ) : null}
                      <option value="India">{t("checkout_country_india")}</option>
                      <option value="Canada">{t("checkout_country_canada")}</option>
                      <option value="United Kingdom">{t("checkout_country_uk")}</option>
                      <option value="United States">{t("checkout_country_us")}</option>
                      <option value="Turkey">{t("checkout_country_turkey")}</option>
                    </select>
                    {checkoutForm.country ? (
                      <div className="checkoutDeliveryEstimate">
                        <p className="checkoutDeliveryEstimateTitle">{t("checkout_delivery_title")}</p>
                        <p className="checkoutDeliveryEstimateBody">{t("checkout_delivery_sub")}</p>
                        <p className="checkoutDeliveryEstimateBody">{t(shippingEstimateKey(checkoutForm.country))}</p>
                      </div>
                    ) : null}
                    <input
                      type="text"
                      placeholder={t("checkout_street1")}
                      value={checkoutForm.streetAddress1}
                      onChange={(event) => handleCheckoutFieldChange("streetAddress1", event.target.value)}
                      style={checkoutErrors.streetAddress1 ? { borderColor: "#d93025" } : undefined}
                    />
                    <input
                      type="text"
                      placeholder={t("checkout_street2")}
                      value={checkoutForm.streetAddress2}
                      onChange={(event) => handleCheckoutFieldChange("streetAddress2", event.target.value)}
                    />
                    <input
                      type="text"
                      placeholder={t("checkout_city")}
                      value={checkoutForm.city}
                      onChange={(event) => handleCheckoutFieldChange("city", event.target.value)}
                      style={checkoutErrors.city ? { borderColor: "#d93025" } : undefined}
                    />
                    <input
                      type="text"
                      placeholder={t("checkout_postal")}
                      value={checkoutForm.postalCode}
                      onChange={(event) => handleCheckoutFieldChange("postalCode", event.target.value)}
                      style={checkoutErrors.postalCode ? { borderColor: "#d93025" } : undefined}
                    />
                    <input
                      type="text"
                      placeholder={t("checkout_phone")}
                      value={checkoutForm.phone}
                      onChange={(event) => handleCheckoutFieldChange("phone", event.target.value)}
                      style={checkoutErrors.phone ? { borderColor: "#d93025" } : undefined}
                    />
                    <input
                      type="email"
                      placeholder={t("checkout_email")}
                      value={checkoutForm.email}
                      onChange={(event) => handleCheckoutFieldChange("email", event.target.value)}
                      style={checkoutErrors.email ? { borderColor: "#d93025" } : undefined}
                    />
                    <div className="checkoutDetailsFormCheck">
                      <label>
                        <input
                          type="checkbox"
                          checked={checkoutForm.createAccount}
                          onChange={(event) =>
                            handleCheckoutFieldChange("createAccount", event.target.checked)
                          }
                        />
                        <p>{t("checkout_create_account")}</p>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={checkoutForm.shipToDifferentAddress}
                          onChange={(event) =>
                            handleCheckoutFieldChange("shipToDifferentAddress", event.target.checked)
                          }
                        />
                        <p>{t("checkout_ship_different")}</p>
                      </label>
                    </div>
                    <textarea
                      cols={30}
                      rows={8}
                      placeholder={t("checkout_notes")}
                      value={checkoutForm.notes}
                      onChange={(event) => handleCheckoutFieldChange("notes", event.target.value)}
                    />
                    {Object.keys(checkoutErrors).length > 0 ? (
                      <p style={{ color: "#d93025", fontSize: "14px", marginTop: "-10px" }}>
                        {t("checkout_required_error")}
                      </p>
                    ) : null}
                  </form>
                </div>
              </div>

              <div className="checkoutPaymentSection">
                <div className="checkoutTotalContainer">
                  <h3>{t("checkout_your_order")}</h3>
                  {buyNowProductId ? (
                    <p style={{ fontSize: "12px", color: "#767676", marginBottom: "10px" }}>
                      {t("checkout_buy_now_mode")}
                    </p>
                  ) : null}
                  <div className="checkoutItems">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("checkout_products")}</th>
                          <th>{t("checkout_subtotals")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {checkoutItems.map((item) => (
                          <tr key={`checkout-${item.productID}`}>
                            <td>
                              {item.productName} x {item.quantity ?? 1}
                            </td>
                            <td>${item.productPrice * (item.quantity ?? 1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="checkoutTotal">
                    <table>
                      <tbody>
                        <tr>
                          <th>Subtotal</th>
                          <td>${checkoutSubtotal.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <th>Shipping</th>
                          <td>${shippingFee.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <th>VAT</th>
                          <td>${vatAmount.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <th>Discount</th>
                          <td style={{ color: discountAmount > 0 ? "#188038" : undefined }}>
                            -${discountAmount.toFixed(2)}
                          </td>
                        </tr>
                        <tr>
                          <th>Points Discount</th>
                          <td style={{ color: pointsDiscountAmount > 0 ? "#188038" : undefined }}>
                            -${pointsDiscountAmount.toFixed(2)}
                          </td>
                        </tr>
                        <tr>
                          <th>Total</th>
                          <td>${checkoutGrandTotal.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="loyaltyPanel">
                    <h4>Loyalty Points</h4>
                    <p>Available: {availablePoints.toLocaleString()} points</p>
                    <label htmlFor="pointsToRedeem">Use points</label>
                    <input
                      id="pointsToRedeem"
                      type="number"
                      min={0}
                      max={Math.max(0, Math.min(availablePoints, maxRedeemablePointsByRate))}
                      step={1}
                      value={pointsToRedeemInput}
                      onChange={(event) => setPointsToRedeemInput(event.target.value)}
                    />
                    <small>
                      100 points = $1.00, up to 25% of order. Applying {pointsRedeemApplied.toLocaleString()} points.
                    </small>
                  </div>
                </div>

                <div className="checkoutPaymentContainer">
                  <label>
                    <input
                      type="radio"
                      name="payment"
                      value="Direct Bank Transfer"
                      checked={selectedPayment === "Direct Bank Transfer"}
                      onChange={handlePaymentChange}
                    />
                    <div className="checkoutPaymentMethod">
                      <span>{t("checkout_direct_bank")}</span>
                      <p>{t("checkout_direct_bank_desc")}</p>
                    </div>
                  </label>

                  <label>
                    <input
                      type="radio"
                      name="payment"
                      value="Check Payments"
                      checked={selectedPayment === "Check Payments"}
                      onChange={handlePaymentChange}
                    />
                    <div className="checkoutPaymentMethod">
                      <span>{t("checkout_check_payments")}</span>
                      <p>{t("checkout_check_payments_desc")}</p>
                    </div>
                  </label>

                  <label>
                    <input
                      type="radio"
                      name="payment"
                      value="Cash on delivery"
                      checked={selectedPayment === "Cash on delivery"}
                      onChange={handlePaymentChange}
                    />
                    <div className="checkoutPaymentMethod">
                      <span>{t("checkout_cod")}</span>
                      <p>{t("checkout_cod_desc")}</p>
                    </div>
                  </label>

                  <label>
                    <input
                      type="radio"
                      name="payment"
                      value="Paypal"
                      checked={selectedPayment === "Paypal"}
                      onChange={handlePaymentChange}
                    />
                    <div className="checkoutPaymentMethod">
                      <span>{t("checkout_paypal")}</span>
                      <p>{t("checkout_paypal_desc")}</p>
                    </div>
                  </label>

                  <label>
                    <input
                      type="radio"
                      name="payment"
                      value="VNPAY"
                      checked={selectedPayment === "VNPAY"}
                      onChange={handlePaymentChange}
                    />
                    <div className="checkoutPaymentMethod">
                      <span>{t("checkout_vnpay")}</span>
                      <p>{t("checkout_vnpay_desc")}</p>
                    </div>
                  </label>

                  <label>
                    <input
                      type="radio"
                      name="payment"
                      value="MOMO"
                      checked={selectedPayment === "MOMO"}
                      onChange={handlePaymentChange}
                    />
                    <div className="checkoutPaymentMethod">
                      <span>{t("checkout_momo")}</span>
                      <p>{t("checkout_momo_desc")}</p>
                    </div>
                  </label>

                  <div className="policyText">
                    {t("checkout_privacy_1")}
                    <Link href="/terms" onClick={scrollToTop}>
                      {t("checkout_privacy_2")}
                    </Link>
                    {t("checkout_privacy_3")}
                  </div>

                  <div className="checkoutTrustPanel">
                    <h4 className="checkoutTrustTitle">{t("checkout_trust_title")}</h4>
                    <ul className="checkoutTrustList">
                      <li>{t("checkout_trust_secure")}</li>
                      <li>{t("checkout_trust_dispatch")}</li>
                      <li>
                        {t("checkout_trust_returns")}{" "}
                        <Link href="/terms" onClick={scrollToTop}>
                          {t("checkout_trust_returns_link")}
                        </Link>
                        .
                      </li>
                    </ul>
                  </div>
                </div>

                <button onClick={handlePlaceOrder} disabled={isPlacingOrder}>
                  {isPlacingOrder ? t("checkout_placing_order") : t("checkout_place_order")}
                </button>
              </div>
            </div>
          )}

          {activeTab === "cartTab3" && (
            <div className="orderCompleteSection">
              <div className="orderComplete">
                <div className="orderCompleteMessage">
                  <div className="orderCompleteMessageImg">
                    <img src={success} alt="Success" />
                  </div>
                  <h3>{t("order_completed")}</h3>
                  <p>{t("order_thank_you")}</p>
                </div>

                <div className="orderInfo">
                  <div className="orderInfoItem">
                    <p>{t("order_number")}</p>
                    <h4>{lastOrderNumber || orderNumber}</h4>
                  </div>
                  <div className="orderInfoItem">
                    <p>{t("order_date")}</p>
                    <h4>{formatDate(currentDate)}</h4>
                  </div>
                  <div className="orderInfoItem">
                    <p>{t("cart_total")}</p>
                    <h4>${lastPlacedTotal.toFixed(2)}</h4>
                  </div>
                  <div className="orderInfoItem">
                    <p>{t("order_payment_method")}</p>
                    <h4>{selectedPayment}</h4>
                  </div>
                </div>

                {lastTrackingSecret ? (
                  <div className="orderTrackCallout">
                    <Link href={`/track?t=${encodeURIComponent(lastTrackingSecret)}`} onClick={scrollToTop}>
                      {t("order_track_link")}
                    </Link>
                    <p className="orderTrackHint">{t("order_track_copy_hint")}</p>
                  </div>
                ) : null}

                <div className="orderTotalContainer">
                  <h3>{t("order_details")}</h3>
                  <div className="orderItems">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("checkout_products")}</th>
                          <th>{t("checkout_subtotals")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lastPlacedItems.map((item) => (
                          <tr key={`confirm-${item.productID}`}>
                            <td>
                              {item.productName} x {item.quantity ?? 1}
                            </td>
                            <td>${item.productPrice * (item.quantity ?? 1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="orderTotal">
                    <table>
                      <tbody>
                        <tr>
                          <th>{t("cart_table_subtotal")}</th>
                          <td>${lastOrderPricing.subtotal.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <th>{t("cart_shipping")}</th>
                          <td>${lastOrderPricing.shipping.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <th>{t("cart_vat")}</th>
                          <td>${lastOrderPricing.vat.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <th>Coupon Discount</th>
                          <td style={{ color: lastOrderPricing.couponDiscount > 0 ? "#188038" : undefined }}>
                            -${lastOrderPricing.couponDiscount.toFixed(2)}
                          </td>
                        </tr>
                        <tr>
                          <th>Points Discount</th>
                          <td style={{ color: lastOrderPricing.pointsDiscount > 0 ? "#188038" : undefined }}>
                            -${lastOrderPricing.pointsDiscount.toFixed(2)}
                          </td>
                        </tr>
                        <tr>
                          <th>{t("cart_total")}</th>
                          <td>${lastPlacedTotal.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {lastLoyaltySnapshot ? (
                    <div className="loyaltyOrderSummary">
                      <p>Points redeemed: {lastLoyaltySnapshot.redeemed.toLocaleString()}</p>
                      <p>Points earned: {lastLoyaltySnapshot.earned.toLocaleString()}</p>
                      <p>Remaining points: {lastLoyaltySnapshot.remaining.toLocaleString()}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
