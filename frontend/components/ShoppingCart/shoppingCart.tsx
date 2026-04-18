"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MdOutlineClose } from "react-icons/md";
import toast from "react-hot-toast";

import { useProducts } from "@/hooks/useProducts";
import {
  cartProduct,
  clearCart,
  fetchCartAsync,
  removeFromCartAsync,
  selectCartTotalAmount,
  updateQuantityAsync,
} from "@/store/cartSlice";
import { useAppDispatch, useAppSelector } from "@/store";
import { getToken, getUser } from "@/lib/auth";

import "./shoppingCart.css";

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
type AppliedCoupon = {
  couponId: number;
  code: string;
  title: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountAmount: number;
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function ShoppingCart() {
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
  const [couponCode, setCouponCode] = useState("");
  const [couponApplying, setCouponApplying] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const requestedStep = (searchParams.get("step") || "").trim().toLowerCase();
  const requestedBuyNow = (searchParams.get("buyNow") || "").trim();
  const requestedPayment = (searchParams.get("payment") || "").trim().toLowerCase();

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
  const checkoutGrandTotal = Math.max(0, checkoutSubtotal + shippingFee + vatAmount - discountAmount);

  useEffect(() => {
    if (!appliedCoupon) return;
    setAppliedCoupon(null);
  }, [checkoutSubtotal]);

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
          notes: combinedNotes || undefined,
          paymentMethod: selectedPayment,
          orderSource: buyNowProductId ? "buy-now" : "checkout-ui",
          // Product prices in cart are USD-based; server converts to VND for VNPAY.
          currency: "USD",
          shippingFee: checkoutSubtotal === 0 ? 0 : 5,
          vat: checkoutSubtotal === 0 ? 0 : 11,
          couponCode: appliedCoupon?.code,
          couponDiscount: discountAmount,
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
      if (orderNumber) setLastOrderNumber(orderNumber);

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

      if (buyNowProductId) {
        await dispatch(removeFromCartAsync(buyNowProductId)).unwrap().catch(() => null);
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

  const handleApplyCoupon = async () => {
    const normalizedCode = couponCode.trim().toUpperCase();
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
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
  };

  return (
    <div className="shoppingCartSection">
      <h2>Cart</h2>

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
                <h3>Shopping Bag</h3>
                <p>Manage Your Items List</p>
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
                <h3>Shipping and Checkout</h3>
                <p>Checkout Your Items List</p>
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
                <h3>Confirmation</h3>
                <p>Review And Submit Your Order</p>
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
                      <th>Product</th>
                      <th>Action</th>
                      <th>Price</th>
                      <th>Quantity</th>
                      <th>Subtotal</th>
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
                                  Buy Now
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
                            <span>Your cart is empty!</span>
                            <Link href="/shop" onClick={scrollToTop}>
                              <button>Shop Now</button>
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
                                placeholder="Coupon Code"
                                value={couponCode}
                                onChange={(event) => setCouponCode(event.target.value)}
                              />
                              <button
                                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                  e.preventDefault();
                                  void handleApplyCoupon();
                                }}
                              >
                                {couponApplying ? "Applying..." : "Apply Coupon"}
                              </button>
                            </form>
                            <button
                              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                e.preventDefault();
                              }}
                              className="shopCartFooterbutton"
                            >
                              Update Cart
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
                                    Buy Now
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
                              placeholder="Coupon Code"
                              value={couponCode}
                              onChange={(event) => setCouponCode(event.target.value)}
                            />
                            <button
                              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                e.preventDefault();
                                void handleApplyCoupon();
                              }}
                            >
                              {couponApplying ? "Applying..." : "Apply Coupon"}
                            </button>
                          </form>
                          <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                              e.preventDefault();
                            }}
                            className="shopCartFooterbutton"
                          >
                            Update Cart
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="shoppingCartEmpty">
                      <span>Your cart is empty!</span>
                      <Link href="/shop" onClick={scrollToTop}>
                        <button>Shop Now</button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              <div className="shoppingBagTotal">
                <h3>Cart Totals</h3>
                <table className="shoppingBagTotalTable">
                  <tbody>
                    <tr>
                      <th>Subtotal</th>
                      <td>${totalPrice.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <th>Shipping</th>
                      <td>
                        <div className="shoppingBagTotalTableCheck">
                          <p>${(totalPrice === 0 ? 0 : 5).toFixed(2)}</p>
                          <p>Shipping to Al..</p>
                          <p onClick={scrollToTop} style={{ cursor: "pointer" }}>
                            CHANGE ADDRESS
                          </p>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <th>VAT</th>
                      <td>${(totalPrice === 0 ? 0 : 11).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <th>Discount</th>
                      <td style={{ color: discountAmount > 0 ? "#188038" : undefined }}>
                        -${discountAmount.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <th>Total</th>
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
                  Proceed to Checkout
                </button>
              </div>
            </div>
          )}

          {activeTab === "cartTab2" && (
            <div className="checkoutSection">
              <div className="checkoutDetailsSection">
                <h4>Billing Details</h4>
                <div className="checkoutDetailsForm">
                  <form>
                    <div className="checkoutDetailsFormRow">
                      <input
                        type="text"
                        placeholder="First Name"
                        value={checkoutForm.firstName}
                        onChange={(event) => handleCheckoutFieldChange("firstName", event.target.value)}
                        style={checkoutErrors.firstName ? { borderColor: "#d93025" } : undefined}
                      />
                      <input
                        type="text"
                        placeholder="Last Name"
                        value={checkoutForm.lastName}
                        onChange={(event) => handleCheckoutFieldChange("lastName", event.target.value)}
                        style={checkoutErrors.lastName ? { borderColor: "#d93025" } : undefined}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Company Name (optional)"
                      value={checkoutForm.companyName}
                      onChange={(event) => handleCheckoutFieldChange("companyName", event.target.value)}
                    />
                    <select
                      name="country"
                      id="country"
                      value={checkoutForm.country}
                      onChange={(event) => handleCheckoutFieldChange("country", event.target.value)}
                      style={checkoutErrors.country ? { borderColor: "#d93025" } : undefined}
                    >
                      <option value="" disabled>
                        Country / Region
                      </option>
                      <option value="India">India</option>
                      <option value="Canada">Canada</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="United States">United States</option>
                      <option value="Turkey">Turkey</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Street Address*"
                      value={checkoutForm.streetAddress1}
                      onChange={(event) => handleCheckoutFieldChange("streetAddress1", event.target.value)}
                      style={checkoutErrors.streetAddress1 ? { borderColor: "#d93025" } : undefined}
                    />
                    <input
                      type="text"
                      placeholder="Apartment, suite, unit, etc. (optional)"
                      value={checkoutForm.streetAddress2}
                      onChange={(event) => handleCheckoutFieldChange("streetAddress2", event.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Town / City *"
                      value={checkoutForm.city}
                      onChange={(event) => handleCheckoutFieldChange("city", event.target.value)}
                      style={checkoutErrors.city ? { borderColor: "#d93025" } : undefined}
                    />
                    <input
                      type="text"
                      placeholder="Postcode / ZIP *"
                      value={checkoutForm.postalCode}
                      onChange={(event) => handleCheckoutFieldChange("postalCode", event.target.value)}
                      style={checkoutErrors.postalCode ? { borderColor: "#d93025" } : undefined}
                    />
                    <input
                      type="text"
                      placeholder="Phone *"
                      value={checkoutForm.phone}
                      onChange={(event) => handleCheckoutFieldChange("phone", event.target.value)}
                      style={checkoutErrors.phone ? { borderColor: "#d93025" } : undefined}
                    />
                    <input
                      type="email"
                      placeholder="Your Mail *"
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
                        <p>Create An Account?</p>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={checkoutForm.shipToDifferentAddress}
                          onChange={(event) =>
                            handleCheckoutFieldChange("shipToDifferentAddress", event.target.checked)
                          }
                        />
                        <p>Ship to a different Address</p>
                      </label>
                    </div>
                    <textarea
                      cols={30}
                      rows={8}
                      placeholder="Order Notes (Optional)"
                      value={checkoutForm.notes}
                      onChange={(event) => handleCheckoutFieldChange("notes", event.target.value)}
                    />
                    {Object.keys(checkoutErrors).length > 0 ? (
                      <p style={{ color: "#d93025", fontSize: "14px", marginTop: "-10px" }}>
                        Please fill all required billing fields marked with *.
                      </p>
                    ) : null}
                  </form>
                </div>
              </div>

              <div className="checkoutPaymentSection">
                <div className="checkoutTotalContainer">
                  <h3>Your Order</h3>
                  {buyNowProductId ? (
                    <p style={{ fontSize: "12px", color: "#767676", marginBottom: "10px" }}>
                      Buy now mode: checking out selected item only.
                    </p>
                  ) : null}
                  <div className="checkoutItems">
                    <table>
                      <thead>
                        <tr>
                          <th>PRODUCTS</th>
                          <th>SUBTOTALS</th>
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
                          <th>Total</th>
                          <td>${checkoutGrandTotal.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
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
                      <span>Direct Bank Transfer</span>
                      <p>
                        Make your payment directly into our bank account. Please use your Order
                        ID as the payment reference. Your order will not be shipped until the
                        funds have cleared in our account.
                      </p>
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
                      <span>Check Payments</span>
                      <p>
                        Phasellus sed volutpat orci. Fusce eget lore mauris vehicula elementum
                        gravida nec dui. Aenean aliquam varius ipsum.
                      </p>
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
                      <span>Cash on delivery</span>
                      <p>
                        Phasellus sed volutpat orci. Fusce eget lore mauris vehicula elementum
                        gravida nec dui. Aenean aliquam varius ipsum.
                      </p>
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
                      <span>Paypal</span>
                      <p>
                        Phasellus sed volutpat orci. Fusce eget lore mauris vehicula elementum
                        gravida nec dui. Aenean aliquam varius ipsum.
                      </p>
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
                      <span>VNPAY (Sandbox)</span>
                      <p>Thanh toan qua cong VNPAY test. Ban se duoc chuyen huong sang VNPAY.</p>
                    </div>
                  </label>

                  <div className="policyText">
                    Your personal data will be used to process your order, support your
                    experience throughout this website, and for other purposes described in our{" "}
                    <Link href="/terms" onClick={scrollToTop}>
                      Privacy Policy
                    </Link>
                    .
                  </div>
                </div>

                <button onClick={handlePlaceOrder} disabled={isPlacingOrder}>
                  {isPlacingOrder ? "Placing Order..." : "Place Order"}
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
                  <h3>Your order is completed!</h3>
                  <p>Thank you. Your order has been received.</p>
                </div>

                <div className="orderInfo">
                  <div className="orderInfoItem">
                    <p>Order Number</p>
                    <h4>{lastOrderNumber || orderNumber}</h4>
                  </div>
                  <div className="orderInfoItem">
                    <p>Date</p>
                    <h4>{formatDate(currentDate)}</h4>
                  </div>
                  <div className="orderInfoItem">
                    <p>Total</p>
                    <h4>${totalPrice.toFixed(2)}</h4>
                  </div>
                  <div className="orderInfoItem">
                    <p>Payment Method</p>
                    <h4>{selectedPayment}</h4>
                  </div>
                </div>

                <div className="orderTotalContainer">
                  <h3>Order Details</h3>
                  <div className="orderItems">
                    <table>
                      <thead>
                        <tr>
                          <th>PRODUCTS</th>
                          <th>SUBTOTALS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cartItems.map((item) => (
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
                          <th>Subtotal</th>
                          <td>${totalPrice.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <th>Shipping</th>
                          <td>$5</td>
                        </tr>
                        <tr>
                          <th>VAT</th>
                          <td>$11</td>
                        </tr>
                        <tr>
                          <th>Total</th>
                          <td>${(totalPrice === 0 ? 0 : totalPrice + 16).toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
