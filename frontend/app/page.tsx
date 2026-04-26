"use client";
import Banner from "@/components/Home/Banner/Banner";
import CollectionBox from "@/components/Home/Collection/CollectionBox";
import DealTimer from "@/components/Home/DealTimer/DealTimer";
import HeroSection from "@/components/Home/Hero/HeroSection";
import Trendy from "@/components/Home/Trendy/Trendy";
import LimitedEdition from "@/components/Home/Limited/LimitedEdition";
import Instagram from "@/components/Home/Instagram/Instagram";
import { useLocale } from "@/components/providers/LocaleProvider";

export default function HomePage() {
  const { t } = useLocale();
  return (
    <div className="animate-slide-up">
      <div className="animate-float" style={{ animationDuration: '4s' }}>
        <Banner />
      </div>
      <section className="homeTrustStrip animate-bounce-soft">
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
      <div className="animate-slide-up">
        <CollectionBox />
      </div>
      <DealTimer />
      <div className="animate-slide-up">
        <HeroSection />
      </div>
      <Trendy />
      <LimitedEdition />
      <Instagram />
    </div>
  );
}
