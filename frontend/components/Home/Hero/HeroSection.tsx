"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Canvas } from "@react-three/fiber";
import { Model } from "../Model/Model";
import { OrbitControls } from "@react-three/drei";
import "./HeroSection.css";

export default function HeroSection() {
  const { t } = useLocale();
  const [tshirtColor, setTshirtColor] = useState("red");
  const [heroBackgroundUrl, setHeroBackgroundUrl] = useState("/slideshow-pattern.png");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const settings = data?.settings ?? {};
        if (settings.hero_background_url) setHeroBackgroundUrl(settings.hero_background_url);
      })
      .catch((err) => console.error("Error fetching home settings:", err));
  }, []);

  const changeColor = (color: any) => {
    setTshirtColor(color);
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

    return (
    <>
      <div className="heroSection" data-floating-banner style={{ backgroundImage: `url("${heroBackgroundUrl}")` }}>
        <div className="sectionLeft">
          <p>{t("home_new_trend")}</p>
          <h1>{t("home_summer_sale")}</h1>
          <span>{t("home_limited_offer")}</span>
          <div className="heroLink">
            <Link href="/shop" onClick={scrollToTop}>
              <h5>{t("home_discover_more")}</h5>
            </Link>
          </div>
        </div>
        <div className="sectionright">
          <Canvas
            className="canvasModel"
            camera={{ position: [0, 5, 15], fov: 50 }}
          >
            <ambientLight intensity={0.5} />
            <directionalLight
              position={[10, 10, 5]}
              intensity={2.5}
              color={"white"}
            />

            <OrbitControls
              enableZoom={false}
              enablePan={false}
              minAzimuthAngle={-Infinity}
              maxAzimuthAngle={Infinity}
              maxPolarAngle={Math.PI / 2}
              minPolarAngle={Math.PI / 2}
            />

            <Model color={tshirtColor} />
          </Canvas>
          <div className="heroColorBtn">
            <button
              onClick={() => changeColor("#353933")}
              style={{ backgroundColor: "#353933" }}
            ></button>
            <button
              onClick={() => changeColor("#EFBD4E")}
              style={{ backgroundColor: "#EFBD4E" }}
            ></button>
            <button
              onClick={() => changeColor("#726DE7")}
              style={{ backgroundColor: "#726DE7" }}
            ></button>
            <button
              onClick={() => changeColor("red")}
              style={{ backgroundColor: "red" }}
            ></button>
          </div>
        </div>
      </div>
    </>
  );
}
