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
            onClick={onBackMobile}
          >
            <HiArrowLeft size={20} />
          </button>
        )}

        <div className="chatAvatarWrap" style={{ width: 40, height: 40 }}>
          <div className="chatAvatar" style={{ fontSize: 16 }}>{initial}</div>
          {conversation.isOnline && <span className="chatOnlineDot" />}
        </div>

        <div className="chatHeaderInfo">
          <h2 className="chatHeaderTitle">{conversation.title || "Conversation"}</h2>
          <div className="chatHeaderSubtitle">
            {hasTyping ? (
              <span className="chatTypingSubtitle">{typingText}</span>
            ) : (
              <span>
                {conversation.type === "direct"
                  ? conversation.isOnline
                    ? "Online"
                    : "Offline"
                  : conversation.type === "support"
                  ? "Support Desk"
                  : `${conversation.participants?.length || 2} members`}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="chatHeaderRight">
        <button
          type="button"
          className={`chatIconBtn ${showDetails ? "active" : ""}`}
          title="Conversation details"
          onClick={onToggleDetails}
        >
          <HiOutlineInformationCircle size={22} />
        </button>
      </div>
    </header>
  );
}
