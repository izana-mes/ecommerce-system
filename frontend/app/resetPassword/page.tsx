import { Suspense } from "react";
import ResetPass from "@/components/Authentication/Reset/ResetPass";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Loading...</div>}>
      <ResetPass />
    </Suspense>
  );
}
