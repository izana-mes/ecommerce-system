"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import "./chat.css";
import { ChatConversation, ChatMessage, ReactionKind, UserSearchResult, WsMessageEvent, TypingEvent } from "@/lib/chat/types";
import {
  fetchConversations,
  fetchMessages,
  sendMessageApi,
  editMessageApi,
  deleteMessageApi,
  toggleReactionApi,
  markAsReadApi,
  createDirectConversation,
  createSupportConversation,
  fetchDiscoverableUsers,
  searchUsersApi,
} from "@/lib/chat/chatApi";
import { useChatSocket } from "@/lib/chat/useChatSocket";
import { HiOutlineChatBubbleLeftRight } from "react-icons/hi2";
import { ConversationList } from "./ConversationList";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";
import { ChatDetails } from "./ChatDetails";
import { NewConversationModal } from "./NewConversationModal";

interface ChatAppProps {
  currentUser: {
    id?: string | number;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  };
  initialConversationId?: string;
}

export function ChatApp({ currentUser, initialConversationId }: ChatAppProps) {
  const currentUserIdStr = String(currentUser.id || "");

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peopleQuery, setPeopleQuery] = useState("");
  const [people, setPeople] = useState<UserSearchResult[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">(initialConversationId ? "chat" : "list");
  const [typingMap, setTypingMap] = useState<Record<string, string>>({});
  const activeConversationIdRef = useRef<string | null>(activeConversationId);
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const filterCurrentUser = useCallback(
    (items: UserSearchResult[]) => items.filter((item) => String(item.userId) !== currentUserIdStr),
    [currentUserIdStr]
  );

  const loadPeople = useCallback(async (query?: string) => {
    setLoadingPeople(true);
    setPeopleError(null);
    try {
      const data = query?.trim() ? await searchUsersApi(query.trim()) : await fetchDiscoverableUsers();
      setPeople(filterCurrentUser(data));
    } catch (error) {
      setPeople([]);
      setPeopleError(error instanceof Error ? error.message : "Unable to load users.");
    } finally {
      setLoadingPeople(false);
    }
  }, [filterCurrentUser]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadPeople(peopleQuery); }, peopleQuery.trim() ? 250 : 0);
    return () => clearTimeout(timer);
  }, [peopleQuery, loadPeople]);

  useEffect(() => {
    const closeDetailsOnTablet = () => {
      if (window.innerWidth < 1280) setShowDetails(false);
    };
    closeDetailsOnTablet();
    window.addEventListener("resize", closeDetailsOnTablet);
    return () => window.removeEventListener("resize", closeDetailsOnTablet);
  }, []);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.conversationId === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const loadConversations = useCallback(async (search?: string) => {
    setConversationError(null);
    try {
      const data = await fetchConversations(search);
      setConversations(data);
      const requestedConversation = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("conversationId")
        : null;
      setActiveConversationId((current) => current ||
        (requestedConversation && data.some((conversation) => conversation.conversationId === requestedConversation)
          ? requestedConversation
          : data[0]?.conversationId ?? null));
    } catch (e) {
      console.error("Failed to load conversations:", e);
      setConversationError(e instanceof Error ? e.message : "Unable to load conversations.");
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const visibleConversations = useMemo(() => {
    const query = peopleQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) =>
      [conversation.title, conversation.lastMessagePreview, ...(conversation.participants || []).flatMap((member) => [member.fullName, member.username, member.email])]
        .some((value) => value?.toLowerCase().includes(query))
    );
  }, [conversations, peopleQuery]);

  const loadMessages = useCallback(async (convId: string, beforeMessageId?: string) => {
    setLoadingMessages(true);
    setMessageError(null);
    try {
      const msgs = await fetchMessages(convId, beforeMessageId, 40);
      // A request for a previously selected conversation must not overwrite the
      // currently visible thread when the user changes chats quickly.
      if (activeConversationIdRef.current !== convId) return;
      if (beforeMessageId) {
        setMessages((prev) => {
          const currentIds = new Set(prev.map((message) => message.messageId));
          return [...msgs.filter((message) => !currentIds.has(message.messageId)), ...prev];
        });
        setHasMoreMessages(msgs.length >= 40);
      } else {
        setMessages(msgs);
        setHasMoreMessages(msgs.length >= 40);
      }
    } catch (e) {
      console.error("Failed to load messages:", e);
      if (activeConversationIdRef.current === convId) {
        setMessageError(e instanceof Error ? e.message : "Unable to load messages.");
      }
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const scheduleMarkRead = useCallback((convId: string) => {
    if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    markReadTimerRef.current = setTimeout(() => {
      markAsReadApi(convId).catch(() => {});
    }, 400);
  }, []);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    loadMessages(activeConversationId);
    setConversations((prev) =>
      prev.map((c) => (c.conversationId === activeConversationId ? { ...c, unreadCount: 0 } : c))
    );
    scheduleMarkRead(activeConversationId);
  }, [activeConversationId, loadMessages, scheduleMarkRead]);

  const handleMessageEvent = useCallback((event: WsMessageEvent) => {
    const viewing = activeConversationIdRef.current;
    if (event.eventType === "NEW_MESSAGE" && event.message) {
      if (event.conversationId === viewing) {
        setMessages((prev) => {
          if (prev.some((m) => m.messageId === event.message!.messageId)) return prev;
          return [...prev, event.message!];
        });
        if (event.message.senderUserId && event.message.senderUserId !== currentUserIdStr) {
          scheduleMarkRead(event.conversationId);
        }
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.conversationId === event.conversationId
            ? {
                ...c,
                lastMessagePreview: event.message!.deleted ? "Message deleted" : event.message!.body || "Message",
                lastMessageAt: event.message!.createdAt,
                unreadCount:
                  event.conversationId === viewing || event.message!.senderUserId === currentUserIdStr
                    ? 0
                    : (c.unreadCount || 0) + 1,
              }
            : c
        )
      );
    } else if (event.eventType === "EDIT_MESSAGE" && event.message) {
      setMessages((prev) =>
        prev.map((m) => (m.messageId === event.message!.messageId ? { ...m, ...event.message } : m))
      );
    } else if (event.eventType === "DELETE_MESSAGE" && event.messageId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === event.messageId ? { ...m, deleted: true, body: null } : m
        )
      );
    } else if (event.eventType === "REACTION_UPDATE" && event.messageId && event.message?.reactions) {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.messageId !== event.messageId) return m;
          const myReaction =
            event.userId === currentUserIdStr ? event.message!.myReaction || null : m.myReaction || null;
          return {
            ...m,
            myReaction,
            reactions: event.message!.reactions!.map((r) => ({
              ...r,
              reactedByMe: r.reaction === myReaction,
            })),
          };
        })
      );
    }
  }, [currentUserIdStr, scheduleMarkRead]);

  const handleTypingEvent = useCallback((event: TypingEvent) => {
    if (event.userId === currentUserIdStr) return;
    setTypingMap((prev) => {
      const next = { ...prev };
      if (event.typing) {
        next[event.userId] = event.senderName;
      } else {
        delete next[event.userId];
      }
      return next;
    });
  }, [currentUserIdStr]);

  useEffect(() => {
    if (Object.keys(typingMap).length === 0) return;
    const timer = setTimeout(() => setTypingMap({}), 3500);
    return () => clearTimeout(timer);
  }, [typingMap]);

  const handleUserConversationEvent = useCallback((event: WsMessageEvent) => {
    if (event.eventType === "CONVERSATION_UPDATE" && event.conversation) {
      const viewing = activeConversationIdRef.current;
      setConversations((prev) => {
        const incoming = {
          ...event.conversation!,
          unreadCount:
            event.conversation!.conversationId === viewing ? 0 : event.conversation!.unreadCount,
        };
        const exists = prev.some((c) => c.conversationId === incoming.conversationId);
        if (exists) {
          return prev
            .map((c) => (c.conversationId === incoming.conversationId ? { ...c, ...incoming } : c))
            .sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
        }
        return [incoming, ...prev];
      });
      if (event.conversation.conversationId === viewing) {
        scheduleMarkRead(event.conversation.conversationId);
      }
    }
  }, [scheduleMarkRead]);

  const { sendTyping } = useChatSocket({
    conversationId: activeConversationId,
    userId: currentUserIdStr,
    onMessageEvent: handleMessageEvent,
    onTypingEvent: handleTypingEvent,
    onUserConversationEvent: handleUserConversationEvent,
  });

  const handleSendMessage = async (text: string) => {
    if (!activeConversationId) return;
    setMessageError(null);
    const sent = await sendMessageApi(activeConversationId, text);
    setMessages((prev) => {
      if (prev.some((m) => m.messageId === sent.messageId)) return prev;
      return [...prev, sent];
    });
    setConversations((prev) =>
      prev.map((c) =>
        c.conversationId === activeConversationId
          ? { ...c, lastMessagePreview: sent.body || "Message", lastMessageAt: sent.createdAt, unreadCount: 0 }
          : c
      )
    );
  };

  const handleEditMessage = async (messageId: string, newBody: string) => {
    try {
      setMessageError(null);
      const updated = await editMessageApi(messageId, newBody);
      setMessages((prev) => prev.map((m) => (m.messageId === messageId ? { ...m, ...updated } : m)));
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Unable to edit message.");
      throw error;
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      setMessageError(null);
      await deleteMessageApi(messageId);
      setMessages((prev) =>
        prev.map((m) => (m.messageId === messageId ? { ...m, deleted: true, body: null } : m))
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.conversationId === activeConversationId && c.lastMessageId === messageId
            ? { ...c, lastMessagePreview: "Message deleted" }
            : c
        )
      );
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Unable to delete message.");
      throw error;
    }
  };

  const handleReactMessage = async (messageId: string, reaction: ReactionKind) => {
    try {
      const updated = await toggleReactionApi(messageId, reaction);
      setMessages((prev) =>
        prev.map((m) => (m.messageId === messageId ? { ...m, ...updated } : m))
      );
    } catch (e) {
      console.error("Failed to toggle reaction:", e);
      setMessageError(e instanceof Error ? e.message : "Unable to update reaction.");
      throw e;
    }
  };

  const handleSelectConversation = (convId: string) => {
    setActiveConversationId(convId);
    setMobileView("chat");
    setTypingMap({});
  };

  const handleStartDirectChat = async (user: UserSearchResult, initialMessage?: string) => {
    setConversationError(null);
    const conv = await createDirectConversation(user.userId, initialMessage?.trim() || undefined);
    setConversations((prev) => {
      if (prev.some((c) => c.conversationId === conv.conversationId)) {
        return prev.map((c) => (c.conversationId === conv.conversationId ? conv : c));
      }
      return [conv, ...prev];
    });
    setActiveConversationId(conv.conversationId);
    setMobileView("chat");
    setPeopleQuery("");
  };

  const handleStartSupportChat = async (initialMessage?: string) => {
    setConversationError(null);
    const conv = await createSupportConversation(initialMessage?.trim() || undefined);
    setConversations((prev) => prev.some((item) => item.conversationId === conv.conversationId)
      ? prev.map((item) => item.conversationId === conv.conversationId ? conv : item)
      : [conv, ...prev]);
    setActiveConversationId(conv.conversationId);
    setMobileView("chat");
  };

  const typingNames = Object.values(typingMap);

  return (
    <div className="chatAppWrapper">
      <div className="chatMainContainer">
        <ConversationList
          className={mobileView === "chat" ? "hiddenOnMobile" : ""}
          conversations={visibleConversations}
          activeConversationId={activeConversationId}
          searchQuery={peopleQuery}
          onSearchChange={setPeopleQuery}
          onSelectConversation={handleSelectConversation}
          onOpenNewChatModal={() => setIsNewChatModalOpen(true)}
          loading={loadingConversations}
          people={people}
          peopleQuery={peopleQuery}
          loadingPeople={loadingPeople}
          peopleError={peopleError}
          onPeopleQueryChange={setPeopleQuery}
          onSelectPerson={(person) => { void handleStartDirectChat(person); }}
          onRetryPeople={() => { void loadPeople(peopleQuery); }}
        />

        <div className={`chatActivePanel ${mobileView === "list" ? "hiddenOnMobile" : ""}`}>
          {activeConversation ? (
            <>
              <ChatHeader
                conversation={activeConversation}
                typingUserNames={typingNames}
                showDetails={showDetails}
                onToggleDetails={() => setShowDetails((prev) => !prev)}
                onBackMobile={() => setMobileView("list")}
              />

              <MessageList
                messages={messages}
                currentUserId={currentUserIdStr}
                loading={loadingMessages}
                hasMore={hasMoreMessages}
                onLoadMore={() => {
                  if (messages.length > 0) {
                    loadMessages(activeConversationId!, messages[0].messageId);
                  }
                }}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                onReactMessage={handleReactMessage}
              />

              {messageError && <div className="chatComposerError" role="alert">{messageError}</div>}

              <MessageComposer
                onSend={handleSendMessage}
                onTyping={(isTyping) => {
                  if (activeConversationId) {
                    sendTyping(activeConversationId, isTyping);
                  }
                }}
              />
            </>
          ) : (
            <div className="chatEmptyState">
              <div className="chatEmptyIconWrap">
                <HiOutlineChatBubbleLeftRight size={24} />
              </div>
              <h3>Select a conversation</h3>
              <p>Choose an existing conversation on the left or begin a new dialogue.</p>
              <button
                type="button"
                className="chatBtnSmall primary"
                style={{ marginTop: 14 }}
                onClick={() => setIsNewChatModalOpen(true)}
              >
                New Conversation
              </button>
            </div>
          )}
        </div>

        {showDetails && activeConversation && (
          <>
            <div
              className="chatDetailsBackdrop"
              onClick={() => setShowDetails(false)}
              aria-hidden="true"
            />
            <ChatDetails
              conversation={activeConversation}
              onClose={() => setShowDetails(false)}
            />
          </>
        )}
      </div>

      <NewConversationModal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onSelectUser={handleStartDirectChat}
        onCreateSupportChat={handleStartSupportChat}
      />
      {conversationError && <div className="chatGlobalError" role="alert">{conversationError}</div>}
    </div>
  );
}
