"use client";
import Link from "next/link";
import "./CollectionBox.css";
export default function CollectionBox() {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <>
      <div className="collection">
        <div className="collectionLeft">
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
          <div className="collectionTop">
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
            <div className="box1">
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
