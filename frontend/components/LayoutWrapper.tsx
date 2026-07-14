"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Header/Navbar";
import Footer from "@/components/Footer/Footer";
import GlobalScrollReveal from "@/components/GlobalScrollReveal";
import GlobalFloatingBanners from "@/components/GlobalFloatingBanners";
import PageTransition from "@/components/PageTransition";
import FloatingChatButtons from "@/components/Common/FloatingChatButtons";
import ChatbotWidget from "@/components/Chatbot/ChatbotWidget";
import { Toaster } from "react-hot-toast";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/landing" || pathname === "/experience";

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
      <main id="page-content" className="jp-seigaiha-bg">
        <PageTransition>{children}</PageTransition>
      </main>
      <FloatingChatButtons />
      <ChatbotWidget />
      <Footer />
      <Toaster />
    </>
  );
}
