const Product_1 = "/Products/product_1.jpg";
const Product_1_1 = "/Products/product_1-1.jpg";
const Product_2 = "/Products/product_2.jpg";
const Product_2_1 = "/Products/product_2-1.jpg";
const Product_3 = "/Products/product_3.jpg";
const Product_3_1 = "/Products/product_3-1.jpg";
const Product_4 = "/Products/product_4.jpg";
const Product_4_1 = "/Products/product_4-1.jpg";
const Product_5 = "/Products/product_5.jpg";
const Product_5_1 = "/Products/product_5-1.jpg";
const Product_6 = "/Products/product_6.jpg";
const Product_6_1 = "/Products/product_6-1.jpg";
const Product_7 = "/Products/product_7.jpg";
const Product_7_1 = "/Products/product_7-1.jpg";
const Product_8 = "/Products/product_8.jpg";
const Product_8_1 = "/Products/product_8-1.jpg";

const limited1 = "/LimitedEdition/limited-1.jpg";
const limited2 = "/LimitedEdition/limited-2.jpg";
const limited3 = "/LimitedEdition/limited-3.jpg";
const limited4 = "/LimitedEdition/limited-4.jpg";
const limited5 = "/LimitedEdition/limited-5.jpg";

export interface DataStore {
  productID: string;
  frontImg: string;
  backImg?: string;
  productName: string;
  productPrice: number;
  oldPrice?: number;
  productReviews: string;
  category?: string;
  sizes?: string[];
  stockQuantity?: number;
  active?: boolean;
}

const StoreData: DataStore[] = [
  {
    productID: "1",
    frontImg: Product_1,
    backImg: Product_1_1,
    productName: "Cropped Faux Leather Jacket",
    productPrice: 29,
    productReviews: "8k+ reviews",
    category: "Jackets",
    sizes: ["XS", "S", "M", "L", "XL"],
  },
  {
    productID: "2",
    frontImg: Product_2,
    backImg: Product_2_1,
    productName: "Calvin Shorts",
    productPrice: 62,
    productReviews: "2k+ reviews",
    category: "Shorts",
    sizes: ["S", "M", "L"],
  },
  {
    productID: "3",
    frontImg: Product_3,
    backImg: Product_3_1,
    productName: "Shirt In Botanical Cheetah Print",
    productPrice: 60,
    productReviews: "7k+ reviews",
    category: "Tops",
    sizes: ["S", "M", "L", "XL"],
  },
  {
    productID: "4",
    frontImg: Product_4,
    backImg: Product_4_1,
    productName: "Cotton Jersey T-Shirt",
    productPrice: 17,
    productReviews: "5k+ reviews",
    category: "Tops",
    sizes: ["XS", "S", "M", "L"],
  },
  {
    productID: "5",
    frontImg: Product_5,
    backImg: Product_5_1,
    productName: "Cableknit Shawl",
    productPrice: 100,
    productReviews: "9k+ reviews",
    category: "Knitwear",
    sizes: ["M", "L", "XL"],
  },
  {
    productID: "6",
    frontImg: Product_6,
    backImg: Product_6_1,
    productName: "Colorful Jacket",
    productPrice: 69,
    productReviews: "1k+ reviews",
    category: "Jackets",
    sizes: ["S", "M", "L", "XL", "XXL"],
  },
  {
    productID: "7",
    frontImg: Product_7,
    backImg: Product_7_1,
    productName: "Zessi Dresses",
    productPrice: 99,
    productReviews: "3k+ reviews",
    category: "Dresses",
    sizes: ["XS", "S", "M", "L"],
  },
  {
    productID: "8",
    frontImg: Product_8,
    backImg: Product_8_1,
    productName: "Kirby T-Shirt",
    productPrice: 37,
    productReviews: "4k+ reviews",
    category: "Tops",
    sizes: ["S", "M", "L", "XL"],
  },
  {
    productID: "9",
    frontImg: limited1,
    productName: "Hosking Blue Area Rug",
    productPrice: 29,
    productReviews: "8k+ reviews",
    category: "Home Decor",
    sizes: ["One Size"],
  },
  {
    productID: "10",
    frontImg: limited2,
    productName: "Hanneman Pouf",
    productPrice: 92,
    productReviews: "5k+ reviews",
    category: "Home Decor",
    sizes: ["One Size"],
  },
  {
    productID: "11",
    frontImg: limited3,
    productName: "Cushion Futon Slipcover",
    productPrice: 25,
    productReviews: "1k+ reviews",
    category: "Knitwear",
    sizes: ["One Size"],
  },
  {
    productID: "12",
    frontImg: limited4,
    productName: "Hub Accent Mirror",
    productPrice: 27,
    productReviews: "7k+ reviews",
    category: "Home Decor",
    sizes: ["One Size"],
  },
  {
    productID: "13",
    frontImg: limited5,
    productName: "Bold Male Black Analog",
    productPrice: 39,
    productReviews: "71+ reviews",
    category: "Accessories",
    sizes: ["One Size"],
  },
];

export default StoreData;
