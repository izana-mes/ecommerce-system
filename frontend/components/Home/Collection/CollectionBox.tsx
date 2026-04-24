"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import "./CollectionBox.css";
export default function CollectionBox() {
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
      behavior: "smooth",
    });
  };

  return (
    <>
      <div className="collection">
        <div className="collectionLeft" style={{ backgroundImage: `url("${collectionLeftUrl}")` }}>
          <p className="col-p">HOT LIST</p>
          <h3 className="col-h3">
            <span>WOMEN</span> COLLECTION
          </h3>
          <div className="col-link">
            <Link href="/" onClick={scrollToTop}>
              <h5 className="col-h5">SHOP NOW</h5>
            </Link>
          </div>
        </div>
        <div className="collectionRight">
          <div className="collectionTop" style={{ backgroundImage: `url("${collectionTopUrl}")` }}>
            <p className="col-p">HOT LIST</p>
            <h3 className="col-h3">
              <span>MEN</span> COLLECTION
            </h3>
            <div className="col-link">
              <Link href="/" onClick={scrollToTop}>
                <h5 className="col-h5">SHOP NOW</h5>
              </Link>
            </div>
          </div>
          <div className="collectionBottom">
            <div className="box1" style={{ backgroundImage: `url("${collectionBottomLeftUrl}")` }}>
              <p className="col-p">HOT LIST</p>
              <h3 className="col-h3">
                <span>KIDS</span> COLLECTION
              </h3>
              <div className="col-link">
                <Link href="/" onClick={scrollToTop}>
                  <h5 className="col-h5">SHOP NOW</h5>
                </Link>
              </div>
            </div>
            <div className="box2">
              <h3 className="col-h3">
                <span>E-GIFT</span> CARDS
              </h3>
              <p className="col-p">
                Surprise someone with the gift they really want.
              </p>
              <div className="col-link">
                <Link href="/" onClick={scrollToTop}>
                  <h5 className="col-h5">SHOP NOW</h5>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
