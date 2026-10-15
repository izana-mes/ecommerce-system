"use client";

import React, { useState } from "react";
import { HiOutlineXMark, HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { UserSearchResult } from "@/lib/chat/types";
import { searchUsersApi } from "@/lib/chat/chatApi";

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: UserSearchResult, initialMessage?: string) => Promise<void>;
  onCreateSupportChat: (initialMessage?: string) => Promise<void>;
}

export function NewConversationModal({
  isOpen,
  onClose,
  onSelectUser,
  onCreateSupportChat,
}: NewConversationModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialMsg, setInitialMsg] = useState("");

  if (!isOpen) return null;

  const handleSearch = async (q: string) => {
    setQuery(q);
    setError(null);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await searchUsersApi(q.trim());
      setResults(data);
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : "Unable to search users.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chatModalOverlay" onClick={onClose}>
      <div className="chatModalContent" onClick={(e) => e.stopPropagation()}>
        <div className="chatModalHeader">
          <h2>New Conversation</h2>
          <button type="button" className="chatIconBtn" onClick={onClose}>
            <HiOutlineXMark size={20} />
          </button>
        </div>

        <div className="chatModalBody">
          <button
            type="button"
            style={{
              padding: "12px 16px",
              background: "var(--chat-primary-light)",
              color: "var(--chat-primary)",
              border: "1px solid var(--chat-primary)",
              borderRadius: "10px",
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
            disabled={creating}
            onClick={async () => {
              setCreating(true);
              setError(null);
              try {
                await onCreateSupportChat(initialMsg || undefined);
                onClose();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Unable to create support conversation.");
              } finally {
                setCreating(false);
              }
            }}
          >
            💬 Contact Customer Support Desk
          </button>

          <div style={{ position: "relative" }}>
            <HiOutlineMagnifyingGlass
              size={18}
              style={{ position: "absolute", left: 12, top: 12, color: "var(--chat-text-muted)" }}
            />
            <input
              type="text"
              className="chatSidebarSearchInput"
              style={{ paddingLeft: 38 }}
              placeholder="Search by name, username, or email..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
          </div>

          <input
            type="text"
            className="chatSidebarSearchInput"
            placeholder="Optional: Initial message..."
            value={initialMsg}
            onChange={(e) => setInitialMsg(e.target.value)}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {error && <p className="chatComposerError" role="alert">{error}</p>}
            {loading && <p style={{ fontSize: 13, color: "var(--chat-text-muted)", textAlign: "center" }}>Searching...</p>}
            {!loading && query && results.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--chat-text-muted)", textAlign: "center" }}>No users found.</p>
            )}
            {results.map((u) => (
              <button
                key={u.userId}
                type="button"
                className="chatConversationItem"
                style={{ padding: "8px 10px" }}
                disabled={creating}
                onClick={async () => {
                  setCreating(true);
                  setError(null);
                  try {
                    await onSelectUser(u, initialMsg || undefined);
                    onClose();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Unable to start conversation.");
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                <div className="chatAvatar" style={{ width: 36, height: 36, fontSize: 14 }}>
                  {u.fullName ? u.fullName.charAt(0).toUpperCase() : "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{u.fullName}</div>
                  <div style={{ fontSize: 12, color: "var(--chat-text-muted)" }}>
                    {u.email} {u.role ? `(${u.role})` : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
