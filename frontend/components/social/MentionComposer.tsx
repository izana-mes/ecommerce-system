"use client";

import { FormEvent, KeyboardEvent, useMemo, useRef, useState } from "react";
import "./social.css";
import type { MentionSuggestion, SocialAttachment } from "./types";

type MentionComposerProps = {
  placeholder?: string;
  suggestions: MentionSuggestion[];
  disabled?: boolean;
  submitLabel?: string;
  onSubmit: (payload: { body: string; attachments: File[]; mentions: MentionSuggestion[] }) => Promise<void> | void;
};

function extractMentionQuery(value: string) {
  const match = value.match(/(^|\s)@([a-zA-Z0-9_.-]{0,32})$/);
  return match ? match[2].toLowerCase() : null;
}

function uniqueMentions(value: string, suggestions: MentionSuggestion[]) {
  const handles = new Set(Array.from(value.matchAll(/@([a-zA-Z0-9_.-]+)/g)).map((match) => match[1].toLowerCase()));
  return suggestions.filter((item) => handles.has(item.username.toLowerCase()) || handles.has(item.role.toLowerCase()));
}

export function MentionComposer({
  placeholder = "Write a message...",
  suggestions,
  disabled,
  submitLabel = "Send",
  onSubmit,
}: MentionComposerProps) {
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mentionQuery = extractMentionQuery(body);

  const matches = useMemo(() => {
    if (mentionQuery === null) return [];
    return suggestions
      .filter((item) => {
        const haystack = `${item.username} ${item.label} ${item.role}`.toLowerCase();
        return haystack.includes(mentionQuery);
      })
      .slice(0, 8);
  }, [mentionQuery, suggestions]);

  const previews: SocialAttachment[] = attachments.map((file, index) => ({
    id: `${file.name}-${index}`,
    kind: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file",
    name: file.name,
    url: "",
    contentType: file.type,
  }));

  const insertMention = (suggestion: MentionSuggestion) => {
    setBody((current) => current.replace(/(^|\s)@([a-zA-Z0-9_.-]{0,32})$/, `$1@${suggestion.username} `));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = body.trim();
    if ((!trimmed && attachments.length === 0) || sending || disabled) return;
    setSending(true);
    try {
      await onSubmit({ body: trimmed, attachments, mentions: uniqueMentions(trimmed, suggestions) });
      setBody("");
      setAttachments([]);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <form
      className="socialComposer"
      onSubmit={submit}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        setAttachments((current) => [...current, ...Array.from(event.dataTransfer.files)]);
      }}
    >
      {matches.length > 0 ? (
        <div className="socialMentionMenu" role="listbox">
          {matches.map((item) => (
            <button key={item.id} type="button" onClick={() => insertMention(item)}>
              <span className="socialAvatar">{item.label.slice(0, 1).toUpperCase()}</span>
              <span>
                <strong>{item.label}</strong>
                <small>@{item.username} · {item.role}</small>
              </span>
              {item.online ? <i aria-label="online" /> : null}
            </button>
          ))}
        </div>
      ) : null}

      {previews.length > 0 ? (
        <div className="socialAttachmentStrip">
          {previews.map((item, index) => (
            <button
              key={item.id}
              type="button"
              title="Remove attachment"
              onClick={() => setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index))}
            >
              <span>{item.kind}</span>
              <strong>{item.name}</strong>
            </button>
          ))}
        </div>
      ) : null}

      <div className="socialComposerBar">
        <button type="button" title="Attach files" onClick={() => fileInputRef.current?.click()}>
          +
        </button>
        <textarea
          ref={inputRef}
          value={body}
          rows={1}
          disabled={disabled || sending}
          placeholder={placeholder}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="button" title="Emoji" onClick={() => setBody((current) => `${current}🙂`)}>
          🙂
        </button>
        <button type="submit" disabled={disabled || sending || (!body.trim() && attachments.length === 0)}>
          {sending ? "..." : submitLabel}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => setAttachments((current) => [...current, ...Array.from(event.target.files || [])])}
      />
    </form>
  );
}
