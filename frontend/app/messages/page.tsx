"use client";

import React, { useEffect, useState } from "react";
import { getUser, refreshCurrentUserFromServer, User } from "@/lib/auth";
import { ChatApp } from "@/components/chat/ChatApp";
import Link from "next/link";

export default function MessagesPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(getUser());
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    refreshCurrentUserFromServer().then((u) => {
      setCurrentUser(u);
      setLoadingAuth(false);
    });
  }, []);

  if (loadingAuth) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", color: "#71717a", gap: 12 }}>
        <span
          style={{
            width: 20,
            height: 20,
            border: "2px solid #e4e4e7",
            borderTopColor: "#18181b",
            borderRadius: "50%",
            animation: "chatSpin 0.7s linear infinite",
            display: "inline-block",
          }}
        />
        <span style={{ fontSize: 13, letterSpacing: "0.02em" }}>Loading messages...</span>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{ padding: "80px 24px", textAlign: "center", maxWidth: 440, margin: "0 auto" }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "#18181b", margin: "0 0 8px", letterSpacing: "-0.01em" }}>
          Sign In Required
        </h2>
        <p style={{ color: "#71717a", margin: "0 0 24px", fontSize: 14, lineHeight: 1.5 }}>
          Please sign in to access conversations, message teammates, or contact customer support.
        </p>
        <Link
          href="/login"
          style={{
            display: "inline-block",
            padding: "10px 22px",
            backgroundColor: "#18181b",
            color: "#ffffff",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 500,
            fontSize: 14,
            transition: "background-color 0.15s ease",
          }}
        >
          Sign In
        </Link>
      </div>
    );
  }

  return <ChatApp currentUser={currentUser} />;
}
