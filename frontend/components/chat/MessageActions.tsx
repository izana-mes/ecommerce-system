"use client";

import React, { useState } from "react";
import { HiOutlineFaceSmile, HiOutlinePencilSquare, HiOutlineTrash, HiOutlineClipboardDocument, HiOutlineCheck } from "react-icons/hi2";
import { ReactionPicker } from "./ReactionPicker";
import { ReactionKind } from "@/lib/chat/types";

interface MessageActionsProps {
  isOwn: boolean;
  isDeleted: boolean;
  messageText: string;
  onReact: (reaction: ReactionKind) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function MessageActions({
  isOwn,
  isDeleted,
  messageText,
  onReact,
  onEdit,
  onDelete,
}: MessageActionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!messageText) return;
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="chatMessageActionsWrap">
      {showPicker && (
        <ReactionPicker
          onSelect={(kind) => {
            onReact(kind);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
      <div className="chatMessageActionsBar">
        {!isDeleted && (
          <button
            type="button"
            className="chatActionBtn"
            title="React"
            onClick={() => setShowPicker((prev) => !prev)}
          >
            <HiOutlineFaceSmile size={16} />
          </button>
        )}

        {!isDeleted && (
          <button
            type="button"
            className="chatActionBtn"
            title={copied ? "Copied" : "Copy"}
            onClick={handleCopy}
          >
            {copied ? <HiOutlineCheck size={16} /> : <HiOutlineClipboardDocument size={16} />}
          </button>
        )}

        {isOwn && !isDeleted && onEdit && (
          <button
            type="button"
            className="chatActionBtn"
            title="Edit message"
            onClick={onEdit}
          >
            <HiOutlinePencilSquare size={16} />
          </button>
        )}

        {isOwn && !isDeleted && onDelete && (
          <button
            type="button"
            className="chatActionBtn"
            title="Delete message"
            onClick={onDelete}
          >
            <HiOutlineTrash size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
