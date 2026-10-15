"use client";

import React from "react";
import { HiArrowLeft, HiOutlineInformationCircle } from "react-icons/hi2";
import { ChatConversation } from "@/lib/chat/types";

interface ChatHeaderProps {
  conversation: ChatConversation;
  typingUserNames?: string[];
  showDetails: boolean;
  onToggleDetails: () => void;
  onBackMobile?: () => void;
}

export function ChatHeader({
  conversation,
  typingUserNames = [],
  showDetails,
  onToggleDetails,
  onBackMobile,
}: ChatHeaderProps) {
  const initial = conversation.title ? conversation.title.charAt(0).toUpperCase() : "#";
  const hasTyping = typingUserNames.length > 0;
  const typingText = typingUserNames.length === 1
    ? `${typingUserNames[0]} is typing...`
    : `${typingUserNames.join(", ")} are typing...`;

  return (
    <header className="chatHeader">
      <div className="chatHeaderLeft">
        {onBackMobile && (
          <button
            type="button"
            className="chatBackBtn"
            title="Back to conversations"
            aria-label="Back to conversations"
            onClick={onBackMobile}
          >
            <HiArrowLeft size={18} />
          </button>
        )}

        <div className="chatAvatarWrap" style={{ width: 38, height: 38 }}>
          <div className="chatAvatar" style={{ fontSize: 14 }}>{initial}</div>
          {conversation.isOnline && <span className="chatOnlineDot" aria-label="Online" />}
        </div>

        <div className="chatHeaderInfo">
          <h2 className="chatHeaderTitle">{conversation.title || "Conversation"}</h2>
          <div className="chatHeaderSubtitle">
            {hasTyping ? (
              <span className="chatTypingSubtitle">
                <span className="chatTypingDots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span>{typingText}</span>
              </span>
            ) : conversation.type === "direct" ? (
              conversation.isOnline ? (
                <span className="chatOnlineBadge">
                  <span className="chatOnlineDotInline" aria-hidden="true" />
                  <span>Active now</span>
                </span>
              ) : (
                <span>Offline</span>
              )
            ) : conversation.type === "support" ? (
              <span>Support Desk</span>
            ) : (
              <span>{conversation.participants?.length || 2} members</span>
            )}
          </div>
        </div>
      </div>

      <div className="chatHeaderRight">
        <button
          type="button"
          className={`chatIconBtn ${showDetails ? "active" : ""}`}
          title="Conversation details"
          aria-label="Toggle conversation details"
          aria-expanded={showDetails}
          onClick={onToggleDetails}
        >
          <HiOutlineInformationCircle size={20} />
        </button>
      </div>
    </header>
  );
}
