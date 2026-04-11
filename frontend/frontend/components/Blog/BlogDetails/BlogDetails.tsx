"use client";

import React from "react";
import "./BlogDetails.css";

import Image from "next/image";

const blogdetail1 = "/Blog/blogDetail1.jpg";
const blogimage1 = "/Blog/blogDetail2.jpg";
const blogimage2 = "/Blog/blogDetail3.jpg";

import { FaFacebookF, FaPinterest } from "react-icons/fa";
import { FaXTwitter, FaPlus } from "react-icons/fa6";
import { GoChevronLeft, GoChevronRight } from "react-icons/go";

const BlogDetails: React.FC = () => {
  const scrollToTop = (): void => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="blogDetailsSection">
      <div className="blogDetailsSectionContainer">
        {/* HEADER */}
        <div className="blogDetailsHeading">
          <h2>5 Tips to Increase Your Online Sales</h2>
          <div className="blogDetailsMetaData">
            <span>by admin</span>
            <span>May 19, 2023</span>
            <span>Trends</span>
          </div>
        </div>

        {/* FEATURE IMAGE */}
        <div className="blogDetailsFeaturedImg">
          <Image src={blogdetail1} alt="blog" />
        </div>

        {/* CONTENT */}
        <div className="blogDetailsContent">
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit...
          </p>

          <h5>Sed do eiusmod tempor incididunt ut labore</h5>

          <p>
            Saw wherein fruitful good days image them...
          </p>

          {/* BULLETS */}
          <div className="blogDetailsContentBullets">
            <div>
              <h5>Why choose product?</h5>
              <ul>
                <li>Creat by cotton fibric with soft and smooth</li>
                <li>Simple, Configurable (size, color...)</li>
                <li>Downloadable / Virtual Products</li>
              </ul>
            </div>

            <div>
              <h5>Sample Number List</h5>
              <ol>
                <li>Creat by cotton fibric with soft and smooth</li>
                <li>Simple, Configurable (size, color...)</li>
                <li>Downloadable / Virtual Products</li>
              </ol>
            </div>
          </div>

          <p>
            She&apos;d years darkness days...
          </p>
        </div>

        {/* IMAGE BLOCK */}
        <div className="blogDetailsContentImg">
          <Image src={blogimage1} alt="blog" />
          <Image src={blogimage2} alt="blog" />
        </div>

        {/* MORE CONTENT */}
        <div className="blogDetailsContent">
          <p>Lorem ipsum dolor sit amet...</p>
          <p>She&apos;d years darkness days...</p>
        </div>

        {/* SHARE */}
        <div className="share-buttons">
          <button className="share-button facebook">
            <FaFacebookF /> Share on Facebook
          </button>

          <button className="share-button twitter">
            <FaXTwitter /> Share on Twitter
          </button>

          <button className="share-button pinterest">
            <FaPinterest /> Share on Pinterest
          </button>

          <button className="share-button more">
            <FaPlus size={20} />
          </button>
        </div>

        {/* NEXT PREV */}
        <div className="blogDetailsNextPrev">
          <div className="blogDetailsNextPrevContainer">
            <div onClick={scrollToTop}>
              <GoChevronLeft size={20} />
              <p>PREVIOUS POST</p>
            </div>
            <p>Given Set was without from god divide rule Hath</p>
          </div>

          <div className="blogDetailsNextPrevContainer">
            <div onClick={scrollToTop}>
              <p>NEXT POST</p>
              <GoChevronRight size={20} />
            </div>
            <p style={{ textAlign: "right" }}>
              Tree earth fowl given moveth deep lesser after
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogDetails;