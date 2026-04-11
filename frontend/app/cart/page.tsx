import { Suspense } from "react";
import ShoppingCart from "@/components/ShoppingCart/shoppingCart";

export default function Cart() {
  return (
    <Suspense fallback={null}>
      <ShoppingCart />
    </Suspense>
  );
}
