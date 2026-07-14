"use client";

import { useMemo, useState } from "react";
import "./social.css";
import type { ReactionKind, ReactionSummary } from "./types";

const REACTIONS: Array<{ kind: ReactionKind; label: string; icon: string }> = [
  { kind: "like", label: "Like", icon: "👍" },
  { kind: "love", label: "Love", icon: "❤️" },
  { kind: "care", label: "Care", icon: "🤗" },
  { kind: "haha", label: "Haha", icon: "😂" },
  { kind: "wow", label: "Wow", icon: "😮" },
  { kind: "sad", label: "Sad", icon: "😢" },
  { kind: "angry", label: "Angry", icon: "😡" },
];

type ReactionPickerProps = {
  targetId: string;
  summary?: ReactionSummary[];
  disabled?: boolean;
  onReact?: (targetId: string, reaction: ReactionKind) => void;
  onShowReactors?: (targetId: string) => void;
};

export function ReactionPicker({ targetId, summary = [], disabled, onReact, onShowReactors }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const mine = summary.find((item) => item.reactedByMe);
  const total = useMemo(() => summary.reduce((sum, item) => sum + item.count, 0), [summary]);
  const visible = summary.filter((item) => item.count > 0).slice(0, 3);

  return (
    <div
      className="socialReactionRoot"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
    >
      {open ? (
        <div className="socialReactionPopup" role="menu" aria-label="Choose reaction">
          {REACTIONS.map((reaction) => (
            <button
              key={reaction.kind}
              className="socialReactionOption"
              type="button"
              disabled={disabled}
              title={reaction.label}
              aria-label={reaction.label}
              onClick={() => {
                onReact?.(targetId, reaction.kind);
                setOpen(false);
              }}
            >
              <span>{reaction.icon}</span>
            </button>
          ))}
        </div>
      ) : null}

      <button
        className={`socialReactionButton ${mine ? "socialReactionButtonActive" : ""}`}
        type="button"
        disabled={disabled}
        onClick={() => onReact?.(targetId, mine?.kind || "like")}
      >
        {mine ? REACTIONS.find((item) => item.kind === mine.kind)?.icon : "👍"}
        <span>{mine ? REACTIONS.find((item) => item.kind === mine.kind)?.label : "Like"}</span>
      </button>

      {total > 0 ? (
        <button className="socialReactionSummary" type="button" onClick={() => onShowReactors?.(targetId)}>
          <span className="socialReactionStack">
            {visible.map((item) => (
              <span key={item.kind}>{REACTIONS.find((reaction) => reaction.kind === item.kind)?.icon}</span>
            ))}
          </span>
          <span>{total}</span>
        </button>
      ) : null}
    </div>
  );
}
