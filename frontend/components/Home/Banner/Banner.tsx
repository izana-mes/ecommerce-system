"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import "./Banner.css";

export default function Banner() {
  const { t } = useLocale();
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
      behavior: "smooth"});
  };
  return (
    <>
      <div className="banner" data-nav-blur-region="home-banner" data-floating-banner>
        <div className="bannerLeft bannerPanel bannerPanelDark" style={{ backgroundImage: `url("${leftUrl}")` }}>
          <h6 className="bannerh6">{t("home_starting_at_19")}</h6>
          <h3 className="bannerh3">{t("home_womens_tshirts")}</h3>
          <h5 className="bannerh5">
            <Link href="/shop" onClick={scrollToTop}>
              {t("home_shop_now")}
            </Link>
          </h5>
        </div>
        <div className="bannerRight bannerPanel bannerPanelLight" style={{ backgroundImage: `url("${rightUrl}")` }}>
          <h6 className="bannerh6">{t("home_starting_at_39")}</h6>
          <h3 className="bannerh3">{t("home_mens_sportswear")}</h3>
          <h5 className="bannerh5">
            <Link href="/shop" onClick={scrollToTop}>
              {t("home_shop_now")}
            </Link>
          </h5>
        </div>
      </div>
    </>
  );
}
