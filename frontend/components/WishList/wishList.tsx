"use client";

import { useProducts } from "@/hooks/useProducts";
import {
  wishListProduct,
  removeFromWishlistAsync,
} from "@/store/wishListSlice";
import { useEffect, useState } from "react";
import { RootState, useAppDispatch, useAppSelector } from "@/store/index";
import { fetchWishlistAsync } from "@/store/wishListSlice";
import { addToCartAsync, updateQuantityAsync } from "@/store/cartSlice";
import { isAuthenticated } from "@/lib/auth";
import AuthRequiredModal from "@/components/Common/AuthRequiredModal";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MdOutlineClose } from "react-icons/md";
import "./wishList.css";
import toast from "react-hot-toast";
import { useLocale } from "@/components/providers/LocaleProvider";

export default function WishList() {
  const { t } = useLocale();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { products } = useProducts();
  const [showAuthRequiredModal, setShowAuthRequiredModal] = useState(false);
  const wishlistItems = useAppSelector(
    (state: RootState) => state.wishList.itemsById
  );
  const cartItems = useAppSelector((state: RootState) => state.cart.itemsById);

  useEffect(() => {
    dispatch(fetchWishlistAsync());
  }, [dispatch]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleRemoveFromWishlist = (productID: string) => {
    dispatch(removeFromWishlistAsync(productID))
      .unwrap()
      .then(() => dispatch(fetchWishlistAsync()))
      .catch((error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Failed to remove from wishlist:", errorMessage);
      });
  };

  const handleAddToCart = (product: wishListProduct) => {
    if (!isAuthenticated()) {
      setShowAuthRequiredModal(true);
      return;
    }

    const itemInCart = cartItems[product.productID];

    if (itemInCart && (itemInCart.quantity ?? 0) >= 20) {
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
        .catch((err: any) => toast.error(err.toString()));
    } else {
      dispatch(
        addToCartAsync({
          productID: product.productID,
          productName: product.productName,
          productPrice: product.productPrice,
          productReviews: product.productReviews,
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

  return (
    <>
      <div className="wishListSection">
        <h2>{t("wishlist_title")}</h2>
        <div className="wishListContainer">
          {Object.keys(wishlistItems).length > 0 ? (
            <div className="wishListGrid">
              {Object.values(wishlistItems).map((item: wishListProduct) => {
                const product = products.find(
                  (p) => p.productID === item.productID
                );
                return (
                  <div key={item.productID} className="wishListItem">
                    <div className="wishListItemImage">
                      <Link href={"/"} onClick={scrollToTop}>
                        <img
                          src={product?.frontImg || "/Products/product_1.jpg"}
                          alt={item.productName}
                        />
                      </Link>
                      <button
                        className="wishListRemoveBtn"
                        onClick={() => handleRemoveFromWishlist(item.productID)}
                        aria-label="Remove from wishlist"
                      >
                        <MdOutlineClose size={20} />
                      </button>
                    </div>
                    <div className="wishListItemDetails">
                      <Link href={"/"} onClick={scrollToTop}>
                        <h4>{item.productName}</h4>
                      </Link>
                      <p className="wishListItemReviews">
                        {item.productReviews}
                      </p>
                      <p className="wishListItemPrice">${item.productPrice}</p>
                      <button
                        className="wishListAddToCartBtn"
                        onClick={() => handleAddToCart(item)}
                      >
                        {t("wishlist_add_to_cart")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="wishListEmpty">
              <span>{t("wishlist_empty")}</span>
              <Link href={"/"} onClick={scrollToTop}>
                <button>{t("wishlist_continue_shopping")}</button>
              </Link>
            </div>
          )}
        </div>
      </div>
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
