"use client";

import React from "react";
import { SUPPORTED_REACTIONS, ReactionKind } from "@/lib/chat/types";

interface ReactionPickerProps {
  onSelect: (reaction: ReactionKind) => void;
  onClose?: () => void;
  className?: string;
}

export function ReactionPicker({ onSelect, onClose, className = "" }: ReactionPickerProps) {
  return (
    <div className={`chatReactionPickerPopup ${className}`} role="dialog" aria-label="Add reaction">
      {SUPPORTED_REACTIONS.map(({ kind, emoji, label }) => (
        <button
          key={kind}
          type="button"
          className="chatReactionPickerEmojiBtn"
          title={label}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(kind);
            if (onClose) onClose();
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
