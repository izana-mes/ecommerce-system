"use client";

import React from "react";
import "./BlogList.css";

import Image from "next/image";
import Link from "next/link";

import BlogData from "@/data/BlogData";

interface BlogPost {
  id: number;
  blogThumbnail: string;
  blogDate: string;
  blogHeading: string;
}

const BlogList: React.FC = () => {
  const scrollToTop = (): void => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="blogListSection">
      {/* VERTICAL SIDE BADGE */}
      <div className="jp-vertical-badge">BLOG&nbsp;/&nbsp;ブログ</div>

      {/* HEADER */}
      <div className="blogListHeaderContainer" data-floating-banner>
        <div className="blogListHeader jp-grid-bg">
          <div className="jp-title-wrap" style={{ alignItems: "flex-start", marginBottom: "16px" }}>
            <span className="jp-subtitle" style={{ color: "rgba(255,255,255,0.75)" }}>
              JOURNAL&nbsp;&nbsp;/&nbsp;&nbsp;新着コラム・ブログ
            </span>
          </div>
          <h2>The Blog</h2>

          <div className="blogListHeaderCategories">
            <p>ALL</p>
            <p>COMPANY</p>
            <p className="activeCategory">FASHION</p>
            <p>STYLE</p>
            <p>TRENDS</p>
            <p>BEAUTY</p>
          </div>
        </div>
      </div>

      {/* LIST */}
      <div className="blogPostListContainer">
        {(BlogData as BlogPost[]).map((blogPost) => (
          <div key={blogPost.id} className="blogPost">
            {/* IMAGE */}
            <div className="blogPostThumb">
              <Image
                src={blogPost.blogThumbnail}
                alt="blogPost"
                width={400}
                height={250}
              />
            </div>

            {/* CONTENT */}
            <div className="blogPostContent">
              <div className="blogPostContentDate">
                <p>by admin</p>
                <p>{blogPost.blogDate}</p>
              </div>

              <div className="blogPostContentHeading">
                <Link href="/blog-details" onClick={scrollToTop}>
                  {blogPost.blogHeading}
                </Link>
              </div>

              <div className="blogPostContentDescription">
                <p>
                  Midst one brought greater also morning green saying had good...
                </p>
              </div>

              <div className="blogPostContentReadMore">
                <Link href="/blog-details" onClick={scrollToTop}>
                  Continue Reading
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MARQUEE FOOTER */}
      <div className="jp-marquee blog-marquee">
        <div className="jp-marquee-track">
          {[...Array(2)].map((_, i) =>
            ["FASHION", "STYLE", "TRENDS", "BEAUTY", "COMPANY", "CULTURE", "ファッション", "スタイル"].map((item) => (
              <span key={`${i}-${item}`} className="jp-marquee-item">
                {item} <span>◆</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* LOAD MORE */}
      <div className="blogLoadMoreWrap">
        <button className="blogListShowMore jp-btn" onClick={scrollToTop}>
          <span className="blogLoadMoreEn">LOAD MORE</span>
          <span className="blogLoadMoreJp">もっと見る</span>
        </button>
      </div>
    </div>
  );
};

export default BlogList;
