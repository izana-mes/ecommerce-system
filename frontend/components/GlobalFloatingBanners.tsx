"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const FLOATING_BANNER_SELECTOR = "[data-floating-banner]";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function GlobalFloatingBanners() {
  const pathname = usePathname();

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const banners = Array.from(document.querySelectorAll(FLOATING_BANNER_SELECTOR)) as HTMLElement[];

    if (prefersReducedMotion || banners.length === 0) {
      banners.forEach((banner) => {
        banner.style.removeProperty("--floating-banner-offset");
        banner.style.removeProperty("--floating-banner-shadow-opacity");
        banner.style.removeProperty("--floating-banner-lift");
      });
      return;
    }

    let frameId = 0;

    const updateBanners = () => {
      frameId = 0;
      const viewportHeight = Math.max(window.innerHeight, 1);
      const viewportCenter = viewportHeight / 2;

      banners.forEach((banner) => {
        const rect = banner.getBoundingClientRect();
        const bannerCenter = rect.top + rect.height / 2;
        const distanceFromCenter = (viewportCenter - bannerCenter) / viewportHeight;
        const clampedDistance = clamp(distanceFromCenter, -1, 1);
        const travel = clampedDistance * 22;
        const emphasis = 1 - Math.min(Math.abs(clampedDistance) * 1.35, 1);

        banner.style.setProperty("--floating-banner-offset", `${travel.toFixed(2)}px`);
        banner.style.setProperty(
          "--floating-banner-shadow-opacity",
          (0.12 + emphasis * 0.14).toFixed(3)
        );
        banner.style.setProperty("--floating-banner-lift", `${(20 + emphasis * 20).toFixed(2)}px`);
      });
    };

    const queueUpdate = () => {
      if (frameId !== 0) {
        return;
      }
      frameId = window.requestAnimationFrame(updateBanners);
    };

    queueUpdate();
    window.addEventListener("scroll", queueUpdate, { passive: true });
    window.addEventListener("resize", queueUpdate);

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", queueUpdate);
      window.removeEventListener("resize", queueUpdate);
      banners.forEach((banner) => {
        banner.style.removeProperty("--floating-banner-offset");
        banner.style.removeProperty("--floating-banner-shadow-opacity");
        banner.style.removeProperty("--floating-banner-lift");
      });
    };
  }, [pathname]);

  return null;
}
