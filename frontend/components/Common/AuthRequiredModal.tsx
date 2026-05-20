"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./AuthRequiredModal.module.css";

type AuthRequiredModalProps = {
  open: boolean;
  onClose: () => void;
  onLogin: () => void;
  message?: string;
};

export default function AuthRequiredModal({
  open,
  onClose,
  onLogin,
  message = "You need to log in before adding products to your cart."}: AuthRequiredModalProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-required-title"
        aria-describedby="auth-required-message"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.icon} aria-hidden="true">
          !
        </div>
        <h3 id="auth-required-title" className={styles.title}>
          Login Required
        </h3>
        <p id="auth-required-message" className={styles.message}>
          {message}
        </p>

        <div className={styles.actions}>
          <button type="button" className={styles.loginButton} onClick={onLogin}>
            Go to Login
          </button>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
