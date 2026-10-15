"use client";

import React from "react";
import { ChatConversation } from "@/lib/chat/types";

interface ConversationItemProps {
  conversation: ChatConversation;
  isActive: boolean;
  onSelect: (conversationId: string) => void;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ConversationItem({ conversation, isActive, onSelect }: ConversationItemProps) {
  const initial = conversation.title ? conversation.title.charAt(0).toUpperCase() : "#";
  const hasUnread = Boolean(conversation.unreadCount && conversation.unreadCount > 0);

  return (
    <button
      type="button"
      className={`chatConversationItem ${isActive ? "active" : ""} ${hasUnread ? "hasUnread" : ""}`}
      onClick={() => onSelect(conversation.conversationId)}
      aria-selected={isActive}
    >
      <div className="chatAvatarWrap">
        <div className="chatAvatar">{initial}</div>
        {conversation.isOnline && <span className="chatOnlineDot" aria-label="Online" />}
      </div>

      <div className="chatItemContent">
        <div className="chatItemTopRow">
          <span className="chatItemTitle">{conversation.title || "Conversation"}</span>
          <span className="chatItemTime">{formatRelativeTime(conversation.lastMessageAt)}</span>
        </div>

        <div className="chatItemBottomRow">
          <span className="chatItemSnippet">
            {conversation.lastMessagePreview || "No messages yet"}
          </span>
          {hasUnread && (
            <span className="chatUnreadBadge" aria-label={`${conversation.unreadCount} unread messages`}>
              {conversation.unreadCount! > 99 ? "99+" : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
