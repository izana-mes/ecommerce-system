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
      behavior: "smooth"});
  };

  return (
    <>
      <div className="collection-wrapper jp-pattern-bg">
        <div className="jp-title-wrap jp-animate-reveal">
          <span className="jp-subtitle">COLLECTIONS / 特集・コレクション</span>
          <h2>{t("home_hot_list")}</h2>
        </div>
        
        <div className="collection">
          <div className="collectionLeft">
            <div className="col-bg" style={{ backgroundImage: `url("${collectionLeftUrl}")` }} />
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
          <div className="collectionRight">
            <div className="collectionTop">
              <div className="col-bg" style={{ backgroundImage: `url("${collectionTopUrl}")` }} />
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
            <div className="collectionBottom">
              <div className="box1">
                <div className="col-bg" style={{ backgroundImage: `url("${collectionBottomLeftUrl}")` }} />
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
              <div className="box2">
                <div className="col-content">
                  <h3 className="col-h3">
                    <span>{t("home_egift")}</span> {t("home_cards")}
                  </h3>
                  <p className="col-p">
                    {t("home_surprise_gift")}
                  </p>
                  <div className="col-link">
                    <Link href="/shop" onClick={scrollToTop}>
                      <h5 className="col-h5">{t("home_shop_now")}</h5>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
