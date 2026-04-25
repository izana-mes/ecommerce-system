package com.example.shop.modules.supportchat.repository;

import com.example.shop.modules.supportchat.entity.SupportChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SupportChatMessageRepository extends JpaRepository<SupportChatMessage, String> {
    List<SupportChatMessage> findByConversationIdOrderByCreatedAtAsc(String conversationId);
    SupportChatMessage findFirstByConversationIdOrderByCreatedAtDesc(String conversationId);
}
