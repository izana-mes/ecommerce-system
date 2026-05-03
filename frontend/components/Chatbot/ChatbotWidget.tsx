'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './ChatbotWidget.module.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '👋 Hi! I\'m your shopping assistant. I can help with product search, order status, returns, and more. How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load conversationId from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('chatbot_conversation_id');
    if (stored) setConversationId(stored);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when widget opens
  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chatbot/customer/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          conversationId: conversationId ?? undefined,
        }),
        credentials: 'include',
      });

      const data = await res.json();

      if (data.conversationId) {
        setConversationId(data.conversationId);
        localStorage.setItem('chatbot_conversation_id', data.conversationId);
      }

      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: data.answer || data.error || 'Sorry, I couldn\'t understand that. Please try again.',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);

      if (!isOpen) {
        setHasUnread(true);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, something went wrong. Please check your connection and try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, conversationId, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    { label: '📦 My Orders', text: 'Show me my recent orders' },
    { label: '🛍️ Browse Products', text: 'What products do you have?' },
    { label: '↩️ Return Item', text: 'I want to return an item' },
    { label: '❓ Shipping Info', text: 'How does shipping work?' },
  ];

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      {/* Floating bubble button */}
      <button
        id="chatbot-toggle-btn"
        className={`${styles.bubble} ${isOpen ? styles.bubbleOpen : ''}`}
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Open chat assistant"
      >
        {isOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {hasUnread && <span className={styles.badge} />}
          </>
        )}
      </button>

      {/* Chat panel */}
      <div className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`} role="dialog" aria-label="Chat assistant">
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.avatar}>
              <span>AI</span>
              <span className={styles.onlineDot} />
            </div>
            <div>
              <p className={styles.headerTitle}>Shopping Assistant</p>
              <p className={styles.headerSubtitle}>Always here to help</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={() => setIsOpen(false)} aria-label="Close chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Messages */}
        <div className={styles.messages} id="chatbot-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`${styles.msgWrapper} ${msg.role === 'user' ? styles.userWrapper : styles.botWrapper}`}>
              {msg.role === 'assistant' && (
                <div className={styles.botAvatar}>AI</div>
              )}
              <div className={`${styles.bubble2} ${msg.role === 'user' ? styles.userBubble : styles.botBubble}`}>
                <p className={styles.msgText}>{msg.content}</p>
                <span className={styles.msgTime}>{formatTime(msg.timestamp)}</span>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className={`${styles.msgWrapper} ${styles.botWrapper}`}>
              <div className={styles.botAvatar}>AI</div>
              <div className={`${styles.bubble2} ${styles.botBubble} ${styles.typingBubble}`}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick actions */}
        {messages.length <= 2 && !isLoading && (
          <div className={styles.quickActions}>
            {quickActions.map((qa) => (
              <button
                key={qa.label}
                className={styles.quickBtn}
                onClick={() => { setInput(qa.text); setTimeout(sendMessage, 50); }}
              >
                {qa.label}
              </button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className={styles.inputArea}>
          <input
            ref={inputRef}
            id="chatbot-input"
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            disabled={isLoading}
            maxLength={500}
            autoComplete="off"
          />
          <button
            id="chatbot-send-btn"
            className={styles.sendBtn}
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>

        <p className={styles.footer}>Powered by AI · Secured by MCP</p>
      </div>
    </>
  );
}
