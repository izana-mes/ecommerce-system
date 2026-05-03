"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ShipperRootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/shipper/dashboard");
  }, [router]);
  return null;
}
