"use client";

import React from "react";
import { HiOutlineMagnifyingGlass, HiOutlinePlus, HiOutlineXMark, HiOutlineChatBubbleLeftRight } from "react-icons/hi2";
import { ChatConversation, UserSearchResult } from "@/lib/chat/types";
import { ConversationItem } from "./ConversationItem";

interface ConversationListProps {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onOpenNewChatModal: () => void;
  className?: string;
  loading?: boolean;
  people: UserSearchResult[];
  peopleQuery: string;
  loadingPeople: boolean;
  peopleError?: string | null;
  onPeopleQueryChange: (query: string) => void;
  onSelectPerson: (person: UserSearchResult) => void;
  onRetryPeople: () => void;
}

export function ConversationList({
  conversations,
  activeConversationId,
  searchQuery,
  onSearchChange,
  onSelectConversation,
  onOpenNewChatModal,
  className = "",
  loading = false,
  people,
  peopleQuery,
  loadingPeople,
  peopleError,
  onPeopleQueryChange,
  onSelectPerson,
  onRetryPeople,
}: ConversationListProps) {
  const showingSearchResults = peopleQuery.trim().length > 0;

  return (
    <aside className={`chatSidebar ${className}`} aria-label="Conversations sidebar">
      <div className="chatSidebarHeader">
        <h1 className="chatSidebarTitle">
          Messages
        </h1>
        <button
          type="button"
          className="chatNewChatBtn"
          title="New conversation"
          aria-label="Start new conversation"
          onClick={onOpenNewChatModal}
        >
          <HiOutlinePlus size={18} />
        </button>
      </div>

      <div className="chatSidebarSearchWrap">
        <HiOutlineMagnifyingGlass size={15} className="chatSidebarSearchIcon" aria-hidden="true" />
        <input
          type="text"
          className="chatSidebarSearchInput"
          placeholder="Search people..."
          value={peopleQuery}
          onChange={(e) => onPeopleQueryChange(e.target.value)}
          aria-label="Search people"
        />
        {peopleQuery && (
          <button
            type="button"
            className="chatClearSearchBtn"
            aria-label="Clear search"
            onClick={() => onPeopleQueryChange("")}
          >
            <HiOutlineXMark size={15} />
          </button>
        )}
      </div>

      <div className="chatSidebarList">
        {peopleError ? (
          <div className="chatSidebarState" role="alert">
            <p>{peopleError}</p>
            <button type="button" className="chatBtnSmall" onClick={onRetryPeople}>
              Retry
            </button>
          </div>
        ) : loadingPeople ? (
          <div className="chatSkeletonList" aria-busy="true" aria-label="Loading people">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="chatSkeletonItem">
                <div className="chatSkeleton chatSkeletonAvatar" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
                  <div className="chatSkeleton chatSkeletonLine" style={{ width: "48%" }} />
                  <div className="chatSkeleton chatSkeletonLine" style={{ width: "36%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : people.length > 0 ? (
          <section className="chatPeopleSection" aria-label={showingSearchResults ? "People search results" : "People available to chat"}>
            <div className="chatSidebarSectionTitle">{showingSearchResults ? "People" : "Start a new conversation"}</div>
            {people.map((person) => (
              <button
                key={person.userId}
                type="button"
                className="chatConversationItem chatPersonItem"
                onClick={() => onSelectPerson(person)}
              >
                <div className="chatAvatarWrap">
                  <div className="chatAvatar">
                    {(person.fullName || person.username || person.email || "?").charAt(0).toUpperCase()}
                  </div>
                  {person.isOnline && <span className="chatOnlineDot" aria-label="Online" />}
                </div>
                <div className="chatItemContent">
                  <div className="chatItemTopRow">
                    <span className="chatItemTitle">{person.fullName || person.username || person.email}</span>
                    {person.isOnline && <span className="chatPresenceText">Online</span>}
                  </div>
                  <div className="chatItemBottomRow">
                    <span className="chatItemSnippet">{person.username ? `@${person.username}` : person.email}</span>
                  </div>
                </div>
              </button>
            ))}
          </section>
        ) : showingSearchResults ? (
          <div className="chatSidebarState">No users found.</div>
        ) : (
          <div className="chatSidebarState">
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--chat-ink-subtle)" }}>
              Find someone to chat with.
            </p>
            <button type="button" className="chatBtnSmall primary" onClick={onOpenNewChatModal}>
              Search people
            </button>
          </div>
        )}

        <div className="chatSidebarSectionTitle chatConversationsTitle">Conversations</div>

        {loading ? (
          <div className="chatSkeletonList" aria-busy="true" aria-label="Loading conversations">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="chatSkeletonItem">
                <div className="chatSkeleton chatSkeletonAvatar" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="chatSkeleton chatSkeletonLine" style={{ width: "52%" }} />
                  <div className="chatSkeleton chatSkeletonLine" style={{ width: "78%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="chatEmptyState" style={{ padding: "32px 16px" }}>
            <div className="chatEmptyIconWrap" style={{ width: 44, height: 44, marginBottom: 12 }}>
              <HiOutlineChatBubbleLeftRight size={20} />
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--chat-ink-secondary)" }}>
              {searchQuery ? "No conversations match your search." : "No conversations yet."}
            </p>
            <button
              type="button"
              className="chatBtnSmall primary"
              onClick={onOpenNewChatModal}
            >
              Start a conversation
            </button>
          </div>
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.conversationId}
              conversation={conv}
              isActive={conv.conversationId === activeConversationId}
              onSelect={onSelectConversation}
            />
          ))
        )}
      </div>
    </aside>
  );
}
