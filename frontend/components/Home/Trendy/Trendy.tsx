"use client";

import { RootState, useAppDispatch, useAppSelector } from "@/store/index";
import {
  addToCartAsync,
  updateQuantityAsync,
} from "@/store/cartSlice";
import toast from "react-hot-toast";
import {
  removeFromWishlistAsync,
  addToWishlistAsync,
  wishListProduct,
} from "@/store/wishListSlice";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DataStore } from "@/data/StoreData";
import { useProducts } from "@/hooks/useProducts";
import { isAuthenticated } from "@/lib/auth";
import AuthRequiredModal from "@/components/Common/AuthRequiredModal";
import "./Trendy.css";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { FiHeart } from "react-icons/fi";
import { FaStar, FaCartPlus } from "react-icons/fa";
import { IoClose } from "react-icons/io5";

export default function Trendy() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { products, loading, error } = useProducts();
  const [showAuthRequiredModal, setShowAuthRequiredModal] = useState(false);
  const [authAction, setAuthAction] = useState<"cart" | "wishlist">("cart");
  const [selectedProduct, setSelectedProduct] = useState<DataStore | null>(null);
  const [buyNowProductId, setBuyNowProductId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  const cartItems = useAppSelector((state: RootState) => state.cart.itemsById);
  const handleCartClick = (product: DataStore) => {
    if (!isAuthenticated()) {
      setAuthAction("cart");
      setShowAuthRequiredModal(true);
      return;
    }

    const itemInCart = cartItems[product.productID];
    const availableStock = product.active === false ? 0 : Number(product.stockQuantity ?? 25);
    const limit = Math.min(20, availableStock);

    if (availableStock <= 0) {
      toast.error("This product is out of stock", {
        duration: 2000,
        style: { backgroundColor: "#fb0404", color: "#fff" },
      });
      return;
    }

    if (itemInCart && (itemInCart.quantity ?? 0) >= limit) {
      toast.error("Product reached limit", {
        duration: 2000,
        style: { backgroundColor: "#fb0404", color: "#fff" },
      });
      return;
    }

    const quantityToAdd = 1;
    if (itemInCart) {
      dispatch(
        updateQuantityAsync({
          productID: product.productID,
          quantity: (itemInCart.quantity ?? 0) + quantityToAdd,
        })
      )
        .unwrap()
        .then(() =>
          toast.success("Updated quantity", {
            duration: 2000,
            style: { backgroundColor: "#07bc0c", color: "#fff" },
          })
        )
        .catch((err) => toast.error(err.toString()));
    } else {
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
        .then(() =>
          toast.success("Added to cart", {
            duration: 2000,
            style: { backgroundColor: "#07bc0c", color: "#fff" },
          })
        )
        .catch((err) => toast.error(err.toString()));
    }
  };

  const wishListItem = useAppSelector((state) => state.wishList.itemsById);
  const handleWishListClick = (product: wishListProduct) => {
    if (!isAuthenticated()) {
      setAuthAction("wishlist");
      setShowAuthRequiredModal(true);
      return;
    }

    const isInWishList = wishListItem[product.productID];
    if (isInWishList) {
      dispatch(removeFromWishlistAsync(product.productID))
        .unwrap()
        .then(() => {
          +toast.success("Removed from wish list", {
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
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          toast.error(errorMessage || "Failed to remove from wishlist", {
            duration: 2000,
            style: {
              backgroundColor: "#fb0404",
              color: "#fff",
            },
          });
        });
    } else {
      dispatch(addToWishlistAsync({ ...product }))
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
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          toast.error(errorMessage || "Failed to add to wishlist", {
            duration: 2000,
            style: {
              backgroundColor: "#fb0404",
              color: "#fff",
            },
          });
        });
    }
  };

  const openProductModal = (product: DataStore) => {
    setSelectedProduct(product);
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleBuyNow = async (product: DataStore) => {
    if (!isAuthenticated()) {
      setAuthAction("cart");
      setShowAuthRequiredModal(true);
      return;
    }

    const availableStock = product.active === false ? 0 : Number(product.stockQuantity ?? 25);
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

  const [activeTab, setActiveTab] = useState("tab1");
  const handleActiveTab = (tab: string) => {
    setActiveTab(tab);
  };

  const sortByPrice = (a: DataStore, b: DataStore): number => {
    return a.productPrice - b.productPrice;
  };

  const sortByReviews = (a: DataStore, b: DataStore): number => {
    const reviewA = parseInt(
      a.productReviews.replace("k+ reviews", "").replace(",", "")
    );
    const reviewB = parseInt(
      b.productReviews.replace("k+ reviews", "").replace(",", "")
    );
    return reviewA - reviewB;
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <>
      <div className="trendyProduct">
        <h2>
          OUR TRENDY <span>PRODUCTS</span>
        </h2>
        <div className="trendyTabs">
          <div className="tabs">
            <p
              onClick={() => handleActiveTab("tab1")}
              className={activeTab === "tab1" ? "active" : ""}
            >
              ALL
            </p>
            <p
              onClick={() => handleActiveTab("tab2")}
              className={activeTab === "tab2" ? "active" : ""}
            >
              NEW ARRIVALS
            </p>
            <p
              onClick={() => handleActiveTab("tab3")}
              className={activeTab === "tab3" ? "active" : ""}
            >
              BEST SELLER
            </p>
            <p
              onClick={() => handleActiveTab("tab4")}
              className={activeTab === "tab4" ? "active" : ""}
            >
              TOP RATED
            </p>
          </div>
          <div className="trendyTabContent">
            {loading && (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <p>Loading products...</p>
              </div>
            )}
            {error && (
              <div
                style={{ textAlign: "center", padding: "40px", color: "red" }}
              >
                <p>{error}</p>
              </div>
            )}
            {!loading && !error && activeTab === "tab1" && (
              <div className="trendyMainContainer">
                {products.slice(0, 8).map((product: DataStore) => (
                  <div
                    className="trendyProductContainer"
                    key={product.productID}
                  >
                    <div className="trendyProductImages">
                      <button
                        type="button"
                        className="trendyProductPreviewButton"
                        onClick={() => openProductModal(product)}
                        aria-label={`View details for ${product.productName}`}
                      >
                        <img
                          src={product.frontImg}
                          alt={product.productName}
                          className="trendyProduct_font"
                        />
                        <img
                          src={product.backImg}
                          alt={product.productName}
                          className="trendyProduct_back"
                        />
                      </button>
                      <h4
                        onClick={() => {
                          handleCartClick({ ...product });
                        }}
                      >
                        Add to cart
                      </h4>
                    </div>
                    <div
                      className="trendyProductImageCart"
                      onClick={() => handleCartClick({ ...product })}
                    >
                      <FaCartPlus />
                    </div>
                    <div className="trendyProductInfo">
                      <div className="trendyProductWishList">
                        <FiHeart
                          onClick={() => handleWishListClick({ ...product })}
                          style={{
                            color: wishListItem[product.productID]
                              ? "red"
                              : "black",
                            cursor: "pointer",
                          }}
                        />
                      </div>

                      <div className="trendyProductNameInfo">
                        <Link href="/" onClick={scrollToTop}>
                          <h5>{product.productName}</h5>
                        </Link>
                      </div>

                      <p>$ {product.productPrice}</p>
                      <button
                        type="button"
                        className="trendyBuyNowButton"
                        disabled={(product.active === false ? 0 : Number(product.stockQuantity ?? 25)) <= 0 || buyNowProductId === product.productID}
                        onClick={() => void handleBuyNow(product)}
                      >
                        {buyNowProductId === product.productID ? "Processing..." : "Buy Now"}
                      </button>

                      <div className="trendyProductRatingReviews">
                        <div className="trendyProductRatingStar">
                          <FaStar color="#FEC78A" size={10} />
                          <FaStar color="#FEC78A" size={10} />
                          <FaStar color="#FEC78A" size={10} />
                          <FaStar color="#FEC78A" size={10} />
                        </div>
                        <p>{product.productReviews}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && !error && activeTab === "tab2" && (
              <div className="trendyMainContainer">
                {products
                  .slice(0, 8)
                  .reverse()
                  .map((product: DataStore) => (
                    <div
                      className="trendyProductContainer"
                      key={product.productID}
                    >
                      <div className="trendyProductImages">
                        <button
                          type="button"
                          className="trendyProductPreviewButton"
                          onClick={() => openProductModal(product)}
                          aria-label={`View details for ${product.productName}`}
                        >
                          <img
                            src={product.frontImg}
                            alt={product.productName}
                            className="trendyProduct_font"
                          />
                          <img
                            src={product.backImg}
                            alt={product.productName}
                            className="trendyProduct_back"
                          />
                        </button>
                        <h4
                          onClick={() => {
                            handleCartClick({ ...product });
                          }}
                        >
                          Add to cart
                        </h4>
                      </div>
                      <div
                        className="trendyProductImageCart"
                        onClick={() => handleCartClick({ ...product })}
                      >
                        <FaCartPlus />
                      </div>
                      <div className="trendyProductInfo">
                        <div className="trendyProductWishList">
                          <FiHeart
                            onClick={() => handleWishListClick({ ...product })}
                            style={{
                              color: wishListItem[product.productID]
                                ? "red"
                                : "black",
                              cursor: "pointer",
                            }}
                          />
                        </div>

                        <div className="trendyProductNameInfo">
                          <Link href="/" onClick={scrollToTop}>
                            <h5>{product.productName}</h5>
                          </Link>
                        </div>

                        <p>$ {product.productPrice}</p>
                        <button
                          type="button"
                          className="trendyBuyNowButton"
                          disabled={(product.active === false ? 0 : Number(product.stockQuantity ?? 25)) <= 0 || buyNowProductId === product.productID}
                          onClick={() => void handleBuyNow(product)}
                        >
                          {buyNowProductId === product.productID ? "Processing..." : "Buy Now"}
                        </button>

                        <div className="trendyProductRatingReviews">
                          <div className="trendyProductRatingStar">
                            <FaStar color="#FEC78A" size={10} />
                            <FaStar color="#FEC78A" size={10} />
                            <FaStar color="#FEC78A" size={10} />
                            <FaStar color="#FEC78A" size={10} />
                          </div>
                          <p>{product.productReviews}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {!loading && !error && activeTab === "tab3" && (
              <div className="trendyMainContainer">
                {products
                  .slice(0, 8)
                  .sort(sortByPrice)
                  .map((product: DataStore) => (
                    <div
                      className="trendyProductContainer"
                      key={product.productID}
                    >
                      <div className="trendyProductImages">
                        <button
                          type="button"
                          className="trendyProductPreviewButton"
                          onClick={() => openProductModal(product)}
                          aria-label={`View details for ${product.productName}`}
                        >
                          <img
                            src={product.frontImg}
                            alt={product.productName}
                            className="trendyProduct_font"
                          />
                          <img
                            src={product.backImg}
                            alt={product.productName}
                            className="trendyProduct_back"
                          />
                        </button>
                        <h4
                          onClick={() => {
                            handleCartClick({ ...product });
                          }}
                        >
                          Add to cart
                        </h4>
                      </div>
                      <div
                        className="trendyProductImageCart"
                        onClick={() => handleCartClick({ ...product })}
                      >
                        <FaCartPlus />
                      </div>
                      <div className="trendyProductInfo">
                        <div className="trendyProductWishList">
                          <FiHeart
                            onClick={() => handleWishListClick({ ...product })}
                            style={{
                              color: wishListItem[product.productID]
                                ? "red"
                                : "black",
                              cursor: "pointer",
                            }}
                          />
                        </div>

                        <div className="trendyProductNameInfo">
                          <Link href="/" onClick={scrollToTop}>
                            <h5>{product.productName}</h5>
                          </Link>
                        </div>

                        <p>$ {product.productPrice}</p>
                        <button
                          type="button"
                          className="trendyBuyNowButton"
                          disabled={(product.active === false ? 0 : Number(product.stockQuantity ?? 25)) <= 0 || buyNowProductId === product.productID}
                          onClick={() => void handleBuyNow(product)}
                        >
                          {buyNowProductId === product.productID ? "Processing..." : "Buy Now"}
                        </button>

                        <div className="trendyProductRatingReviews">
                          <div className="trendyProductRatingStar">
                            <FaStar color="#FEC78A" size={10} />
                            <FaStar color="#FEC78A" size={10} />
                            <FaStar color="#FEC78A" size={10} />
                            <FaStar color="#FEC78A" size={10} />
                          </div>
                          <p>{product.productReviews}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {!loading && !error && activeTab === "tab4" && (
              <div className="trendyMainContainer">
                {products
                  .slice(0, 8)
                  .sort(sortByReviews)
                  .map((product: DataStore) => (
                    <div
                      className="trendyProductContainer"
                      key={product.productID}
                    >
                      <div className="trendyProductImages">
                        <button
                          type="button"
                          className="trendyProductPreviewButton"
                          onClick={() => openProductModal(product)}
                          aria-label={`View details for ${product.productName}`}
                        >
                          <img
                            src={product.frontImg}
                            alt={product.productName}
                            className="trendyProduct_font"
                          />
                          <img
                            src={product.backImg}
                            alt={product.productName}
                            className="trendyProduct_back"
                          />
                        </button>
                        <h4
                          onClick={() => {
                            handleCartClick({ ...product });
                          }}
                        >
                          Add to cart
                        </h4>
                      </div>
                      <div
                        className="trendyProductImageCart"
                        onClick={() => handleCartClick({ ...product })}
                      >
                        <FaCartPlus />
                      </div>
                      <div className="trendyProductInfo">
                        <div className="trendyProductWishList">
                          <FiHeart
                            onClick={() => handleWishListClick({ ...product })}
                            style={{
                              color: wishListItem[product.productID]
                                ? "red"
                                : "black",
                              cursor: "pointer",
                            }}
                          />
                        </div>

                        <div className="trendyProductNameInfo">
                          <Link href="/" onClick={scrollToTop}>
                            <h5>{product.productName}</h5>
                          </Link>
                        </div>

                        <p>$ {product.productPrice}</p>
                        <button
                          type="button"
                          className="trendyBuyNowButton"
                          disabled={(product.active === false ? 0 : Number(product.stockQuantity ?? 25)) <= 0 || buyNowProductId === product.productID}
                          onClick={() => void handleBuyNow(product)}
                        >
                          {buyNowProductId === product.productID ? "Processing..." : "Buy Now"}
                        </button>

                        <div className="trendyProductRatingReviews">
                          <div className="trendyProductRatingStar">
                            <FaStar color="#FEC78A" size={10} />
                            <FaStar color="#FEC78A" size={10} />
                            <FaStar color="#FEC78A" size={10} />
                            <FaStar color="#FEC78A" size={10} />
                          </div>
                          <p>{product.productReviews}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
        <div className="discoverMore">
          <Link href="/" onClick={scrollToTop}>
            <p>Discover More</p>
          </Link>
        </div>
      </div>
      {isClient && selectedProduct && createPortal(
        <div className="trendyProductModalOverlay" onClick={closeProductModal}>
          <div
            className="trendyProductModal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedProduct.productName} details`}
          >
            <button
              type="button"
              className="trendyProductModalClose"
              aria-label="Close product details"
              onClick={closeProductModal}
            >
              <IoClose />
            </button>

            <div className="trendyProductModalContent">
              <div className="trendyProductModalImageWrap">
                <img src={selectedProduct.frontImg} alt={selectedProduct.productName} />
              </div>
              <div className="trendyProductModalInfo">
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
                  <strong>Status:</strong> {selectedProduct.active === false ? "Inactive" : "Active"}
                </p>
                <button
                  type="button"
                  className="trendyProductModalCartButton"
                  onClick={() => handleCartClick({ ...selectedProduct })}
                >
                  Add to cart
                </button>
                <button
                  type="button"
                  className="trendyBuyNowButton"
                  disabled={(selectedProduct.active === false ? 0 : Number(selectedProduct.stockQuantity ?? 25)) <= 0 || buyNowProductId === selectedProduct.productID}
                  onClick={() => void handleBuyNow(selectedProduct)}
                >
                  {buyNowProductId === selectedProduct.productID ? "Processing..." : "Buy Now"}
                </button>
                <Link
                  href={`/shop?focus=${encodeURIComponent(selectedProduct.productID)}`}
                  onClick={() => {
                    closeProductModal();
                    scrollToTop();
                  }}
                >
                  View in shop
                </Link>
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
        message={
          authAction === "wishlist"
            ? "You need to log in before adding products to your wishlist."
            : "You need to log in before adding products to your cart."
        }
      />
    </>
  );
}
