import { Suspense } from "react";
import Shopping from "@/components/Shop/Shop";

export default function Shop() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Loading...</div>}>
      <Shopping />
    </Suspense>
  );
}
