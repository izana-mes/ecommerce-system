package com.example.shop.modules.chatbot.repository;

import com.example.shop.modules.chatbot.entity.ChatbotMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatbotMessageRepository extends JpaRepository<ChatbotMessage, String> {

    List<ChatbotMessage> findTop8ByConversationIdOrderByCreatedAtDesc(String conversationId);

    List<ChatbotMessage> findTop16ByConversationIdOrderByCreatedAtDesc(String conversationId);

    void deleteByConversationId(String conversationId);
}
