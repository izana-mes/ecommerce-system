package com.example.shop.modules.chat.repository;

import com.example.shop.modules.chat.entity.SocialConversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SocialConversationRepository extends JpaRepository<SocialConversation, String> {

    @Query("SELECT c FROM SocialConversation c " +
           "JOIN SocialConversationMember m ON c.conversationId = m.id.conversationId " +
           "WHERE m.id.userId = :userId AND m.deletedAt IS NULL AND c.deletedAt IS NULL " +
           "ORDER BY COALESCE(c.lastMessageAt, c.createdAt) DESC")
    List<SocialConversation> findConversationsForUser(@Param("userId") String userId);

    @Query("SELECT c FROM SocialConversation c " +
           "JOIN SocialConversationMember m1 ON c.conversationId = m1.id.conversationId " +
           "JOIN SocialConversationMember m2 ON c.conversationId = m2.id.conversationId " +
           "WHERE c.type = 'direct' AND c.deletedAt IS NULL " +
           "AND m1.id.userId = :userA AND m2.id.userId = :userB")
    List<SocialConversation> findDirectConversationBetween(@Param("userA") String userA, @Param("userB") String userB);

    Optional<SocialConversation> findByConversationIdAndDeletedAtIsNull(String conversationId);

}
