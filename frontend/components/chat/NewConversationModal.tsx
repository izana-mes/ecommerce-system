"use client";

import React, { useState } from "react";
import { HiOutlineXMark, HiOutlineMagnifyingGlass, HiOutlineQuestionMarkCircle } from "react-icons/hi2";
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
    <div className="chatModalOverlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="chatModalContent" onClick={(e) => e.stopPropagation()}>
        <div className="chatModalHeader">
          <h2 id="modal-title">New Conversation</h2>
          <button type="button" className="chatIconBtn" aria-label="Close dialog" onClick={onClose}>
            <HiOutlineXMark size={18} />
          </button>
        </div>

        <div className="chatModalBody">
          <button
            type="button"
            className="chatConversationItem"
            style={{
              padding: "10px 14px",
              backgroundColor: "var(--chat-paper-wash)",
              border: "1px solid var(--chat-border)",
              borderRadius: "var(--chat-radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 13.5,
              fontWeight: 500,
              color: "var(--chat-ink)",
              cursor: "pointer",
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
            <HiOutlineQuestionMarkCircle size={18} />
            <span>{creating ? "Connecting..." : "Contact Customer Support Desk"}</span>
          </button>

          <div style={{ position: "relative" }}>
            <HiOutlineMagnifyingGlass
              size={16}
              style={{ position: "absolute", left: 12, top: 12, color: "var(--chat-ink-subtle)" }}
              aria-hidden="true"
            />
            <input
              type="text"
              className="chatSidebarSearchInput"
              style={{ paddingLeft: 36 }}
              placeholder="Search by name, username, or email..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
              aria-label="Search users"
            />
          </div>

          <input
            type="text"
            className="chatSidebarSearchInput"
            placeholder="Optional: Initial message..."
            value={initialMsg}
            onChange={(e) => setInitialMsg(e.target.value)}
            aria-label="Initial message"
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {error && <div className="chatComposerError" role="alert">{error}</div>}
            {loading && (
              <div style={{ padding: 12, textAlign: "center" }}>
                <span className="chatSendingSpinner" style={{ borderColor: "rgba(0,0,0,0.15)", borderTopColor: "var(--chat-ink)" }} />
              </div>
            )}
            {!loading && query && results.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--chat-ink-subtle)", textAlign: "center", margin: "8px 0" }}>
                No users found.
              </p>
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
                <div className="chatAvatarWrap" style={{ width: 34, height: 34 }}>
                  <div className="chatAvatar" style={{ fontSize: 12 }}>
                    {(u.fullName || u.username || u.email || "?").charAt(0).toUpperCase()}
                  </div>
                  {u.isOnline && <span className="chatOnlineDot" />}
                </div>
                <div className="chatItemContent">
                  <div className="chatItemTopRow">
                    <span className="chatItemTitle" style={{ fontSize: 13.5 }}>
                      {u.fullName || u.username || u.email}
                    </span>
                    {u.isOnline && <span className="chatPresenceText">Online</span>}
                  </div>
                  <div className="chatItemBottomRow">
                    <span className="chatItemSnippet" style={{ fontSize: 12 }}>
                      {u.username ? `@${u.username}` : u.email}
                    </span>
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
