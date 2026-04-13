import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Privacy | Uomo",
  description: "Read Uomo's terms, privacy practices, and support information.",
};

export default function TermsPage() {
  return (
    <main style={{ maxWidth: "900px", margin: "0 auto", padding: "48px 20px" }}>
      <h1 style={{ marginBottom: "16px" }}>Terms & Privacy</h1>
      <p style={{ marginBottom: "20px", lineHeight: 1.7 }}>
        By using this site, you agree to our standard terms of use and privacy
        practices. We only collect data needed to process orders, improve your
        shopping experience, and provide customer support.
      </p>

      <section style={{ marginBottom: "20px" }}>
        <h2 style={{ marginBottom: "8px" }}>Account & Orders</h2>
        <p style={{ lineHeight: 1.7 }}>
          Keep your account credentials secure. You are responsible for
          activities performed with your account and for providing accurate
          delivery and billing information for every order.
        </p>
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2 style={{ marginBottom: "8px" }}>Privacy</h2>
        <p style={{ lineHeight: 1.7 }}>
          Personal data such as name, email, and shipping details is used only
          for order fulfillment, communication, and service improvements. We do
          not sell personal data to third parties.
        </p>
      </section>

      <section>
        <h2 style={{ marginBottom: "8px" }}>Contact</h2>
        <p style={{ lineHeight: 1.7 }}>
          Questions about legal terms or privacy can be sent to
          {" "}sale@uomo.com.
        </p>
      </section>
    </main>
  );
}
