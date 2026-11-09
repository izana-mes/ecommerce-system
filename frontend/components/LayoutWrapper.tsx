"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { getUser, refreshCurrentUserFromServer, subscribeToAuthChanges } from "@/lib/auth";
import { useEffect, useState } from "react";

const CustomerRuntimeProvider = dynamic(() => import("@/store/provider"));
const Navbar = dynamic(() => import("@/components/Header/Navbar"));
const Footer = dynamic(() => import("@/components/Footer/Footer"));
const GlobalScrollReveal = dynamic(() => import("@/components/GlobalScrollReveal"));
const PageTransition = dynamic(() => import("@/components/PageTransition"));
const Toaster = dynamic(() => import("react-hot-toast").then((module) => module.Toaster));

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

const MANAGEMENT_ROLES = ["admin", "seller", "supplier", "shipper", "employee"];

export default function LayoutWrapper({ children, initialRole = "" }: { children: React.ReactNode; initialRole?: string }) {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(initialRole || null);
  const [roleResolved, setRoleResolved] = useState(Boolean(initialRole));
  useEffect(() => {
    const sync = () => {
      setRole(getUser()?.role || null);
      setRoleResolved(true);
    };
    sync();
    void refreshCurrentUserFromServer().then((user) => {
      setRole(user?.role || null);
      setRoleResolved(true);
    });
    return subscribeToAuthChanges(sync);
  }, []);
  const isManagementRoute = ["/admin", "/seller", "/supplier", "/shipper", "/staff"].some(
    (prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`)
  );
  // Management accounts keep their own chrome even on shared work tools such as
  // messaging and workspace; customer navigation is never mounted for them.
  const isManagement = isManagementRoute || (roleResolved && MANAGEMENT_ROLES.includes(role || ""));
  const isLanding = pathname === "/landing" || pathname === "/experience";
  const isMessaging = pathname === "/messages" || pathname?.startsWith("/messages/");

  // Management routes own their complete shell. Never mount customer shopping chrome here.
  if (isLanding || isManagement) {
    return (
      <main id="page-content" style={{ overflowX: "hidden" }}>
        {children}
      </main>
    );
  }

  if (["/profile", "/notifications"].includes(pathname || "") && !roleResolved) return <main id="page-content">{children}</main>;

  return (
    <CustomerRuntimeProvider>
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
    </CustomerRuntimeProvider>
  );
}
