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
    <aside className="chatDetailsPanel">
      <div className="chatDetailsHeader">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <HiOutlineUsers size={18} color="var(--chat-text-muted)" />
          <strong style={{ fontSize: 15, color: "var(--chat-text-main)" }}>Details</strong>
        </div>
        <button
          type="button"
          className="chatIconBtn"
          title="Close details"
          onClick={onClose}
        >
          <HiOutlineXMark size={20} />
        </button>
      </div>

      <div className="chatDetailsSection">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8 }}>
          <div className="chatAvatar" style={{ width: 64, height: 64, fontSize: 24 }}>
            {conversation.title ? conversation.title.charAt(0).toUpperCase() : "#"}
          </div>
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>
              {conversation.title || "Conversation"}
            </h3>
            <span style={{ fontSize: 12, color: "var(--chat-text-muted)", textTransform: "capitalize" }}>
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
              <div className="chatAvatar" style={{ width: 34, height: 34, fontSize: 13 }}>
                {m.fullName ? m.fullName.charAt(0).toUpperCase() : (m.email ? m.email.charAt(0).toUpperCase() : "?")}
              </div>
              <div className="chatMemberInfo">
                <div className="chatMemberName">{m.fullName || m.email || m.username || "User"}</div>
                <div className="chatMemberRole">{m.role || "Member"} {m.isOnline ? " · Online" : ""}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="chatDetailsSection">
        <h4 className="chatDetailsSectionTitle">Media</h4>
        <p style={{ margin: 0, fontSize: 13, color: "var(--chat-text-muted)" }}>
          File attachments are not enabled yet. This panel is ready for shared photos and files.
        </p>
      </div>
    </aside>
  );
}
