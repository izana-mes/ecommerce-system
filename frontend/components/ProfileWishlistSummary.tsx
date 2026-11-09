"use client";

import Link from "next/link";
import { useAppSelector } from "@/store";

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value || 0));
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency || "USD"}`;
  }
}

export default function ProfileWishlistSummary() {
  const items = useAppSelector((state) => Object.values(state.wishList.itemsById));
  return (
    <>
      <div className="profileMetricCard">
        <span className="profileMetricIcon">❤️</span>
        <div>
          <strong>{items.length}</strong>
          <span>Wishlist Items</span>
        </div>
      </div>
      {items.length > 0 ? (
        <div className="profileWishlistPreview">
          <div className="profileWishlistHeader">
            <h3>Your Wishlist</h3>
            <Link href="/wishlist" className="profileLinkButton profileSecondaryButton">View all</Link>
          </div>
          <div className="profileWishlistGrid">
            {items.slice(0, 3).map((item) => (
              <article key={item.productID} className="profileWishlistItem">
                <div className="profileWishlistInfo">
                  <h4>{item.productName}</h4>
                  <p>{formatMoney(item.productPrice, "USD")}</p>
                </div>
                <Link href={`/shop/${item.productID}`} className="profilePrimaryButton profileSmallBtn">View Item</Link>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
