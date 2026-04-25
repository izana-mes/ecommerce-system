package com.example.shop.modules.supportchat.repository;

import com.example.shop.modules.supportchat.entity.SupportChatConversation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SupportChatConversationRepository extends JpaRepository<SupportChatConversation, String> {
    Optional<SupportChatConversation> findFirstByCustomerUserIdOrderByLastMessageAtDesc(String customerUserId);
    Optional<SupportChatConversation> findFirstByCustomerEmailIgnoreCaseOrderByLastMessageAtDesc(String customerEmail);
    Optional<SupportChatConversation> findFirstByGuestIdOrderByLastMessageAtDesc(String guestId);
    Page<SupportChatConversation> findAllByOrderByLastMessageAtDesc(Pageable pageable);
}
