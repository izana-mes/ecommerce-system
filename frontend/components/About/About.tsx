"use client";

import React from "react";
import Image from "next/image";
import { useLocale } from "@/components/providers/LocaleProvider";
import "./About.css";

import about1 from "@/public/About/about-1.jpg";
import about2 from "@/public/About/about-2.jpg";

import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import { Autoplay } from "swiper/modules";

import brand1 from "@/public/Brands/brand1.png";
import brand2 from "@/public/Brands/brand2.png";
import brand3 from "@/public/Brands/brand3.png";
import brand4 from "@/public/Brands/brand4.png";
import brand5 from "@/public/Brands/brand5.png";
import brand6 from "@/public/Brands/brand6.png";
import brand7 from "@/public/Brands/brand7.png";

const AboutPage: React.FC = () => {
  const { t } = useLocale();
  return (
    <>
      <div className="aboutSection">
        <h2>{t("about_title")}</h2>

        <Image src={about1} alt="about" />

        <div className="aboutContent">
          <h3>{t("about_our_story")}</h3>

          <h4>
            {t("about_story_desc_1")}
          </h4>

          <p>
            {t("about_story_desc_2")}
          </p>

          <div className="content1">
            <div className="contentBox">
              <h5>{t("about_our_mission")}</h5>
              <p>
                {t("about_mission_desc")}
              </p>
            </div>

            <div className="contentBox">
              <h5>{t("about_our_vision")}</h5>
              <p>
                {t("about_vision_desc")}
              </p>
            </div>
          </div>

          <div className="content2">
            <div className="imgContent">
              <Image src={about2} alt="company" />
            </div>

            <div className="textContent">
              <h5>{t("about_the_company")}</h5>
              <p>
                {t("about_company_desc")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="companyPartners">
        <h5>{t("about_company_partners")}</h5>

        <Swiper
          slidesPerView={1}
          loop
          breakpoints={{
            640: { slidesPerView: 2, spaceBetween: 5 },
            768: { slidesPerView: 4, spaceBetween: 40 },
            1024: { slidesPerView: 5, spaceBetween: 50 },
          }}
          spaceBetween={10}
          autoplay={{
            delay: 2500,
            disableOnInteraction: false,
          }}
          modules={[Autoplay]}
        >
          {[brand1, brand2, brand3, brand4, brand5, brand6, brand7].map(
            (brand, index) => (
              <SwiperSlide key={index}>
                <div className="aboutBrands">
                  <Image src={brand} alt={`brand-${index}`} />
                </div>
              </SwiperSlide>
            )
          )}
        </Swiper>
      </div>
    </>
  );
};

export default AboutPage;
