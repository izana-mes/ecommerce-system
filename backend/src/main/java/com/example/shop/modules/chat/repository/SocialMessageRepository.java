package com.example.shop.modules.chat.repository;

import com.example.shop.modules.chat.entity.SocialMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SocialMessageRepository extends JpaRepository<SocialMessage, String> {

    List<SocialMessage> findByConversationIdOrderByCreatedAtAsc(String conversationId);

    @Query("SELECT m FROM SocialMessage m WHERE m.conversationId = :conversationId ORDER BY m.createdAt DESC")
    List<SocialMessage> findRecentByConversationId(@Param("conversationId") String conversationId, Pageable pageable);

    @Query("SELECT m FROM SocialMessage m WHERE m.conversationId = :conversationId AND m.createdAt < :before ORDER BY m.createdAt DESC")
    List<SocialMessage> findBeforeByConversationId(@Param("conversationId") String conversationId, @Param("before") LocalDateTime before, Pageable pageable);

    Optional<SocialMessage> findFirstByConversationIdOrderByCreatedAtDesc(String conversationId);

    @Query("SELECT COUNT(m) FROM SocialMessage m WHERE m.conversationId = :conversationId AND m.createdAt > :after AND m.deletedForEveryoneAt IS NULL")
    int countUnreadAfter(@Param("conversationId") String conversationId, @Param("after") LocalDateTime after);
}
