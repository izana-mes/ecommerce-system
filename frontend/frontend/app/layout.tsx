import "./globals.css";
import ReduxProvider from "@/store/provider";
import Navbar from "@/components/Header/Navbar";
import Footer from "@/components/Footer/Footer";
import GlobalScrollReveal from "@/components/GlobalScrollReveal";
import { Toaster } from "react-hot-toast";
import Script from "next/script";
import LocaleProvider from "@/components/providers/LocaleProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">{`
          (function () {
            try {
              var stored = localStorage.getItem("theme");
              var systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
              var theme = (stored === "dark" || stored === "light") ? stored : (systemDark ? "dark" : "light");
              document.documentElement.setAttribute("data-theme", theme);
            } catch (e) {
              document.documentElement.setAttribute("data-theme", "light");
            }
          })();
        `}</Script>
        <Script id="locale-init" strategy="beforeInteractive">{`
          (function () {
            try {
              var stored = localStorage.getItem("locale");
              var locale = (stored === "ja" || stored === "en")
                ? stored
                : ((navigator.language || "").toLowerCase().indexOf("ja") === 0 ? "ja" : "en");
              document.documentElement.setAttribute("data-locale", locale);
              document.documentElement.setAttribute("lang", locale);
            } catch (e) {
              document.documentElement.setAttribute("data-locale", "en");
              document.documentElement.setAttribute("lang", "en");
            }
          })();
        `}</Script>
      </head>
      <body className="antialiased">
        <ReduxProvider>
          <LocaleProvider>
            <GlobalScrollReveal />
            <Navbar />
            <main id="page-content">{children}</main>
            <Footer />
            <Toaster />
          </LocaleProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
