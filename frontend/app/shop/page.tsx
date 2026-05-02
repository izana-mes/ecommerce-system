import { Suspense } from "react";
import Shopping from "@/components/Shop/Shop";
import "@/components/Shop/Shop.css";

export default function Shop() {
  return (
    <Suspense
      fallback={
        <div className="shopPageFallback">
          <div className="shopPageFallbackSpinner" />
          <p>Loading products...</p>
        </div>
      }
    >
      <Shopping />
    </Suspense>
  );
}
