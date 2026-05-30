"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useInView, useAnimation, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Target, Users, Zap, RefreshCw, Globe, TrendingUp,
  ChevronRight, Newspaper, BarChart2, Award, ShieldCheck
} from "lucide-react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-fade";
import "swiper/css/pagination";
import "./About.css";

import about1 from "@/public/About/about-1.jpg";
import about2 from "@/public/About/about-2.jpg";
import brand1 from "@/public/Brands/brand1.png";
import brand2 from "@/public/Brands/brand2.png";
import brand3 from "@/public/Brands/brand3.png";
import brand4 from "@/public/Brands/brand4.png";
import brand5 from "@/public/Brands/brand5.png";
import brand6 from "@/public/Brands/brand6.png";
import brand7 from "@/public/Brands/brand7.png";

/* ── helpers ─────────────────────────────────────────── */
function ScrollReveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "0px 0px -60px 0px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 28 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

function CountUp({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 1600;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      setCount(start);
      if (start >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ── Slide data ──────────────────────────────────────── */
const SLIDES = [
  { img: about1, titleKey: "about_slider_title_1", descKey: "about_slider_desc_1", tag: "MISSION" },
  { img: about2, titleKey: "about_slider_title_2", descKey: "about_slider_desc_2", tag: "SUSTAINABILITY" },
  { img: about1, titleKey: "about_slider_title_3", descKey: "about_slider_desc_3", tag: "COMMUNITY" },
] as const;

const VALUES = [
  {
    icon: Zap,
    titleKey: "about_value_gobold_title",
    descKey:  "about_value_gobold_desc",
    color:    "#ff0211",
    colorSoft: "rgba(255,2,17,0.08)",
  },
  {
    icon: Users,
    titleKey: "about_value_allforone_title",
    descKey:  "about_value_allforone_desc",
    color:    "#1a56db",
    colorSoft: "rgba(26,86,219,0.08)",
  },
  {
    icon: Award,
    titleKey: "about_value_beapro_title",
    descKey:  "about_value_beapro_desc",
    color:    "#059669",
    colorSoft: "rgba(5,150,105,0.08)",
  },
] as const;

const NEWS_ITEMS = [
  { dateStr: "2026.05.20", tagKey: "about_news_pr_tag", tagColor: "blue",  titleKey: "about_news_item_1_title" },
  { dateStr: "2026.04.30", tagKey: "about_news_ir_tag", tagColor: "red",   titleKey: "about_news_item_2_title" },
  { dateStr: "2026.04.08", tagKey: "about_news_pr_tag", tagColor: "blue",  titleKey: "about_news_item_3_title" },
] as const;

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
const AboutPage: React.FC = () => {
  const { t } = useLocale();
  const [activeSlide, setActiveSlide] = useState(0);

  return (
    <div className="about-root">

      {/* ── HERO SLIDER ─────────────────────────────── */}
      <section className="about-hero" aria-label="Hero">
        <Swiper
          modules={[Autoplay, EffectFade, Pagination]}
          effect="fade"
          autoplay={{ delay: 5000, disableOnInteraction: false }}
          loop
          onSlideChange={(swiper) => setActiveSlide(swiper.realIndex)}
          className="about-hero__swiper"
        >
          {SLIDES.map((slide, idx) => (
            <SwiperSlide key={idx} className="about-hero__slide">
              <div className="about-hero__img-wrap">
                <Image
                  src={slide.img}
                  alt={t(slide.titleKey)}
                  fill
                  sizes="100vw"
                  priority={idx === 0}
                  className="about-hero__img"
                  style={{ objectFit: "cover" }}
                />
                <div className="about-hero__overlay" />
              </div>
              <AnimatePresence mode="wait">
                {activeSlide === idx && (
                  <motion.div
                    key={idx}
                    className="about-hero__content"
                    initial={{ opacity: 0, y: 32 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span className="about-hero__tag">{slide.tag}</span>
                    <h1 className="about-hero__title">{t(slide.titleKey)}</h1>
                    <p className="about-hero__desc">{t(slide.descKey)}</p>
                    <Link href="/shop" className="about-hero__cta">
                      <span>{t("home_shop_now")}</span>
                      <ArrowRight size={16} />
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Slide counter */}
        <div className="about-hero__counter">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`about-hero__dot ${i === activeSlide ? "active" : ""}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* ── METRICS BAR ─────────────────────────────── */}
      <section className="about-metrics-bar">
        <div className="about-metrics-bar__inner">
          <ScrollReveal className="about-metric-item" delay={0}>
            <div className="about-metric-item__val">
              <CountUp target={22} suffix="M+" />
            </div>
            <div className="about-metric-item__lbl">{t("about_metrics_mau_lbl")}</div>
          </ScrollReveal>
          <div className="about-metrics-bar__sep" />
          <ScrollReveal className="about-metric-item" delay={0.08}>
            <div className="about-metric-item__val">{t("about_metrics_gmv_val")}</div>
            <div className="about-metric-item__lbl">{t("about_metrics_gmv_lbl")}</div>
          </ScrollReveal>
          <div className="about-metrics-bar__sep" />
          <ScrollReveal className="about-metric-item" delay={0.16}>
            <div className="about-metric-item__val">
              <CountUp target={2100} suffix="+" />
            </div>
            <div className="about-metric-item__lbl">{t("about_metrics_emp_lbl")}</div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── OUR MISSION ─────────────────────────────── */}
      <section className="about-mission jp-seigaiha-bg">
        <div className="about-section-inner">
          <ScrollReveal>
            <p className="jp-red-line">{t("about_our_mission")}</p>
          </ScrollReveal>
          <ScrollReveal delay={0.08}>
            <h2 className="about-mission__headline">{t("about_slider_title_1")}</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.14}>
            <p className="about-mission__body">{t("about_slider_desc_1")}</p>
          </ScrollReveal>
        </div>
      </section>

      {/* ── VALUES ──────────────────────────────────── */}
      <section className="about-values">
        <div className="about-section-inner">
          <ScrollReveal>
            <div className="jp-title-wrap">
              <span className="jp-subtitle">GROUP VALUES / 企業理念</span>
              <h2 className="about-section-h2" style={{ margin: 0 }}>{t("about_the_company")}</h2>
            </div>
          </ScrollReveal>
          <div className="about-values__grid">
            {VALUES.map((v, idx) => (
              <ScrollReveal key={idx} delay={idx * 0.1}>
                <div className="about-value-card jp-card">
                  <div className="about-value-card__icon" style={{ background: v.colorSoft }}>
                    <v.icon size={22} color={v.color} strokeWidth={1.8} />
                  </div>
                  <h3 className="about-value-card__title">{t(v.titleKey)}</h3>
                  <p className="about-value-card__desc">{t(v.descKey)}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICE: CIRCULAR MARKETPLACE ───────────── */}
      <section className="about-service">
        <div className="about-service__inner">
          <div className="about-service__img-col">
            <ScrollReveal>
              <div className="about-service__img-stack">
                <div className="about-service__img-main">
                  <Image src={about1} alt="Circular marketplace" fill sizes="50vw" style={{ objectFit: "cover" }} className="about-service__photo" />
                </div>
                <div className="about-service__img-card jp-card">
                  <div className="about-service__img-card-stat">
                    <RefreshCw size={18} color="#059669" />
                    <span>Circular Economy</span>
                  </div>
                  <div className="about-service__img-card-val">98%</div>
                  <div className="about-service__img-card-lbl">Items given new life</div>
                </div>
              </div>
            </ScrollReveal>
          </div>
          <div className="about-service__text-col">
            <ScrollReveal delay={0.06}>
              <p className="jp-red-line">{t("about_services_title")}</p>
              <h2 className="about-section-h2" style={{ marginTop: 12 }}>{t("about_services_circ_title")}</h2>
              <p className="about-service__body">{t("about_services_circ_desc")}</p>
              <Link href="/shop" className="about-service__link">
                <span>{t("home_shop_now")}</span>
                <ChevronRight size={16} />
              </Link>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── SERVICE: TECHNOLOGY ─────────────────────── */}
      <section className="about-service about-service--reverse jp-grid-bg">
        <div className="about-service__inner">
          <div className="about-service__text-col">
            <ScrollReveal delay={0.06}>
              <p className="jp-red-line">{t("about_services_title")}</p>
              <h2 className="about-section-h2" style={{ marginTop: 12 }}>{t("about_services_tech_title")}</h2>
              <p className="about-service__body">{t("about_services_tech_desc")}</p>
              <div className="about-service__icon-list">
                {[
                  { icon: ShieldCheck, label: "Secure Payments" },
                  { icon: Globe,       label: "Global Reach" },
                  { icon: BarChart2,   label: "Real-time Analytics" },
                  { icon: TrendingUp,  label: "Growth Focus" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="about-service__icon-item">
                    <Icon size={16} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <Link href="/about" className="about-service__link" style={{ marginTop: 24 }}>
                <span>Learn more</span>
                <ChevronRight size={16} />
              </Link>
            </ScrollReveal>
          </div>
          <div className="about-service__img-col">
            <ScrollReveal>
              <div className="about-service__img-stack">
                <div className="about-service__img-main">
                  <Image src={about2} alt="Technology" fill sizes="50vw" style={{ objectFit: "cover" }} className="about-service__photo" />
                </div>
                <div className="about-service__img-card jp-card" style={{ right: "auto", left: 0, bottom: "12%" }}>
                  <div className="about-service__img-card-stat">
                    <Zap size={18} color="#1a56db" />
                    <span>AI-Powered</span>
                  </div>
                  <div className="about-service__img-card-val">99.9%</div>
                  <div className="about-service__img-card-lbl">Platform uptime</div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── NEWS ────────────────────────────────────── */}
      <section className="about-news">
        <div className="about-section-inner">
          <div className="about-news__header">
            <ScrollReveal>
              <div className="jp-title-wrap" style={{ alignItems: "flex-start", textAlign: "left", marginBottom: 0 }}>
                <span className="jp-subtitle" style={{ alignSelf: "flex-start" }}>LATEST UPDATES / ニュース・お知らせ</span>
                <h2 className="about-section-h2" style={{ margin: 0 }}>{t("about_news_title")}</h2>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.04}>
              <Link href="/blog" className="about-news__viewall">
                {t("home_discover_more")} <ArrowRight size={14} />
              </Link>
            </ScrollReveal>
          </div>
          <div className="about-news__list">
            {NEWS_ITEMS.map((item, idx) => (
              <ScrollReveal key={idx} delay={idx * 0.06}>
                <Link href="/blog" className="about-news__item">
                  <div className="about-news__item-meta">
                    <span className="about-news__date">{item.dateStr}</span>
                    <span className={`jp-tag about-news__tag about-news__tag--${item.tagColor}`}>
                      {t(item.tagKey)}
                    </span>
                  </div>
                  <p className="about-news__title">{t(item.titleKey)}</p>
                  <div className="about-news__arrow">
                    <ArrowRight size={16} />
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PARTNERS ────────────────────────────────── */}
      <section className="about-partners">
        <div className="about-section-inner">
          <ScrollReveal>
            <p className="about-partners__label">{t("about_company_partners")}</p>
          </ScrollReveal>
          <Swiper
            slidesPerView={2}
            spaceBetween={24}
            loop
            autoplay={{ delay: 2200, disableOnInteraction: false }}
            modules={[Autoplay]}
            breakpoints={{
              640:  { slidesPerView: 3, spaceBetween: 32 },
              1024: { slidesPerView: 5, spaceBetween: 48 },
            }}
            className="about-partners__swiper"
          >
            {[brand1, brand2, brand3, brand4, brand5, brand6, brand7].map((b, i) => (
              <SwiperSlide key={i}>
                <div className="about-partners__logo">
                  <Image src={b} alt={`Partner ${i + 1}`} height={36} style={{ objectFit: "contain", width: "auto", maxWidth: "120px" }} />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </section>

      {/* ── CTA STRIP ───────────────────────────────── */}
      <section className="about-cta">
        <ScrollReveal className="about-cta__inner">
          <Target size={28} color="#ff0211" />
          <h2 className="about-cta__title">{t("about_our_vision")}</h2>
          <p className="about-cta__body">{t("about_vision_desc")}</p>
          <div className="about-cta__actions">
            <Link href="/contact" className="jp-btn jp-btn-primary">
              {t("contact_us")} <ArrowRight size={14} />
            </Link>
            <Link href="/shop" className="jp-btn jp-btn-secondary">
              {t("home_shop_now")}
            </Link>
          </div>
        </ScrollReveal>
      </section>

    </div>
  );
};

export default AboutPage;
