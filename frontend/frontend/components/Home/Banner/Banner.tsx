"use client";
import Link from "next/link";
import "./Banner.css";

export default function Banner() {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };
  return (
    <>
      <div className="banner">
        <div className="bannerLeft bannerPanel bannerPanelDark">
          <h6 className="bannerh6">Starting At $19</h6>
          <h3 className="bannerh3">Women's T-shirts</h3>
          <h5 className="bannerh5">
            <Link href="/shop" onClick={scrollToTop}>
              Shop Now
            </Link>
          </h5>
        </div>
        <div className="bannerRight bannerPanel bannerPanelLight">
          <h6 className="bannerh6">Starting At $39</h6>
          <h3 className="bannerh3">Men's Sportswear</h3>
          <h5 className="bannerh5">
            <Link href="/shop" onClick={scrollToTop}>
              Shop Now
            </Link>
          </h5>
        </div>
      </div>
    </>
  );
}
