"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Navbar from "@/components/Header/Navbar";
import Footer from "@/components/Footer/Footer";
import GlobalScrollReveal from "@/components/GlobalScrollReveal";
import PageTransition from "@/components/PageTransition";
import { Toaster } from "react-hot-toast";

const FloatingChatButtons = dynamic(
  () => import("@/components/Common/FloatingChatButtons"),
  { ssr: false }
);

const ChatbotWidget = dynamic(
  () => import("@/components/Chatbot/ChatbotWidget"),
  { ssr: false }
);

const GlobalFloatingBanners = dynamic(
  () => import("@/components/GlobalFloatingBanners"),
  { ssr: false }
);

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/landing" || pathname === "/experience";
  const isMessaging = pathname === "/messages" || pathname?.startsWith("/messages/");

  if (isLanding) {
    return (
      <main id="page-content" style={{ overflowX: "hidden" }}>
        {children}
      </main>
    );
  }

  return (
    <>
      <GlobalScrollReveal />
      <GlobalFloatingBanners />
      <Navbar />
      <main id="page-content" className={`jp-seigaiha-bg${isMessaging ? " chatPageShell" : ""}`}>
        <PageTransition>{children}</PageTransition>
      </main>
      {!isMessaging ? <FloatingChatButtons /> : null}
      <ChatbotWidget />
      {!isMessaging ? <Footer /> : null}
      <Toaster />
    </>
  );
}
