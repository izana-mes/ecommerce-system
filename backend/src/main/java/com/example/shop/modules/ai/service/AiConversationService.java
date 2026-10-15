package com.example.shop.modules.ai.service;

import com.example.shop.modules.ai.dto.AiConversationDto;
import com.example.shop.modules.ai.dto.AiConversationMessageDto;
import com.example.shop.modules.chatbot.entity.ChatbotConversation;
import com.example.shop.modules.chatbot.entity.ChatbotMessage;
import com.example.shop.modules.chatbot.repository.ChatbotConversationRepository;
import com.example.shop.modules.chatbot.repository.ChatbotMessageRepository;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/** Durable, ownership-checked context store.  It stores only user/assistant text, never tool payloads. */
@Service @RequiredArgsConstructor
public class AiConversationService {
    private final ChatbotConversationRepository conversations;
    private final ChatbotMessageRepository messages;

    @Transactional
    public ChatbotConversation open(String requestedId, User user, String audience) {
        LocalDateTime now = LocalDateTime.now();
        if (user != null && user.getId() != null) {
            String owner = user.getId().toString();
            if (requestedId != null && !requestedId.isBlank()) {
                return conversations.findByConversationIdAndOwnerUserIdAndAudience(requestedId, owner, audience)
                        .orElseGet(() -> conversations.save(ChatbotConversation.builder()
                                .conversationId(UUID.randomUUID().toString())
                                .ownerUserId(owner)
                                .userEmail(user.getEmail())
                                .audience(audience)
                                .createdAt(now).updatedAt(now).lastMessageAt(now).build()));
            }
            return conversations.save(ChatbotConversation.builder()
                    .conversationId(UUID.randomUUID().toString())
                    .ownerUserId(owner)
                    .userEmail(user.getEmail())
                    .audience(audience)
                    .createdAt(now).updatedAt(now).lastMessageAt(now).build());
        }

        // Guest / anonymous flow (audience is always CUSTOMER for unauthenticated users)
        String guestAudience = "CUSTOMER";
        if (requestedId != null && !requestedId.isBlank()) {
            return conversations.findByConversationIdAndAudience(requestedId, guestAudience)
                    .filter(c -> c.getOwnerUserId() == null) // Do not allow guests to attach to owned conversations
                    .orElseGet(() -> conversations.save(ChatbotConversation.builder()
                            .conversationId(UUID.randomUUID().toString())
                            .guestId("guest-" + UUID.randomUUID())
                            .audience(guestAudience)
                            .createdAt(now).updatedAt(now).lastMessageAt(now).build()));
        }
        return conversations.save(ChatbotConversation.builder()
                .conversationId(UUID.randomUUID().toString())
                .guestId("guest-" + UUID.randomUUID())
                .audience(guestAudience)
                .createdAt(now).updatedAt(now).lastMessageAt(now).build());
    }

    @Transactional
    public void append(ChatbotConversation conversation, String role, String content) {
        messages.save(ChatbotMessage.builder().messageId(UUID.randomUUID().toString()).conversationId(conversation.getConversationId())
                .messageRole(role).body(content).createdAt(LocalDateTime.now()).build());
        LocalDateTime now = LocalDateTime.now(); conversation.setUpdatedAt(now); conversation.setLastMessageAt(now); conversations.save(conversation);
    }

    @Transactional(readOnly = true)
    public List<Map<String,Object>> context(ChatbotConversation conversation) {
        List<ChatbotMessage> rows = messages.findTop16ByConversationIdOrderByCreatedAtDesc(conversation.getConversationId());
        Collections.reverse(rows);
        return rows.stream().filter(m -> "user".equals(m.getMessageRole()) || "assistant".equals(m.getMessageRole()))
                .map(m -> Map.<String,Object>of("role", m.getMessageRole(), "content", m.getBody())).toList();
    }

    @Transactional(readOnly = true)
    public List<AiConversationDto> list(User user, String audience) {
        requireUser(user);
        return conversations.findTop30ByOwnerUserIdAndAudienceOrderByLastMessageAtDesc(user.getId().toString(), audience).stream()
                .map(c -> new AiConversationDto(c.getConversationId(), c.getAudience(), c.getUpdatedAt(), List.of())).toList();
    }

    @Transactional(readOnly = true)
    public AiConversationDto get(String id, User user, String audience) {
        ChatbotConversation c = owned(id, user, audience);
        return new AiConversationDto(c.getConversationId(), c.getAudience(), c.getUpdatedAt(), messages.findTop16ByConversationIdOrderByCreatedAtDesc(id).stream()
                .sorted(Comparator.comparing(ChatbotMessage::getCreatedAt)).map(m -> new AiConversationMessageDto(m.getMessageId(), m.getMessageRole(), m.getBody(), m.getCreatedAt())).toList());
    }

    @Transactional
    public void delete(String id, User user, String audience) {
        ChatbotConversation c = owned(id, user, audience);
        messages.deleteByConversationId(id);
        conversations.delete(c);
    }
    private ChatbotConversation owned(String id, User user, String audience) { requireUser(user); return conversations.findByConversationIdAndOwnerUserIdAndAudience(id, user.getId().toString(), audience).orElseThrow(() -> new AccessDeniedException("Conversation is unavailable")); }
    private void requireUser(User user) { if (user == null || user.getId() == null) throw new AccessDeniedException("Sign in is required for saved conversations"); }
}
