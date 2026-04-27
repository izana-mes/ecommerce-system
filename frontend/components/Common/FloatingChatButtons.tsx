"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HiInformationCircle, HiSparkles } from "react-icons/hi2";
import { MdSupportAgent } from "react-icons/md";

import styles from "./FloatingChatButtons.module.css";

const ENABLED_PATHS = new Set(["/", "/shop"]);

export default function FloatingChatButtons() {
  const pathname = usePathname();

  if (!pathname || !ENABLED_PATHS.has(pathname)) {
    return null;
  }

  return (
    <aside className={styles.floatingDock} aria-label="Quick chat actions">
      <Link href="/chatbot" className={`${styles.floatingAction} ${styles.chatbot}`}>
        <span className={styles.iconWrap} aria-hidden="true">
          <HiSparkles size={20} />
        </span>
        <span className={styles.labelGroup}>
          <span className={styles.eyebrow}>AI assistant</span>
          <span className={styles.title}>Open chatbot</span>
        </span>
        <span className={styles.trailingBanner} aria-hidden="true">
          <span className={styles.trailingText}>AI</span>
          <span className={styles.infoIcon}>
            <HiInformationCircle size={16} />
          </span>
        </span>
      </Link>

      <Link href="/support-chat" className={`${styles.floatingAction} ${styles.staff}`}>
        <span className={styles.iconWrap} aria-hidden="true">
          <MdSupportAgent size={20} />
        </span>
        <span className={styles.labelGroup}>
          <span className={styles.eyebrow}>Live support</span>
          <span className={styles.title}>Chat with staff</span>
        </span>
        <span className={styles.trailingBanner} aria-hidden="true">
          <span className={styles.trailingText}>Help</span>
          <span className={styles.infoIcon}>
            <HiInformationCircle size={16} />
          </span>
        </span>
      </Link>
    </aside>
  );
}
