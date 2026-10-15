export type ReactionKind = "like" | "love" | "care" | "haha" | "wow" | "sad" | "angry";

export const REACTION_EMOJIS: Record<ReactionKind, string> = {
  love: "❤️",
  like: "👍",
  haha: "😂",
  wow: "😮",
  sad: "😢",
  angry: "😡",
  care: "🤗",
};

export const COMPOSER_EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎",
  "🤔", "😅", "😢", "😭", "😡", "👍", "👎", "❤️",
  "🔥", "🎉", "🙏", "👏", "💯", "✨", "✅", "📌",
];

export const SUPPORTED_REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "love", emoji: "❤️", label: "Love" },
  { kind: "like", emoji: "👍", label: "Like" },
  { kind: "haha", emoji: "😂", label: "Haha" },
  { kind: "wow", emoji: "😮", label: "Wow" },
  { kind: "sad", emoji: "😢", label: "Sad" },
  { kind: "angry", emoji: "😡", label: "Angry" },
];

export interface ReactionSummary {
  reaction: ReactionKind;
  count: number;
  reactedByMe: boolean;
}

export interface ChatMember {
  userId: string;
  username?: string;
  email?: string;
  fullName?: string;
  role?: string;
  isOnline?: boolean;
  lastSeenAt?: string;
}

export interface ChatMessage {
  messageId: string;
  conversationId: string;
  senderUserId?: string;
  senderName?: string;
  senderRole?: string;
  senderAvatarUrl?: string;
  body?: string | null;
  edited?: boolean;
  editedAt?: string | null;
  deleted?: boolean;
  deletedAt?: string | null;
  replyToMessageId?: string | null;
  reactions?: ReactionSummary[];
  myReaction?: string | null;
  createdAt: string;
}

export interface ChatConversation {
  conversationId: string;
  type: "direct" | "group" | "support" | "order" | string;
  title?: string;
  avatarUrl?: string;
  orderId?: string;
  status?: string;
  lastMessageId?: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  pinned?: boolean;
  isOnline?: boolean;
  participants?: ChatMember[];
  createdAt?: string;
  updatedAt?: string;
}

export type WsEventType =
  | "NEW_MESSAGE"
  | "EDIT_MESSAGE"
  | "DELETE_MESSAGE"
  | "REACTION_UPDATE"
  | "READ_UPDATE"
  | "CONVERSATION_UPDATE";

export interface WsMessageEvent {
  eventType: WsEventType;
  conversationId: string;
  message?: ChatMessage;
  messageId?: string;
  userId?: string;
  conversation?: ChatConversation;
}

export interface TypingEvent {
  conversationId: string;
  userId: string;
  senderName: string;
  typing: boolean;
  eventType: "typing_start" | "typing_stop";
}

export interface UserSearchResult {
  userId: string;
  username?: string;
  email?: string;
  fullName?: string;
  role?: string;
  isOnline?: boolean;
}
