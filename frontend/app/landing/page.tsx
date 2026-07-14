"use client";

import dynamic from "next/dynamic";
import LandingNavbar from "@/components/Landing/LandingNavbar";
import HeroSection from "@/components/Landing/HeroSection";
import FeaturesSection from "@/components/Landing/FeaturesSection";
import ShowcaseSection from "@/components/Landing/ShowcaseSection";
import CTASection from "@/components/Landing/CTASection";
import "./landing.css";

const FloatingParticles = dynamic(() => import("@/components/Landing/FloatingParticles"), {
  ssr: false,
});

export default function LandingPage() {
  return (
    <div className="landing-page-root">
      <FloatingParticles />
      <LandingNavbar />
      <HeroSection />
      <FeaturesSection />
      <ShowcaseSection />
      <CTASection />
    </div>
  );
}
