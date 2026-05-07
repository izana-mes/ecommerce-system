"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /seller/catalog redirects to /seller which contains the full catalog management workspace.
 */
export default function SellerCatalogRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/seller");
  }, [router]);
  return null;
}
