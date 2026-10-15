package com.example.shop.modules.chat.repository;

import com.example.shop.modules.chat.entity.SocialReactionCount;
import com.example.shop.modules.chat.entity.SocialReactionCountId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SocialReactionCountRepository extends JpaRepository<SocialReactionCount, SocialReactionCountId> {

    List<SocialReactionCount> findByIdTargetTypeAndIdTargetId(String targetType, String targetId);

    List<SocialReactionCount> findByIdTargetTypeAndIdTargetIdIn(String targetType, List<String> targetIds);
}
