package com.example.shop.modules.chat.repository;

import com.example.shop.modules.chat.entity.SocialConversationMember;
import com.example.shop.modules.chat.entity.SocialConversationMemberId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SocialConversationMemberRepository extends JpaRepository<SocialConversationMember, SocialConversationMemberId> {

    List<SocialConversationMember> findByIdConversationIdAndDeletedAtIsNull(String conversationId);

    List<SocialConversationMember> findByIdUserIdAndDeletedAtIsNull(String userId);

    Optional<SocialConversationMember> findByIdConversationIdAndIdUserIdAndDeletedAtIsNull(String conversationId, String userId);

    boolean existsByIdConversationIdAndIdUserIdAndDeletedAtIsNull(String conversationId, String userId);
}
