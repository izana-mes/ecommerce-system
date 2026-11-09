"use client";

import dynamic from "next/dynamic";
import Banner from "@/components/Home/Banner/Banner";
import CollectionBox from "@/components/Home/Collection/CollectionBox";
import DealTimer from "@/components/Home/DealTimer/DealTimer";
import CampaignBanners from "@/components/Home/Campaign/CampaignBanners";
import Trendy from "@/components/Home/Trendy/Trendy";
import LimitedEdition from "@/components/Home/Limited/LimitedEdition";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, refreshCurrentUserFromServer } from "@/lib/auth";

const HeroSection = dynamic(() => import("@/components/Home/Hero/HeroSection"), {
  ssr: false,
  loading: () => (
    <div className="mainDeal" style={{ minHeight: "360px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="sdProductSkeleton" style={{ width: "92%", height: "320px", borderRadius: "4px" }} />
    </div>
  ),
});

const Instagram = dynamic(() => import("@/components/Home/Instagram/Instagram"), {
  ssr: false,
});

export default function HomePage() {
  const { t } = useLocale();
  const router = useRouter();
  const [roleResolved, setRoleResolved] = useState(false);
  useEffect(() => {
    const redirect = (user: ReturnType<typeof getUser>) => {
      if (!user || user.role === "user") return;
      const destination = user.role === "admin" ? "/admin" : user.role === "seller" ? "/seller/dashboard" : user.role === "supplier" ? "/supplier/dashboard" : user.role === "shipper" ? "/shipper/dashboard" : "/staff";
      router.replace(destination);
    };
    redirect(getUser());
    void refreshCurrentUserFromServer().then((user) => { redirect(user); setRoleResolved(true); });
  }, [router]);
  if (!roleResolved || (getUser() && getUser()?.role !== "user")) return null;
  return (
    <div className="jp-seigaiha-bg">
      <Banner />
      <section className="homeTrustStrip">
        <article>
          <h3>{t("home_fast_dispatch")}</h3>
          <p>{t("home_fast_dispatch_desc")}</p>
        </article>
        <article>
          <h3>{t("home_flexible_returns")}</h3>
          <p>{t("home_flexible_returns_desc")}</p>
        </article>
        <article>
          <h3>{t("home_member_rewards")}</h3>
          <p>{t("home_member_rewards_desc")}</p>
        </article>
      </section>

      {/* Editorial Announcement Strip */}
      <div className="jp-marquee" aria-hidden="true">
        <div className="jp-marquee-track">
          <div className="jp-marquee-item">Seasonal Essentials <span>· 厳選アイテム</span></div>
          <div className="jp-marquee-item">Carefully Crafted Apparel <span>· 上質な日常着</span></div>
          <div className="jp-marquee-item">Complimentary Delivery Nationwide <span>· 全国送料無料</span></div>
          <div className="jp-marquee-item">Members Reward Privilege <span>· 会員限定特典</span></div>
          {/* Loop repeat for seamless scroll */}
          <div className="jp-marquee-item">Seasonal Essentials <span>· 厳選アイテム</span></div>
          <div className="jp-marquee-item">Carefully Crafted Apparel <span>· 上質な日常着</span></div>
          <div className="jp-marquee-item">Complimentary Delivery Nationwide <span>· 全国送料無料</span></div>
          <div className="jp-marquee-item">Members Reward Privilege <span>· 会員限定特典</span></div>
        </div>
      </div>

      <CollectionBox />
      <DealTimer />
      <CampaignBanners />
      <HeroSection />
      <Trendy />
      <LimitedEdition />
      <Instagram />
    </div>
  );
}
