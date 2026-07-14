export type ReactionKind = "like" | "love" | "care" | "haha" | "wow" | "sad" | "angry";

export type ReactionSummary = {
  kind: ReactionKind;
  count: number;
  reactedByMe?: boolean;
};

export type MentionSuggestion = {
  id: string;
  label: string;
  username: string;
  role: "admin" | "employee" | "shipper" | "customer" | string;
  avatarUrl?: string;
  online?: boolean;
};

export type SocialAttachment = {
  id: string;
  kind: "image" | "video" | "file" | "voice" | "gif";
  name: string;
  url: string;
  contentType?: string;
};

export type SocialMessage = {
  id: string;
  conversationId: string;
  senderName: string;
  senderRole: string;
  senderAvatarUrl?: string;
  body: string;
  createdAt: string;
  editedAt?: string;
  replyTo?: Pick<SocialMessage, "id" | "senderName" | "body">;
  attachments?: SocialAttachment[];
  reactions?: ReactionSummary[];
  readBy?: string[];
  mentionedMe?: boolean;
  delivered?: boolean;
};

export type SocialComment = {
  id: string;
  authorName: string;
  authorRole: string;
  authorAvatarUrl?: string;
  body: string;
  createdAt: string;
  editedAt?: string;
  reactions?: ReactionSummary[];
  attachments?: SocialAttachment[];
  replies?: SocialComment[];
  mentionedMe?: boolean;
};
