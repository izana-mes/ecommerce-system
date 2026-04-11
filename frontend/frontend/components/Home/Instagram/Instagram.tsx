"use client";
import "./Instagram.css";

const insta1 = "/Instagram/insta1.jpg";
const insta2 = "/Instagram/insta2.jpg";
const insta3 = "/Instagram/insta3.jpg";
const insta4 = "/Instagram/insta4.jpg";
const insta5 = "/Instagram/insta5.jpg";
const insta6 = "/Instagram/insta6.jpg";
const insta7 = "/Instagram/insta7.jpg";
const insta8 = "/Instagram/insta8.jpg";
const insta9 = "/Instagram/insta9.jpg";
const insta10 = "/Instagram/insta10.jpg";
const insta11 = "/Instagram/insta11.jpg";
const insta12 = "/Instagram/insta12.jpg";

export default function Instagram() {
  return (
    <div className="instagram">
      <h2>@UOMO</h2>
      <div className="instagramTiles">
        <div className="instagramtile">
          <img src={insta1} alt="" />
        </div>
        <div className="instagramtile">
          <img src={insta2} alt="" />
        </div>
        <div className="instagramtile">
          <img src={insta3} alt="" />
        </div>
        <div className="instagramtile">
          <img src={insta4} alt="" />
        </div>
        <div className="instagramtile">
          <img src={insta5} alt="" />
        </div>
        <div className="instagramtile">
          <img src={insta6} alt="" />
        </div>
        <div className="instagramtile">
          <img src={insta7} alt="" />
        </div>
        <div className="instagramtile">
          <img src={insta8} alt="" />
        </div>
        <div className="instagramtile">
          <img src={insta9} alt="" />
        </div>
        <div className="instagramtile">
          <img src={insta10} alt="" />
        </div>
        <div className="instagramtile">
          <img src={insta11} alt="" />
        </div>
        <div className="instagramtile">
          <img src={insta12} alt="" />
        </div>
      </div>
    </div>
  );
}
