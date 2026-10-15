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
      <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
        Loading messaging center...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
        <h2>Sign In Required</h2>
        <p style={{ color: "#64748b", margin: "12px 0 24px" }}>
          You need to be signed in to access the messaging center and chat with team members or support.
        </p>
        <Link
          href="/login"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            backgroundColor: "#0f3dad",
            color: "#fff",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Sign In
        </Link>
      </div>
    );
  }

  return <ChatApp currentUser={currentUser} />;
}
