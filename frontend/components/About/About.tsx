"use client";

import React from "react";
import Image from "next/image";
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
  return (
    <>
      <div className="aboutSection">
        <h2>About Uomo</h2>

        <Image src={about1} alt="about" />

        <div className="aboutContent">
          <h3>Our Story</h3>

          <h4>
            Duis aute irure dolor in reprehenderit in voluptate velit esse
            cillum dolore eu fugiat nulla pariatur.
          </h4>

          <p>
            Saw wherein fruitful good days image them, midst, waters upon, saw.
          </p>

          <div className="content1">
            <div className="contentBox">
              <h5>Our Mission</h5>
              <p>
                Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
                commodo consequat.
              </p>
            </div>

            <div className="contentBox">
              <h5>Our Vision</h5>
              <p>
                Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
                commodo consequat.
              </p>
            </div>
          </div>

          <div className="content2">
            <div className="imgContent">
              <Image src={about2} alt="company" />
            </div>

            <div className="textContent">
              <h5>The Company</h5>
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="companyPartners">
        <h5>Company Partners</h5>

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
