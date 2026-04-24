"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import "./Banner.css";

export default function Banner() {
  const [leftUrl, setLeftUrl] = useState("/Banner/banner_1.jpg");
  const [rightUrl, setRightUrl] = useState("/Banner/banner_2.jpg");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const settings = data?.settings ?? {};
        if (settings.banner_left_url) setLeftUrl(settings.banner_left_url);
        if (settings.banner_right_url) setRightUrl(settings.banner_right_url);
      })
      .catch((err) => console.error("Error fetching home settings:", err));
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };
  return (
    <>
      <div className="banner">
        <div className="bannerLeft bannerPanel bannerPanelDark" style={{ backgroundImage: `url("${leftUrl}")` }}>
          <h6 className="bannerh6">Starting At $19</h6>
          <h3 className="bannerh3">Women's T-shirts</h3>
          <h5 className="bannerh5">
            <Link href="/shop" onClick={scrollToTop}>
              Shop Now
            </Link>
          </h5>
        </div>
        <div className="bannerRight bannerPanel bannerPanelLight" style={{ backgroundImage: `url("${rightUrl}")` }}>
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
