package com.example.shop.modules.chatbot.repository;

import com.example.shop.modules.chatbot.entity.ChatbotConversation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface ChatbotConversationRepository extends JpaRepository<ChatbotConversation, String> {

    Optional<ChatbotConversation> findFirstByUserEmailIgnoreCaseOrderByLastMessageAtDesc(String userEmail);

    Optional<ChatbotConversation> findFirstByGuestIdOrderByLastMessageAtDesc(String guestId);

    Optional<ChatbotConversation> findByConversationIdAndOwnerUserIdAndAudience(String conversationId, String ownerUserId, String audience);

    Optional<ChatbotConversation> findByConversationIdAndAudience(String conversationId, String audience);

    List<ChatbotConversation> findTop30ByOwnerUserIdAndAudienceOrderByLastMessageAtDesc(String ownerUserId, String audience);
}
