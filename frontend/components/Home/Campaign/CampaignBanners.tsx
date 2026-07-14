"use client";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import "./CampaignBanners.css";

export default function CampaignBanners() {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText("SUMMER15")
      .then(() => {
        setCopied(true);
        toast.success("Coupon code 'SUMMER15' copied to clipboard!", {
          style: {
            background: "var(--announcement-bg)",
            color: "var(--announcement-text)",
            border: "1px solid var(--border)",
          },
        });
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
        toast.error("Failed to copy coupon code.");
      });
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  return (
    <div className="campaign-wrapper">
      <div className="jp-title-wrap">
        <span className="jp-subtitle">RECOMMENDED CAMPAIGNS / おすすめ特集・イベント</span>
        <h2>CAMPAIGNS & OFFERS / <span>キャンペーン & 特典</span></h2>
      </div>

      <div className="campaign-grid">
        {/* Card 1: Interactive Coupon Card */}
        <div className="campaign-card coupon-card">
          <div className="card-badge coupon-badge">COUPON</div>
          <div className="campaign-card-content">
            <span className="coupon-sub text-rose-500 font-semibold text-xs tracking-wider">SPECIAL DISCOUNT // 特別割引クーポン</span>
            <h3 className="coupon-title text-2xl font-bold mt-1 mb-2">15% OFF YOUR PURCHASE</h3>
            <p className="coupon-desc text-sm text-neutral-500 mb-4">
              Enter the code at checkout to claim your discount. Valid on all summer collection items.
            </p>
            <div className="coupon-box-dashed">
              <span className="coupon-code font-mono text-lg font-bold tracking-widest text-rose-600">SUMMER15</span>
              <button 
                onClick={copyToClipboard}
                className="coupon-copy-btn px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded hover:bg-rose-700 transition"
              >
                {copied ? "COPIED! // コピー完了" : "COPY CODE // コードをコピー"}
              </button>
            </div>
            <span className="coupon-expiry text-[10px] text-neutral-400 mt-2 block">
              *Expires 2026-06-30 // お一人様1回限り有効
            </span>
          </div>
        </div>

        {/* Card 2: Staff Snaps Coordinate Card */}
        <div className="campaign-card staff-card">
          <div className="card-bg zoom-bg" style={{ backgroundImage: "url('/Banner/banner_staff.png')" }} />
          <div className="card-overlay" />
          <div className="card-badge info-badge">STAFF SNAP</div>
          <div className="campaign-card-content content-overlay">
            <span className="campaign-sub text-white/80 text-xs tracking-wider">STYLE INSPIRATION // おすすめ着こなし</span>
            <h3 className="campaign-title text-2xl font-bold text-white mt-1 mb-2">STAFF COORDINATE</h3>
            <p className="campaign-desc text-sm text-white/70 mb-4">
              Explore how our staff styles the latest arrivals in the street fashion collection.
            </p>
            <div className="campaign-action">
              <Link href="/shop" onClick={scrollToTop} className="campaign-btn-link text-white font-medium text-sm flex items-center gap-1">
                VIEW LOOKBOOK // コーデ一覧を見る
              </Link>
            </div>
          </div>
        </div>

        {/* Card 3: Season Outlet Card */}
        <div className="campaign-card outlet-card">
          <div className="card-bg zoom-bg" style={{ backgroundImage: "url('/Banner/banner_outlet.png')" }} />
          <div className="card-overlay" />
          <div className="card-badge sale-badge">OUTLET</div>
          <div className="campaign-card-content content-overlay">
            <span className="campaign-sub text-white/80 text-xs tracking-wider">SEASON OUTLET SALE // 最大40%OFF</span>
            <h3 className="campaign-title text-2xl font-bold text-white mt-1 mb-2">OUTLET DEALS</h3>
            <p className="campaign-desc text-sm text-white/70 mb-4">
              Discover last season's favorites at special discounted rates. Limited quantities available.
            </p>
            <div className="campaign-action">
              <Link href="/shop" onClick={scrollToTop} className="campaign-btn-link text-white font-medium text-sm flex items-center gap-1">
                SHOP OUTLET // セール商品を見る
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
