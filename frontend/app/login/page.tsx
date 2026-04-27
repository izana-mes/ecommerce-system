import { Suspense } from "react";
import LoginSignUp from "@/components/Authentication/LoginSign/LoginSignUp";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginSignUp />
    </Suspense>
  );
}


