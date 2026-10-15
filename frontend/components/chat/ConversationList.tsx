"use client";

import React from "react";
import { HiOutlineMagnifyingGlass, HiOutlinePlus, HiOutlineXMark } from "react-icons/hi2";
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
    <aside className={`chatSidebar ${className}`}>
      <div className="chatSidebarHeader">
        <h1 className="chatSidebarTitle">
          Messages
        </h1>
        <button
          type="button"
          className="chatNewChatBtn"
          title="New conversation"
          onClick={onOpenNewChatModal}
        >
          <HiOutlinePlus size={20} />
        </button>
      </div>

      <div className="chatSidebarSearchWrap">
        <HiOutlineMagnifyingGlass size={16} className="chatSidebarSearchIcon" />
        <input
          type="text"
          className="chatSidebarSearchInput"
          placeholder="Search people..."
          value={peopleQuery}
          onChange={(e) => onPeopleQueryChange(e.target.value)}
          aria-label="Search people"
        />
        {peopleQuery && <button type="button" className="chatClearSearchBtn" aria-label="Clear people search" onClick={() => onPeopleQueryChange("")}><HiOutlineXMark size={16} /></button>}
      </div>

      <div className="chatSidebarList">
        {peopleError ? (
          <div className="chatSidebarState" role="alert"><p>{peopleError}</p><button type="button" className="chatBtnSmall" onClick={onRetryPeople}>Retry</button></div>
        ) : loadingPeople ? (
          <div className="chatSidebarState" aria-live="polite">Loading people…</div>
        ) : people.length > 0 ? (
          <section className="chatPeopleSection" aria-label={showingSearchResults ? "People search results" : "People available to chat"}>
            <div className="chatSidebarSectionTitle">{showingSearchResults ? "People" : "Start a new conversation"}</div>
            {people.map((person) => (
              <button key={person.userId} type="button" className="chatConversationItem chatPersonItem" onClick={() => onSelectPerson(person)}>
                <div className="chatAvatarWrap"><div className="chatAvatar">{(person.fullName || person.username || person.email || "?").charAt(0).toUpperCase()}</div>{person.isOnline && <span className="chatOnlineDot" />}</div>
                <div className="chatItemContent"><div className="chatItemTopRow"><span className="chatItemTitle">{person.fullName || person.username || person.email}</span>{person.isOnline && <span className="chatPresenceText">Online</span>}</div><div className="chatItemBottomRow"><span className="chatItemSnippet">{person.username ? `@${person.username}` : person.email}</span></div></div>
              </button>
            ))}
          </section>
        ) : showingSearchResults ? (
          <div className="chatSidebarState">No users found.</div>
        ) : (
          <div className="chatSidebarState"><p>Find someone to chat with.</p><button type="button" className="chatBtnSmall primary" onClick={onOpenNewChatModal}>Search people</button></div>
        )}

        <div className="chatSidebarSectionTitle chatConversationsTitle">Conversations</div>
        {loading ? (
          <div className="chatSidebarState">
            Loading conversations...
          </div>
        ) : conversations.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--chat-text-muted)" }}>
            <p style={{ margin: "0 0 10px", fontSize: 14 }}>
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
