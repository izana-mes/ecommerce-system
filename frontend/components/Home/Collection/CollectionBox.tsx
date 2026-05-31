"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import "./CollectionBox.css";

export default function CollectionBox() {
  const { t } = useLocale();
  const [collectionLeftUrl, setCollectionLeftUrl] = useState("/Collection/collection1.jpg");
  const [collectionTopUrl, setCollectionTopUrl] = useState("/Collection/collection2.jpg");
  const [collectionBottomLeftUrl, setCollectionBottomLeftUrl] = useState("/Collection/collection3.jpg");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const settings = data?.settings ?? {};
        if (settings.collection_left_url) setCollectionLeftUrl(settings.collection_left_url);
        if (settings.collection_top_url) setCollectionTopUrl(settings.collection_top_url);
        if (settings.collection_bottom_left_url) setCollectionBottomLeftUrl(settings.collection_bottom_left_url);
      })
      .catch((err) => console.error("Error fetching home settings:", err));
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  return (
    <div className="collection-wrapper jp-pattern-bg">
      <div className="jp-title-wrap jp-animate-reveal">
        <span className="jp-subtitle">COLLECTIONS / 特集・コレクション</span>
        <h2>{t("home_hot_list")}</h2>
      </div>
      
      <div className="collection-grid">
        {/* Card 1: Ladies Collection */}
        <div className="collection-card jp-card-ladies animate-card-1">
          {/* Traditional corner borders for Japanese aesthetics */}
          <div className="jp-corner-border top-left"></div>
          <div className="jp-corner-border bottom-right"></div>
          
          <div className="col-bg" style={{ backgroundImage: `url("${collectionLeftUrl}")` }} />
          <div className="col-bg-pattern-overlay" />
          <div className="jp-shimmer-effect" />
          
          {/* Kanji Stamp */}
          <div className="jp-stamp jp-stamp-red">特選</div>
          
          {/* Vertical Title Badge */}
          <div className="jp-vertical-text">LADIES // 婦人服</div>
          
          <div className="col-content">
            <p className="col-p">{t("home_hot_list")}</p>
            <h3 className="col-h3">
              <span>{t("home_women")}</span> {t("home_collection")}
            </h3>
            <div className="col-link">
              <Link href="/shop" onClick={scrollToTop}>
                <h5 className="col-h5">{t("home_shop_now")}</h5>
              </Link>
            </div>
          </div>
        </div>

        {/* Card 2: Men's Collection */}
        <div className="collection-card jp-card-mens animate-card-2">
          <div className="jp-corner-border top-left"></div>
          <div className="jp-corner-border bottom-right"></div>
          
          <div className="col-bg" style={{ backgroundImage: `url("${collectionTopUrl}")` }} />
          <div className="col-bg-pattern-overlay" />
          <div className="jp-shimmer-effect" />
          
          <div className="jp-stamp jp-stamp-red">新着</div>
          
          <div className="jp-vertical-text">MENS // 紳士服</div>
          
          <div className="col-content">
            <p className="col-p">{t("home_hot_list")}</p>
            <h3 className="col-h3">
              <span>{t("home_men")}</span> {t("home_collection")}
            </h3>
            <div className="col-link">
              <Link href="/shop" onClick={scrollToTop}>
                <h5 className="col-h5">{t("home_shop_now")}</h5>
              </Link>
            </div>
          </div>
        </div>

        {/* Card 3: Kids Collection */}
        <div className="collection-card jp-card-kids animate-card-3">
          <div className="jp-corner-border top-left"></div>
          <div className="jp-corner-border bottom-right"></div>
          
          <div className="col-bg" style={{ backgroundImage: `url("${collectionBottomLeftUrl}")` }} />
          <div className="col-bg-pattern-overlay" />
          <div className="jp-shimmer-effect" />
          
          <div className="jp-stamp jp-stamp-red">限定</div>
          
          <div className="jp-vertical-text">KIDS // 子供服</div>
          
          <div className="col-content">
            <p className="col-p">{t("home_hot_list")}</p>
            <h3 className="col-h3">
              <span>{t("home_kids")}</span> {t("home_collection")}
            </h3>
            <div className="col-link">
              <Link href="/shop" onClick={scrollToTop}>
                <h5 className="col-h5">{t("home_shop_now")}</h5>
              </Link>
            </div>
          </div>
        </div>

        {/* Card 4: E-Gift Card */}
        <div className="collection-card jp-card-gift animate-card-4">
          <div className="jp-corner-border top-left"></div>
          <div className="jp-corner-border bottom-right"></div>
          
          {/* Styled with luxury washi paper background pattern inside CSS */}
          <div className="col-bg washi-bg" />
          <div className="col-bg-pattern-overlay washi-gold-overlay" />
          <div className="jp-shimmer-effect" />
          
          {/* Traditional Mizuhiki gift cord ribbon graphic */}
          <div className="mizuhiki-ribbon">
            <div className="mizuhiki-knot"></div>
          </div>
          
          <div className="jp-stamp jp-stamp-red">贈物</div>
          
          <div className="jp-vertical-text">GIFT // 贈り物</div>
          
          <div className="col-content">
            <p className="col-p">{t("home_hot_list")}</p>
            <h3 className="col-h3">
              <span>{t("home_egift")}</span> {t("home_cards")}
            </h3>
            <p className="col-gift-desc">{t("home_surprise_gift")}</p>
            <div className="col-link">
              <Link href="/shop" onClick={scrollToTop}>
                <h5 className="col-h5">{t("home_shop_now")}</h5>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
