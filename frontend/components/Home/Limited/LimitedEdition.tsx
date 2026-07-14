"use client";

import {
  addToCartAsync,
  cartProduct,
  removeFromCartAsync,
  updateQuantityAsync} from "@/store/cartSlice";
import {
  addToWishlistAsync,
  removeFromWishlistAsync,
  clearWishList,
  wishListProduct} from "@/store/wishListSlice";
import { useAppDispatch, useAppSelector } from "@/store/index";
import toast from "react-hot-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/providers/LocaleProvider";
import "./LimitedEdition.css";

import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";

import { Navigation } from "swiper/modules";
import { Autoplay } from "swiper/modules";

import { FiHeart } from "react-icons/fi";
import { FaStar } from "react-icons/fa";
import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";
import { FaCartPlus } from "react-icons/fa";
import StoreData, { DataStore } from "@/data/StoreData";
import { useProducts } from "@/hooks/useProducts";
import { isAuthenticated } from "@/lib/auth";
import AuthRequiredModal from "@/components/Common/AuthRequiredModal";
import { useState } from "react";

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
    label: `${delta > 0 ? "+" : ""}${Math.round(delta)}%`,
    className: delta > 0 ? "priceChangeBadgeUp" : "priceChangeBadgeDown"};
}

export default function LimitedEdition() {
  const { t } = useLocale();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const {products,error,loading} = useProducts();
  const [showAuthRequiredModal, setShowAuthRequiredModal] = useState(false);

  const cartItems = useAppSelector((state) => state.cart.itemsById);
  const handleCartClick = (product: DataStore) => {
    if (!isAuthenticated()) {
      setShowAuthRequiredModal(true);
      return;
    }

    const itemInCart = cartItems[product.productID];
    const availableStock = product.active === false ? 0 : Number(product.stockQuantity ?? 25);
    const limit = Math.min(20, availableStock);

    if (availableStock <= 0) {
      toast.error("This product is out of stock", {
        duration: 2000,
        style: {
          backgroundColor: "#fb0404",
          color: "#fff"}});
      return;
    }

    if (itemInCart && (itemInCart.quantity ?? 0) >= limit) {
      toast.error("Product reach limit", {
        duration: 2000,
        style: {
          backgroundColor: "#fb0404",
          color: "#fff"},
        iconTheme: {
          primary: "#fff",
          secondary: "#fb0404"}});
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
        toast.success("Added to cart", {
          duration: 2000,
          style: {
            backgroundColor: "#07bc0c",
            color: "#fff"},
          iconTheme: {
            primary: "#fff",
            secondary: "#07bc0c"}});
      })
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        toast.error(errorMessage || "Failed to add to cart", {
          duration: 2000,
          style: {
            backgroundColor: "#fb0404",
            color: "#fff"}});
      });
  };

  const wishListItems = useAppSelector(
    (state) => state.wishList.itemsById
  );
  const handleWishListClick = (product: DataStore) => {
    const isInWishList = wishListItems[product.productID];
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
          const errorMessage = error instanceof Error ? error.message : String(error);
          toast.error(errorMessage || "Failed to remove from wishlist", {
            duration: 2000,
            style: {
              backgroundColor: "#fb0404",
              color: "#fff"}});
        });
    } else {
      dispatch(
        addToWishlistAsync({
          productID: product.productID,
          productName: product.productName,
          productPrice: product.productPrice,
          productReviews: product.productReviews})
      )
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
          const errorMessage = error instanceof Error ? error.message : String(error);
          toast.error(errorMessage || "Failed to add to wishlist", {
            duration: 2000,
            style: {
              backgroundColor: "#fb0404",
              color: "#fff"}});
        });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"});
  };

  return (
    <>
      <div className="LimitedEditionSection">
        <div className="jp-title-wrap">
          <span className="jp-subtitle">LIMITED EDITIONS / 数量限定・特別モデル</span>
          <h2>
            {t("home_limited")} <span> {t("home_edition")}</span>
          </h2>
        </div>
        <div className="limitedEditionSlider">
          <div className="swiper-button image-swiper-button-next">
            <IoIosArrowBack />
          </div>
          <div className="swiper-button image-swiper-button-prev">
            <IoIosArrowForward />
          </div>
          <Swiper
            slidesPerView={4}
            slidesPerGroup={4}
            spaceBetween={30}
            loop={true}
            navigation={{
              nextEl: ".image-swiper-button-next",
              prevEl: ".image-swiper-button-prev"}}
            autoplay={{
              delay: 2500,
              disableOnInteraction: false,
              pauseOnMouseEnter: true}}
            modules={[Navigation, Autoplay]}
            breakpoints={{
              320: {
                slidesPerView: 2,
                slidesPerGroup: 1,
                spaceBetween: 14},
              768: {
                slidesPerView: 3,
                slidesPerGroup: 1,
                spaceBetween: 24},
              1024: {
                slidesPerView: 4,
                slidesPerGroup: 1,
                spaceBetween: 30}}}
          >
            {products.slice(8, 13).map((product: DataStore) => {
              const priceChange = getPriceChangeInfo(product);
              return (
                <SwiperSlide key={product.productID}>
                  <div className="lpContainer">
                    <div className="lpImageContainer">
                      {priceChange && <span className={`priceChangeBadge ${priceChange.className}`}>{priceChange.label}</span>}
                      <Link href="/" onClick={scrollToTop}>
                        <img
                          src={product.frontImg}
                          alt={product.productName}
                          className="lpImage"
                        ></img>
                      </Link>
                      <h4
                        onClick={() => handleCartClick(product)}
                      >
                        {t("home_add_to_cart")}
                      </h4>
                    </div>
                    <div 
                      className="lpImageProductCart"
                      onClick={() => handleCartClick(product)}
                    >
                      <FaCartPlus />
                    </div>
                    <div className="limitedProductInfo">
                      <div className="lpCategoryWishList">
                        <FiHeart
                          onClick={() => handleWishListClick(product)}
                          color={
                            wishListItems[product.productID] ? "red" : "black"
                          }
                          cursor="pointer"
                        />
                      </div>
                      <div className="productNameInfo">
                        <Link href="/" onClick={scrollToTop}>
                          <h5>{product.productName}</h5>
                        </Link>
                      </div>
                      {priceChange ? (
                        <p className="priceChangeText">
                          <span className="priceOld">$ {priceChange.oldPrice}</span>
                          <span className="priceNew">$ {priceChange.newPrice}</span>
                        </p>
                      ) : (
                        <p>$ {product.productPrice}</p>
                      )}
                      <div className="productRatingReviews">
                        <div className="productRatingStar">
                          <FaStar color="#FEC78A" size={10}></FaStar>
                          <FaStar color="#FEC78A" size={10}></FaStar>
                          <FaStar color="#FEC78A" size={10}></FaStar>
                          <FaStar color="#FEC78A" size={10}></FaStar>
                        </div>
                        <p>{product.productReviews}</p>
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
              );
            })}
          </Swiper>
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
