export interface BlogPost {
  id: number;
  blogThumbnail: string;
  blogDate: string;
  blogHeading: string;
}

const BlogData: BlogPost[] = [
  {
    id: 1,
    blogThumbnail: "/Blog/blog1.jpg",
    blogDate: "May 19, 2023",
    blogHeading: "5 Tips to Increase Your Online Sales",
  },
  {
    id: 2,
    blogThumbnail: "/Blog/blog2.jpg",
    blogDate: "May 22, 2023",
    blogHeading: "How To Build A Better Fashion Product Page",
  },
  {
    id: 3,
    blogThumbnail: "/Blog/blog3.jpg",
    blogDate: "May 28, 2023",
    blogHeading: "Seasonal Trends You Can Apply This Week",
  },
  {
    id: 4,
    blogThumbnail: "/Blog/blog4.jpg",
    blogDate: "June 02, 2023",
    blogHeading: "What Customers Expect From Modern Checkout",
  },
  {
    id: 5,
    blogThumbnail: "/Blog/blog5.jpg",
    blogDate: "June 09, 2023",
    blogHeading: "Designing Product Stories That Convert",
  },
  {
    id: 6,
    blogThumbnail: "/Blog/blog6.jpg",
    blogDate: "June 14, 2023",
    blogHeading: "Simple Retention Ideas For Small Shops",
  },
];

export default BlogData;
