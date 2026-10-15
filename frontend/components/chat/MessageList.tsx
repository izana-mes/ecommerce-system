"use client";

import React, { useEffect, useRef, UIEvent } from "react";
import { HiOutlineChatBubbleLeftRight } from "react-icons/hi2";
import { ChatMessage, ReactionKind } from "@/lib/chat/types";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onEditMessage: (messageId: string, newBody: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onReactMessage: (messageId: string, reaction: ReactionKind) => Promise<void>;
}

function formatDateDivider(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return "Today";
  }
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function MessageList({
  messages,
  currentUserId,
  loading,
  hasMore,
  onLoadMore,
  onEditMessage,
  onDeleteMessage,
  onReactMessage,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousScrollHeightRef = useRef<number>(0);
  const isScrolledToBottomRef = useRef<boolean>(true);

  // Auto-scroll to bottom on first load or when messages arrive if previously near bottom
  useEffect(() => {
    if (isScrolledToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    isScrolledToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;

    // Trigger load more when scrolled near the top
    if (el.scrollTop < 60 && hasMore && !loading) {
      previousScrollHeightRef.current = el.scrollHeight;
      onLoadMore();
    }
  };

  // Preserve scroll position when older messages are prepended
  useEffect(() => {
    if (containerRef.current && previousScrollHeightRef.current > 0) {
      const diff = containerRef.current.scrollHeight - previousScrollHeightRef.current;
      containerRef.current.scrollTop += diff;
      previousScrollHeightRef.current = 0;
    }
  }, [messages]);

  // Group messages by date
  const renderedItems: React.ReactNode[] = [];
  let lastDate = "";

  messages.forEach((msg) => {
    const msgDate = formatDateDivider(msg.createdAt);
    if (msgDate !== lastDate) {
      lastDate = msgDate;
      renderedItems.push(
        <div key={`date-${msgDate}-${msg.messageId}`} className="chatDateDivider">
          <span className="chatDateLabel">{msgDate}</span>
        </div>
      );
    }
    renderedItems.push(
      <MessageBubble
        key={msg.messageId}
        message={msg}
        currentUserId={currentUserId}
        onEdit={onEditMessage}
        onDelete={onDeleteMessage}
        onReact={onReactMessage}
      />
    );
  });

  return (
    <div
      ref={containerRef}
      className="chatMessagesArea"
      onScroll={handleScroll}
      role="log"
      aria-live="polite"
    >
      {loading && messages.length > 0 && (
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <span className="chatSendingSpinner" style={{ borderColor: "rgba(0,0,0,0.15)", borderTopColor: "var(--chat-ink)" }} />
        </div>
      )}

      {loading && messages.length === 0 ? (
        <div className="chatSkeletonMessageArea" aria-busy="true" aria-label="Loading messages">
          <div className="chatSkeletonMessageRow incoming">
            <div className="chatSkeleton chatSkeletonAvatar" style={{ width: 30, height: 30 }} />
            <div className="chatSkeleton chatSkeletonBubble" style={{ width: "45%", height: 44 }} />
          </div>
          <div className="chatSkeletonMessageRow own">
            <div className="chatSkeleton chatSkeletonBubble" style={{ width: "38%", height: 40 }} />
          </div>
          <div className="chatSkeletonMessageRow incoming">
            <div className="chatSkeleton chatSkeletonAvatar" style={{ width: 30, height: 30 }} />
            <div className="chatSkeleton chatSkeletonBubble" style={{ width: "55%", height: 58 }} />
          </div>
        </div>
      ) : messages.length === 0 ? (
        <div className="chatEmptyState">
          <div className="chatEmptyIconWrap">
            <HiOutlineChatBubbleLeftRight size={24} />
          </div>
          <h3>No messages yet</h3>
          <p>Send a message below to start this conversation.</p>
        </div>
      ) : (
        renderedItems
      )}

      <div ref={bottomRef} />
    </div>
  );
}
