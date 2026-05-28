"use client";

import { useMemo, useState } from "react";
import "./social.css";
import { MentionComposer } from "./MentionComposer";
import { ReactionPicker } from "./ReactionPicker";
import type { MentionSuggestion, ReactionKind, SocialMessage } from "./types";

type ConversationPreview = {
  id: string;
  title: string;
  subtitle: string;
  unread: number;
  online?: boolean;
};

type MessengerShellProps = {
  conversations: ConversationPreview[];
  messages: SocialMessage[];
  suggestions: MentionSuggestion[];
  activeConversationId?: string;
  onSelectConversation?: (conversationId: string) => void;
  onSend?: (body: string) => Promise<void> | void;
  onReact?: (messageId: string, reaction: ReactionKind) => void;
};

export function MessengerShell({
  conversations,
  messages,
  suggestions,
  activeConversationId,
  onSelectConversation,
  onSend,
  onReact,
}: MessengerShellProps) {
  const [query, setQuery] = useState("");
  const active = conversations.find((item) => item.id === activeConversationId) || conversations[0];
  const filteredMessages = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return messages;
    return messages.filter((item) => `${item.senderName} ${item.body}`.toLowerCase().includes(normalized));
  }, [messages, query]);

  return (
    <section className="socialMessengerShell">
      <aside className="socialConversationSidebar">
        <header>
          <strong>Inbox</strong>
          <button type="button" title="New group">+</button>
        </header>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search messages" />
        <div className="socialConversationList">
          {conversations.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === active?.id ? "socialConversationActive" : ""}
              onClick={() => onSelectConversation?.(item.id)}
            >
              <span className="socialAvatar">
                {item.title.slice(0, 1)}
                {item.online ? <i /> : null}
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </span>
              {item.unread > 0 ? <em>{item.unread}</em> : null}
            </button>
          ))}
        </div>
      </aside>

      <main className="socialChatPanel">
        <header className="socialChatHeader">
          <div className="socialAvatar">{active?.title.slice(0, 1) || "?"}</div>
          <div>
            <strong>{active?.title || "Conversation"}</strong>
            <span>{active?.online ? "Online" : "Offline"} · Voice/video ready</span>
          </div>
          <button type="button">Pin</button>
        </header>

        <div className="socialMessageList">
          {filteredMessages.map((message) => (
            <article key={message.id} className={`socialMessage ${message.mentionedMe ? "socialMentioned" : ""}`}>
              <div className="socialAvatar">{message.senderName.slice(0, 1)}</div>
              <div className="socialMessageContent">
                <div className="socialMessageMeta">
                  <strong>{message.senderName}</strong>
                  <span>{message.senderRole}</span>
                  <time>{new Date(message.createdAt).toLocaleTimeString()}</time>
                </div>
                {message.replyTo ? (
                  <blockquote>
                    {message.replyTo.senderName}: {message.replyTo.body}
                  </blockquote>
                ) : null}
                <p>{message.body}</p>
                <div className="socialInlineActions">
                  <ReactionPicker targetId={message.id} summary={message.reactions} onReact={(_, reaction) => onReact?.(message.id, reaction)} />
                  <button type="button">Reply</button>
                  <button type="button">Forward</button>
                  <button type="button">Edit</button>
                  <button type="button">Delete</button>
                </div>
                <small className="socialReceipt">{message.readBy?.length ? `Seen by ${message.readBy.join(", ")}` : message.delivered ? "Delivered" : "Sending"}</small>
              </div>
            </article>
          ))}
        </div>

        <MentionComposer suggestions={suggestions} onSubmit={({ body }) => onSend?.(body)} />
      </main>
    </section>
  );
}
