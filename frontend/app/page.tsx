"use client";
import Banner from "@/components/Home/Banner/Banner";
import CollectionBox from "@/components/Home/Collection/CollectionBox";
import DealTimer from "@/components/Home/DealTimer/DealTimer";
import CampaignBanners from "@/components/Home/Campaign/CampaignBanners";
import HeroSection from "@/components/Home/Hero/HeroSection";
import Trendy from "@/components/Home/Trendy/Trendy";
import LimitedEdition from "@/components/Home/Limited/LimitedEdition";
import Instagram from "@/components/Home/Instagram/Instagram";
import { useLocale } from "@/components/providers/LocaleProvider";

export default function HomePage() {
  const { t } = useLocale();
  return (
    <div className="jp-seigaiha-bg">
      <div className="jp-vertical-badge">NEW COLLECTION // 新着アイテム</div>
      <div className="jp-vertical-badge-right">SUMMER SALE // 春夏物セール</div>
      
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

      {/* Infinite Japanese Marquee Ticker */}
      <div className="jp-marquee" aria-hidden="true">
        <div className="jp-marquee-track">
          <div className="jp-marquee-item">SUMMER SALE NOW ON // <span>春夏セール開催中</span></div>
          <div className="jp-marquee-item">NEW ARRIVALS EVERY DAY // <span>新作アイテム毎日入荷</span></div>
          <div className="jp-marquee-item">FREE SHIPPING ON ALL ORDERS // <span>全国一律送料無料</span></div>
          <div className="jp-marquee-item">10% OFF YOUR FIRST PURCHASE // <span>新規登録で10%割引</span></div>
          {/* Loop repeat */}
          <div className="jp-marquee-item">SUMMER SALE NOW ON // <span>春夏セール開催中</span></div>
          <div className="jp-marquee-item">NEW ARRIVALS EVERY DAY // <span>新作アイテム毎日入荷</span></div>
          <div className="jp-marquee-item">FREE SHIPPING ON ALL ORDERS // <span>全国一律送料無料</span></div>
          <div className="jp-marquee-item">10% OFF YOUR FIRST PURCHASE // <span>新規登録で10%割引</span></div>
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
