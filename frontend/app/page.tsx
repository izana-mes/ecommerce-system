import Banner from "@/components/Home/Banner/Banner";
import CollectionBox from "@/components/Home/Collection/CollectionBox";
import DealTimer from "@/components/Home/DealTimer/DealTimer";
import HeroSection from "@/components/Home/Hero/HeroSection";
import Trendy from "@/components/Home/Trendy/Trendy";
import LimitedEdition from "@/components/Home/Limited/LimitedEdition";
import Instagram from "@/components/Home/Instagram/Instagram";

export default function HomePage() {
  return (
    <>
      <Banner />
      <section className="homeTrustStrip">
        <article>
          <h3>Fast Dispatch</h3>
          <p>Orders placed before 2PM ship the same day.</p>
        </article>
        <article>
          <h3>Flexible Returns</h3>
          <p>30-day returns with instant store credit option.</p>
        </article>
        <article>
          <h3>Member Rewards</h3>
          <p>Earn points on every purchase and unlock perks.</p>
        </article>
      </section>
      <CollectionBox />
      <DealTimer />
      <HeroSection />
      <Trendy />
      <LimitedEdition />
      <Instagram />
    </>
  );
}
