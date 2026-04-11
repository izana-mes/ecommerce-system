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
      {/* HEADER */}
      <div className="blogListHeaderContainer">
        <div className="blogListHeader">
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

      {/* LOAD MORE */}
      <p className="blogListShowMore" onClick={scrollToTop}>
        Show More
      </p>
    </div>
  );
};

export default BlogList;