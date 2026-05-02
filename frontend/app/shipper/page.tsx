"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Navbar links here for ROLE_SHIPPER; fulfillment UI lives under /staff/shipping.
 */
export default function ShipperHubRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/staff/shipping");
  }, [router]);
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui", color: "#555" }}>
      Redirecting to fulfillment…
    </main>
  );
}
