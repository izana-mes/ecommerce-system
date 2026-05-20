"use client";

import React, { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import "./ResetPass.css";
import { useLocale } from "@/components/providers/LocaleProvider";

const ResetPass: React.FC = () => {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    const tokenFromUrl = searchParams.get("token");
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, [searchParams]);

  const resolveErrorMessage = (data: unknown, fallback: string) => {
    if (!data || typeof data !== "object") return fallback;
    const obj = data as {
      message?: string;
      error?: string;
      details?: string;
      data?: { message?: string };
    };
    return obj.message || obj.error || obj.details || obj.data?.message || fallback;
  };

  const handleRequestReset = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRequestLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({ email })});

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(resolveErrorMessage(data, "Failed to request password reset"));
      }

      toast.success("Reset token sent. Check your email.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to request password reset");
    } finally {
      setRequestLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setResetLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({
          token,
          newPassword})});

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(resolveErrorMessage(data, "Failed to reset password"));
      }

      toast.success("Password reset successfully. You can login now.");
      setToken("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to reset password");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="resetPasswordSection">
      <h2>{t("auth_forgot_password")}</h2>

      <div className="resetPasswordContainer">
        <p>{t("auth_reset_instruction")}</p>

        <form onSubmit={handleRequestReset} className="resetPasswordForm">
          <input
            type="email"
            placeholder={t("auth_email_placeholder")}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={requestLoading}
          />
          <button type="submit" disabled={requestLoading}>
            {requestLoading ? t("auth_sending") : t("auth_send_reset_token")}
          </button>
        </form>
      </div>

      <div className="resetPasswordContainer">
        <p>{t("auth_reset_instruction_2")}</p>

        <form onSubmit={handleResetPassword} className="resetPasswordForm">
          <input
            type="text"
            placeholder={t("auth_reset_token_placeholder")}
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={resetLoading}
          />
          <input
            type="password"
            placeholder={t("auth_new_password_placeholder")}
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={resetLoading}
          />
          <input
            type="password"
            placeholder={t("auth_confirm_password_placeholder")}
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={resetLoading}
          />
          <button type="submit" disabled={resetLoading}>
            {resetLoading ? t("auth_updating") : t("auth_reset_password")}
          </button>
        </form>
      </div>

      <p>
        {t("auth_back_to")}
        <Link href="/login">
          <span>{t("auth_login")}</span>
        </Link>
      </p>
    </div>
  );
};

export default ResetPass;
