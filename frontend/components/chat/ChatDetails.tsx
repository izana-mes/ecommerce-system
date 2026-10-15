"use client";

import React from "react";
import { HiOutlineXMark, HiOutlineUsers } from "react-icons/hi2";
import { ChatConversation } from "@/lib/chat/types";

interface ChatDetailsProps {
  conversation: ChatConversation;
  onClose: () => void;
}

export function ChatDetails({ conversation, onClose }: ChatDetailsProps) {
  const participants = conversation.participants || [];

  return (
    <aside className="chatDetailsPanel" aria-label="Conversation details">
      <div className="chatDetailsHeader">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <HiOutlineUsers size={17} style={{ color: "var(--chat-ink-subtle)" }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--chat-ink)" }}>Details</span>
        </div>
        <button
          type="button"
          className="chatIconBtn"
          title="Close details"
          aria-label="Close details"
          onClick={onClose}
        >
          <HiOutlineXMark size={18} />
        </button>
      </div>

      <div className="chatDetailsSection">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
          <div className="chatAvatar" style={{ width: 56, height: 56, fontSize: 20 }}>
            {conversation.title ? conversation.title.charAt(0).toUpperCase() : "#"}
          </div>
          <div>
            <h3 style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 600, color: "var(--chat-ink)" }}>
              {conversation.title || "Conversation"}
            </h3>
            <span style={{ fontSize: 12, color: "var(--chat-ink-subtle)", textTransform: "capitalize" }}>
              {conversation.type} Chat
            </span>
          </div>
        </div>
      </div>

      <div className="chatDetailsSection">
        <h4 className="chatDetailsSectionTitle">
          Members ({participants.length})
        </h4>
        <div className="chatMemberList">
          {participants.map((m) => (
            <div key={m.userId} className="chatMemberRow">
              <div className="chatAvatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                {m.fullName ? m.fullName.charAt(0).toUpperCase() : (m.email ? m.email.charAt(0).toUpperCase() : "?")}
              </div>
              <div className="chatMemberInfo">
                <div className="chatMemberName">{m.fullName || m.email || m.username || "User"}</div>
                <div className="chatMemberRole">
                  {m.role || "Member"} {m.isOnline ? " · Online" : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="chatDetailsSection" style={{ borderBottom: "none" }}>
        <h4 className="chatDetailsSectionTitle">Shared Media</h4>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--chat-ink-subtle)", lineHeight: 1.5 }}>
          File attachments and shared photos will be organized here.
        </p>
      </div>
    </aside>
  );
}
