"use client";

import React, { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import "./ResetPass.css";

const ResetPass: React.FC = () => {
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
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

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
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

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
      <h2>Forgot Your Password?</h2>

      <div className="resetPasswordContainer">
        <p>Enter your account email and we will send you a reset token.</p>

        <form onSubmit={handleRequestReset} className="resetPasswordForm">
          <input
            type="email"
            placeholder="Email address *"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={requestLoading}
          />
          <button type="submit" disabled={requestLoading}>
            {requestLoading ? "Sending..." : "Send Reset Token"}
          </button>
        </form>
      </div>

      <div className="resetPasswordContainer">
        <p>After receiving the token, reset your password below.</p>

        <form onSubmit={handleResetPassword} className="resetPasswordForm">
          <input
            type="text"
            placeholder="Reset token *"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={resetLoading}
          />
          <input
            type="password"
            placeholder="New password *"
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={resetLoading}
          />
          <input
            type="password"
            placeholder="Confirm new password *"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={resetLoading}
          />
          <button type="submit" disabled={resetLoading}>
            {resetLoading ? "Updating..." : "Reset Password"}
          </button>
        </form>
      </div>

      <p>
        Back to{" "}
        <Link href="/login">
          <span>Login</span>
        </Link>
      </p>
    </div>
  );
};

export default ResetPass;
