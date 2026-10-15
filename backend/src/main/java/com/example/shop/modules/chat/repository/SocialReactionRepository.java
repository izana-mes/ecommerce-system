package com.example.shop.modules.chat.repository;

import com.example.shop.modules.chat.entity.SocialReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SocialReactionRepository extends JpaRepository<SocialReaction, String> {

    List<SocialReaction> findByTargetTypeAndTargetId(String targetType, String targetId);

    List<SocialReaction> findByTargetTypeAndTargetIdIn(String targetType, List<String> targetIds);

    Optional<SocialReaction> findByTargetTypeAndTargetIdAndUserId(String targetType, String targetId, String userId);

    void deleteByTargetTypeAndTargetIdAndUserId(String targetType, String targetId, String userId);
}
