import { Suspense } from "react";
import ContactPage from "@/components/Contact/ContactPage";

export default function ContactRoutePage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>…</div>}>
      <ContactPage />
    </Suspense>
  );
}
