"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const REVEAL_SELECTOR = [
  "#page-content > *",
  "#page-content section",
  "#page-content article",
  "#page-content [class*='Section']",
  "#page-content [class*='section']",
  "#page-content [class*='Container']",
  "#page-content [class*='container']",
  "#page-content [class*='Card']",
  "#page-content [class*='card']",
].join(", ");

export default function GlobalScrollReveal() {
  const pathname = usePathname();
  const [canReveal, setCanReveal] = useState(false);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setCanReveal(true);
    }, 0);
    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    if (!canReveal) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    let observer: IntersectionObserver | null = null;

    const runReveal = () => {
      if (cancelled) {
        return;
      }

      const nodeList = Array.from(document.querySelectorAll(REVEAL_SELECTOR)) as HTMLElement[];
      const uniqueElements = Array.from(new Set(nodeList)).filter(
        (element) => !element.hasAttribute("data-no-reveal")
      );

      if (uniqueElements.length === 0) {
        return;
      }

      uniqueElements.forEach((element, index) => {
        const delay = (index % 8) * 50;
        element.style.setProperty("--reveal-delay", `${delay}ms`);
        element.classList.add("reveal-scroll");
        if (prefersReducedMotion) {
          element.classList.add("reveal-visible");
        }
      });

      if (prefersReducedMotion) {
        return;
      }

      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              return;
            }
            const target = entry.target as HTMLElement;
            target.classList.add("reveal-visible");
            io.unobserve(target);
          });
        },
        {
          threshold: 0.12,
          rootMargin: "0px 0px -10% 0px",
        }
      );

      observer = io;
      uniqueElements.forEach((element) => io.observe(element));
    };

    const idleId =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(() => {
            runReveal();
          }, { timeout: 250 })
        : null;
    const timeoutId = idleId === null ? window.setTimeout(runReveal, 120) : null;

    return () => {
      cancelled = true;
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      observer?.disconnect();
    };
  }, [pathname, canReveal]);

  return null;
}
