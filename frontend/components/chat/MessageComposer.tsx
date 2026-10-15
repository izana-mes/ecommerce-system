"use client";

import React, { useState, useRef, useEffect, ChangeEvent, KeyboardEvent } from "react";
import { HiOutlineFaceSmile, HiOutlinePaperClip, HiPaperAirplane } from "react-icons/hi2";
import { COMPOSER_EMOJIS } from "@/lib/chat/types";

interface MessageComposerProps {
  onSend: (text: string) => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageComposer({
  onSend,
  onTyping,
  disabled = false,
  placeholder = "Type a message...",
}: MessageComposerProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [draft]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  const emitTyping = (isTyping: boolean) => {
    if (!onTyping) return;
    const now = Date.now();
    if (isTyping && now - lastTypingSentRef.current < 1200) {
      return;
    }
    lastTypingSentRef.current = now;
    onTyping(isTyping);
  };

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDraft(val);
    setError(null);

    if (onTyping && val.trim().length > 0) {
      emitTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending || disabled) return;

    setSending(true);
    setError(null);
    if (onTyping) onTyping(false);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    try {
      await onSend(text);
      setDraft("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chatComposerWrap">
      {error ? <div className="chatComposerError">{error}</div> : null}
      <div className={`chatComposerForm ${error ? "hasError" : ""}`}>
        <div style={{ position: "relative" }}>
          {showEmojiPicker && (
            <div className="chatComposerEmojiGrid" role="dialog" aria-label="Emoji picker">
              {COMPOSER_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="chatReactionPickerEmojiBtn"
                  onClick={() => {
                    setDraft((prev) => prev + emoji);
                    setShowEmojiPicker(false);
                    textareaRef.current?.focus();
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="chatComposerBtn"
            title="Add emoji"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            disabled={disabled || sending}
          >
            <HiOutlineFaceSmile size={22} />
          </button>
        </div>

        <button
          type="button"
          className="chatComposerBtn"
          title="Attachments coming soon"
          disabled
        >
          <HiOutlinePaperClip size={20} />
        </button>

        <textarea
          ref={textareaRef}
          className="chatComposerTextarea"
          value={draft}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled || sending}
        />

        <button
          type="button"
          className="chatComposerBtn chatComposerSendBtn"
          onClick={handleSend}
          disabled={disabled || sending || draft.trim().length === 0}
          title="Send (Enter)"
        >
          <span>{sending ? "Sending" : "Send"}</span>
          <HiPaperAirplane size={16} />
        </button>
      </div>
      <div className="chatComposerHint">
        <span>Enter to send, Shift + Enter for new line</span>
        {draft.length > 3000 && <span>{4000 - draft.length} chars left</span>}
      </div>
    </div>
  );
}
