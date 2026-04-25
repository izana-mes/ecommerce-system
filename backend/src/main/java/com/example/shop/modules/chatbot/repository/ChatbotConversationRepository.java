package com.example.shop.modules.chatbot.repository;

import com.example.shop.modules.chatbot.entity.ChatbotConversation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ChatbotConversationRepository extends JpaRepository<ChatbotConversation, String> {

    Optional<ChatbotConversation> findFirstByUserEmailIgnoreCaseOrderByLastMessageAtDesc(String userEmail);

    Optional<ChatbotConversation> findFirstByGuestIdOrderByLastMessageAtDesc(String guestId);
}
