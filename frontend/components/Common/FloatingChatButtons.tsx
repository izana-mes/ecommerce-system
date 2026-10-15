"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HiSparkles } from "react-icons/hi2";
import { MdSupportAgent } from "react-icons/md";

import styles from "./FloatingChatButtons.module.css";

const ENABLED_PATHS = new Set(["/", "/shop"]);

export default function FloatingChatButtons() {
  const pathname = usePathname();

  if (!pathname || !ENABLED_PATHS.has(pathname)) {
    return null;
  }

  return (
    <aside className={styles.floatingDock} aria-label="Quick customer support and AI assistant">
      <Link
        href="/chatbot"
        className={`${styles.floatingAction} ${styles.chatbot}`}
        aria-label="Open AI Shopping Assistant"
        title="AI Assistant"
      >
        <span className={styles.iconWrap} aria-hidden="true">
          <HiSparkles size={16} />
        </span>
        <span className={styles.actionLabel}>AI Assistant</span>
      </Link>

      <Link
        href="/support-chat"
        className={`${styles.floatingAction} ${styles.staff}`}
        aria-label="Chat with Support Staff"
        title="Live Support"
      >
        <span className={styles.iconWrap} aria-hidden="true">
          <MdSupportAgent size={18} />
        </span>
        <span className={styles.actionLabel}>Live Support</span>
      </Link>
    </aside>
  );
}
