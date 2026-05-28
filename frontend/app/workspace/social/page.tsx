"use client";

import { useState } from "react";
import { CommentThread } from "@/components/social/CommentThread";
import { MessengerShell } from "@/components/social/MessengerShell";
import type { MentionSuggestion, ReactionKind, SocialComment, SocialMessage } from "@/components/social/types";

const suggestions: MentionSuggestion[] = [
  { id: "u_admin", label: "Admin Team", username: "admin", role: "admin", online: true },
  { id: "u_employee", label: "Employee Desk", username: "employee", role: "employee", online: true },
  { id: "u_shipper", label: "Shipper Queue", username: "shipper", role: "shipper" },
  { id: "u_john", label: "John Nguyen", username: "shipper_john", role: "shipper", online: true },
];

const initialMessages: SocialMessage[] = [
  {
    id: "msg_1",
    conversationId: "conv_1",
    senderName: "Customer Lan",
    senderRole: "customer",
    body: "My order is delayed. Can @employee help check it?",
    createdAt: new Date(Date.now() - 8 * 60000).toISOString(),
    reactions: [{ kind: "like", count: 1 }],
    delivered: true,
  },
  {
    id: "msg_2",
    conversationId: "conv_1",
    senderName: "Admin Minh",
    senderRole: "admin",
    body: "@shipper_john please handle this order urgently.",
    createdAt: new Date(Date.now() - 4 * 60000).toISOString(),
    mentionedMe: true,
    reactions: [{ kind: "care", count: 2, reactedByMe: true }],
    readBy: ["John"],
  },
];

const initialComments: SocialComment[] = [
  {
    id: "c_1",
    authorName: "Mai Tran",
    authorRole: "customer",
    body: "The package arrived with a torn corner, but the product is fine.",
    createdAt: new Date(Date.now() - 60 * 60000).toISOString(),
    reactions: [{ kind: "like", count: 4 }],
    replies: [
      {
        id: "c_2",
        authorName: "Support Agent",
        authorRole: "employee",
        body: "@admin I created a carrier feedback case for this.",
        createdAt: new Date(Date.now() - 42 * 60000).toISOString(),
        mentionedMe: true,
        reactions: [{ kind: "love", count: 1 }],
      },
    ],
  },
];

export default function SocialWorkspacePage() {
  const [messages, setMessages] = useState(initialMessages);
  const [comments, setComments] = useState(initialComments);

  const reactMessage = (messageId: string, reaction: ReactionKind) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, reactions: [{ kind: reaction, count: 1, reactedByMe: true }] }
          : message
      )
    );
  };

  const reactComment = (commentId: string, reaction: ReactionKind) => {
    const update = (items: SocialComment[]): SocialComment[] =>
      items.map((comment) =>
        comment.id === commentId
          ? { ...comment, reactions: [{ kind: reaction, count: 1, reactedByMe: true }] }
          : { ...comment, replies: comment.replies ? update(comment.replies) : undefined }
      );
    setComments(update);
  };

  return (
    <main style={{ padding: 24, display: "grid", gap: 24 }}>
      <MessengerShell
        activeConversationId="conv_1"
        conversations={[
          { id: "conv_1", title: "Order Support", subtitle: "Urgent delivery workflow", unread: 2, online: true },
          { id: "conv_2", title: "Employee Group", subtitle: "Internal coordination", unread: 0 },
        ]}
        messages={messages}
        suggestions={suggestions}
        onReact={reactMessage}
        onSend={async (body) => {
          setMessages((current) => [
            ...current,
            {
              id: `msg_${Date.now()}`,
              conversationId: "conv_1",
              senderName: "You",
              senderRole: "employee",
              body,
              createdAt: new Date().toISOString(),
              delivered: false,
            },
          ]);
        }}
      />

      <CommentThread
        comments={comments}
        suggestions={suggestions}
        onReact={reactComment}
        onReply={async (parentCommentId, body) => {
          const reply: SocialComment = {
            id: `c_${Date.now()}`,
            authorName: "You",
            authorRole: "employee",
            body,
            createdAt: new Date().toISOString(),
          };
          if (!parentCommentId) {
            setComments((current) => [reply, ...current]);
            return;
          }
          setComments((current) =>
            current.map((comment) =>
              comment.id === parentCommentId
                ? { ...comment, replies: [...(comment.replies || []), reply] }
                : comment
            )
          );
        }}
      />
    </main>
  );
}
