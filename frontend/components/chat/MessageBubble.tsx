"use client";

import React, { useState } from "react";
import { ChatMessage, REACTION_EMOJIS, ReactionKind } from "@/lib/chat/types";
import { MessageActions } from "./MessageActions";
import { HiOutlineNoSymbol } from "react-icons/hi2";

interface MessageBubbleProps {
  message: ChatMessage;
  currentUserId: string;
  onEdit: (messageId: string, newBody: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onReact: (messageId: string, reaction: ReactionKind) => Promise<void>;
}

export function MessageBubble({
  message,
  currentUserId,
  onEdit,
  onDelete,
  onReact,
}: MessageBubbleProps) {
  const isOwn = String(message.senderUserId) === String(currentUserId);
  const isDeleted = Boolean(message.deleted);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.body || "");
  const [savingEdit, setSavingEdit] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleStartEdit = () => {
    setEditDraft(message.body || "");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditDraft(message.body || "");
  };

  const handleSaveEdit = async () => {
    if (!editDraft.trim() || savingEdit) return;
    setSavingEdit(true);
    setActionError(null);
    try {
      await onEdit(message.messageId, editDraft.trim());
      setIsEditing(false);
    } catch (error) {
      // Keep edit open on failure
      setActionError(error instanceof Error ? error.message : "Unable to save the edit.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const senderInitial = message.senderName ? message.senderName.charAt(0).toUpperCase() : "?";

  return (
    <div className={`chatMessageRow ${isOwn ? "own" : "incoming"}`}>
      {!isOwn && <div className="chatMessageAvatar">{senderInitial}</div>}

      <div className="chatMessageGroup">
        {!isOwn && message.senderName && (
          <div className="chatMessageSender">{message.senderName}</div>
        )}

        <div className="chatBubble">
          {isDeleted ? (
            <div className="chatBubbleDeleted">
              <HiOutlineNoSymbol size={16} />
              <span>Message deleted</span>
            </div>
          ) : isEditing ? (
            <div className="chatInlineEditForm">
              <textarea
                className="chatInlineEditTextarea"
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                autoFocus
              />
              <div className="chatInlineEditButtons">
                <button
                  type="button"
                  className="chatBtnSmall"
                  onClick={handleCancelEdit}
                  disabled={savingEdit}
                >
                  Cancel (Esc)
                </button>
                <button
                  type="button"
                  className="chatBtnSmall primary"
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editDraft.trim()}
                >
                  {savingEdit ? "Saving..." : "Save (Enter)"}
                </button>
              </div>
              {actionError && <div className="chatComposerError" role="alert">{actionError}</div>}
            </div>
          ) : (
            <p className="chatBubbleText">{message.body}</p>
          )}

          <div className="chatBubbleMeta">
            <span>{formattedTime}</span>
            {message.edited && !isDeleted && <span className="chatEditedTag">(edited)</span>}
          </div>
        </div>

        {/* Reaction Pill Counters */}
        {!isDeleted && message.reactions && message.reactions.length > 0 && (
          <div className="chatReactionsRow">
            {message.reactions.map((summary) => (
              <button
                key={summary.reaction}
                type="button"
                className={`chatReactionPill ${summary.reactedByMe ? "reactedByMe" : ""}`}
                title={`${summary.count} reaction${summary.count > 1 ? "s" : ""}`}
                onClick={() => onReact(message.messageId, summary.reaction)}
              >
                <span>{REACTION_EMOJIS[summary.reaction] || summary.reaction}</span>
                <span className="chatReactionCount">{summary.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Action Toolbar on Hover */}
        {!isEditing && (
          <MessageActions
            isOwn={isOwn}
            isDeleted={isDeleted}
            messageText={message.body || ""}
            onReact={(kind) => onReact(message.messageId, kind)}
            onEdit={handleStartEdit}
            onDelete={() => {
              if (window.confirm("Are you sure you want to delete this message?")) {
                onDelete(message.messageId);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
