"use client";

import React, { useState, FormEvent } from "react";
import "./LoginSignUp.css";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { useAppDispatch } from "@/store";
import { clearCart, fetchCartAsync } from "@/store/cartSlice";
import { clearWishList, fetchWishlistAsync } from "@/store/wishListSlice";
import { logout as clearAuth, setAuth } from "@/lib/auth";
import confetti from "canvas-confetti";
import { useLocale } from "@/components/providers/LocaleProvider";

const LoginSignUp = () => {
  const { t } = useLocale();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("tabButton1");
  const [loading, setLoading] = useState(false);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  
  // Register form state
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerFirstName, setRegisterFirstName] = useState("");
  const [registerLastName, setRegisterLastName] = useState("");
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyOtp, setVerifyOtp] = useState("");

  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;
  const resolveRole = (
    profile: { role?: string; roles?: string[] } | null | undefined
  ): "user" | "admin" | "employee" | "supplier" | "shipper" => {
    if (profile?.role === "admin") return "admin";
    if (profile?.role === "employee") return "employee";
    if (profile?.role === "supplier") return "supplier";
    if (profile?.role === "shipper") return "shipper";
    if (Array.isArray(profile?.roles) && profile.roles.includes("ROLE_ADMIN")) return "admin";
    if (Array.isArray(profile?.roles) && profile.roles.includes("ROLE_EMPLOYEE")) return "employee";
    if (Array.isArray(profile?.roles) && profile.roles.includes("ROLE_SUPPLIER")) return "supplier";
    if (Array.isArray(profile?.roles) && profile.roles.includes("ROLE_SHIPPER")) return "shipper";

    return "user";
  };
  const returnToParam = (searchParams.get("returnTo") || "").trim();
  const returnTo = returnToParam.startsWith("/") && !returnToParam.startsWith("//")
    ? returnToParam
    : "/";

  const handleTab = (tab: string) => {
    setActiveTab(tab);
    // Clear form errors when switching tabs
    setLoginEmail("");
    setLoginPassword("");
    setRegisterUsername("");
    setRegisterEmail("");
    setRegisterPassword("");
    setRegisterFirstName("");
    setRegisterLastName("");
    setVerifyEmail("");
    setVerifyOtp("");
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Clear any previous auth and per-user state before logging in a new user
      clearAuth();
      dispatch(clearCart());
      dispatch(clearWishList());

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword})});

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("Invalid response from server");
      }

      if (!response.ok) {
        // Spring wraps errors in ApiResponse: { success: false, message: "..." }
        const errorMessage =
          data?.message || data?.data?.message || data?.error || data?.details || "Login failed";
        if (errorMessage.toLowerCase().includes("verify your email")) {
          setVerifyEmail(loginEmail);
          setActiveTab("tabButton3");
        }
        console.error("Login error:", errorMessage, data);
        throw new Error(errorMessage);
      }

      const authData = data?.data;
      if (!response.ok || authData?.status !== "AUTHENTICATED") {
        throw new Error(data?.message || "Login failed");
      }

      let resolvedUser = {
        email: loginEmail,
        role: "user" as "user" | "admin" | "employee" | "supplier" | "shipper",
        firstName: undefined as string | undefined,
        lastName: undefined as string | undefined,
        id: undefined as string | number | undefined};

      try {
        const meResponse = await fetch("/api/auth/me", {
          method: "GET",
          headers: {
            "Content-Type": "application/json"}});
        const meData = await meResponse.json();
        const profile = meData?.data;
        if (meResponse.ok && profile?.email) {
          const role = resolveRole(profile);
          resolvedUser = {
            email: profile.email,
            role,
            firstName: profile.firstName || undefined,
            lastName: profile.lastName || undefined,
            id: profile.id};
        }
      } catch {
        // Keep fallback resolvedUser when profile endpoint is temporarily unavailable.
      }

      // Store token and user data using shared auth helper
      setAuth("", resolvedUser, rememberMe);

      // Load cart and wishlist for the newly logged-in user
      dispatch(fetchCartAsync());
      dispatch(fetchWishlistAsync());

      toast.success("Login successful!", {
        duration: 2000,
        style: {
          backgroundColor: "#07bc0c",
          color: "#fff"},
        iconTheme: {
          primary: "#fff",
          secondary: "#07bc0c"}});

      // Confetti effect for successful login
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        zIndex: 9999});

      // Redirect to home page immediately after successful login
      router.replace(returnTo);
      router.refresh();
    } catch (error: unknown) {
      console.error("Login error details:", error);
      const errorMessage = getErrorMessage(
        error,
        "Login failed. Please check your credentials and try again."
      );
      toast.error(errorMessage, {
        duration: 3000,
        style: {
          backgroundColor: "#fb0404",
          color: "#fff"}});
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({
          username: registerUsername,
          email: registerEmail,
          password: registerPassword,
          firstName: registerFirstName || null,
          lastName: registerLastName || null})});

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Registration failed");
      }

      toast.success("Registration successful! Enter OTP from your email.", {
        duration: 2000,
        style: {
          backgroundColor: "#07bc0c",
          color: "#fff"},
        iconTheme: {
          primary: "#fff",
          secondary: "#07bc0c"}});

      // Move user directly to email verification screen
      setVerifyEmail(registerEmail);
      setActiveTab("tabButton3");
      setRegisterUsername("");
      setRegisterPassword("");
      setRegisterFirstName("");
      setRegisterLastName("");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Registration failed"), {
        duration: 2000,
        style: {
          backgroundColor: "#fb0404",
          color: "#fff"}});
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({
          email: verifyEmail,
          otp: verifyOtp})});

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || data?.error || "OTP verification failed");
      }

      toast.success("Email verified! You can login now.", {
        duration: 2000,
        style: {
          backgroundColor: "#07bc0c",
          color: "#fff"}});

      setLoginEmail(verifyEmail);
      setVerifyOtp("");
      setActiveTab("tabButton1");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "OTP verification failed"), {
        duration: 2500,
        style: {
          backgroundColor: "#fb0404",
          color: "#fff"}});
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!verifyEmail) {
      toast.error("Please enter your email first");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({ email: verifyEmail })});

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to resend OTP");
      }

      toast.success("OTP resent. Check your email.");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to resend OTP"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const frontendRedirectUri = `${window.location.origin}/oauth/callback`;
    const oauthStartUrl = new URL("/api/auth/oauth/google/start", window.location.origin);
    oauthStartUrl.searchParams.set("frontend_redirect_uri", frontendRedirectUri);
    window.location.href = oauthStartUrl.toString();
  };

  return (
    <>
      <div className="loginSignUpSection">
        <div className="loginSignUpContainer">
          <div className="loginSignUpTabs">
            <p
              onClick={() => handleTab("tabButton1")}
              className={activeTab === "tabButton1" ? "active" : ""}
            >
              {t("auth_login")}
            </p>
            <p
              onClick={() => handleTab("tabButton2")}
              className={activeTab === "tabButton2" ? "active" : ""}
            >
              {t("auth_register")}
            </p>
            <p
              onClick={() => handleTab("tabButton3")}
              className={activeTab === "tabButton3" ? "active" : ""}
            >
              {t("auth_verify_email")}
            </p>
          </div>
          <div className="loginSignUpTabsContent">
            {/* tab1 - Login */}

            {activeTab === "tabButton1" && (
              <div className="loginSignUpTabsContentLogin">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="googleLoginButton"
                >
                  {t("auth_google_login")}
                </button>
                <form onSubmit={handleLogin}>
                  <input
                    type="email"
                    placeholder={t("auth_email_placeholder")}
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={loading}
                  />
                  <input
                    type="password"
                    placeholder={t("auth_password_placeholder")}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={loading}
                  />
                  <div className="loginSignUpForgetPass">
                    <label>
                      <input
                        type="checkbox"
                        className="brandRadio"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        disabled={loading}
                      />
                      <p>{t("auth_remember_me")}</p>
                    </label>
                    <p>
                      <Link href="/resetPassword">{t("auth_lost_password")}</Link>
                    </p>
                  </div>
                  <button type="submit" disabled={loading}>
                    {loading ? t("auth_logging_in") : t("auth_log_in_btn")}
                  </button>
                </form>
                <div className="loginSignUpTabsContentLoginText">
                  <p>
                    {t("auth_no_account")}{" "}
                    <span
                      onClick={() => handleTab("tabButton2")}
                      style={{ cursor: "pointer", color: "#c32929" }}
                    >
                      {t("auth_create_account")}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Tab2 - Register */}

            {activeTab === "tabButton2" && (
              <div className="loginSignUpTabsContentRegister">
                <form onSubmit={handleRegister}>
                  <input
                    type="text"
                    placeholder={t("auth_username_placeholder")}
                    required
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    disabled={loading}
                  />
                  <input
                    type="email"
                    placeholder={t("auth_email_placeholder")}
                    required
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    disabled={loading}
                  />
                  <input
                    type="password"
                    placeholder={t("auth_password_min_length")}
                    required
                    minLength={6}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    disabled={loading}
                  />
                  <input
                    type="text"
                    placeholder={t("auth_first_name_optional")}
                    value={registerFirstName}
                    onChange={(e) => setRegisterFirstName(e.target.value)}
                    disabled={loading}
                  />
                  <input
                    type="text"
                    placeholder={t("auth_last_name_optional")}
                    value={registerLastName}
                    onChange={(e) => setRegisterLastName(e.target.value)}
                    disabled={loading}
                  />
                  <p>
                    {t("auth_privacy_1")}
                    <Link
                      href="/terms"
                      style={{ textDecoration: "none", color: "#c32929" }}
                    >
                      {" "}
                      {t("auth_privacy_2")}
                    </Link>
                    {t("auth_privacy_3")}
                  </p>
                  <button type="submit" disabled={loading}>
                    {loading ? t("auth_registering") : t("auth_register")}
                  </button>
                </form>
              </div>
            )}

            {/* Tab3 - Verify Email */}
            {activeTab === "tabButton3" && (
              <div className="loginSignUpTabsContentVerify">
                <form onSubmit={handleVerifyOtp}>
                  <input
                    type="email"
                    placeholder={t("auth_email_placeholder")}
                    required
                    value={verifyEmail}
                    onChange={(e) => setVerifyEmail(e.target.value)}
                    disabled={loading}
                  />
                  <input
                    type="text"
                    placeholder={t("auth_verification_code_placeholder")}
                    required
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={verifyOtp}
                    onChange={(e) => setVerifyOtp(e.target.value.replace(/\D/g, ""))}
                    disabled={loading}
                  />
                  <p>{t("auth_otp_instruction")}</p>
                  <button type="submit" disabled={loading}>
                    {loading ? t("auth_verifying") : t("auth_verify_code")}
                  </button>
                  <button
                    type="button"
                    className="secondaryButton"
                    onClick={handleResendOtp}
                    disabled={loading}
                  >
                    {t("auth_resend_code")}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginSignUp;
