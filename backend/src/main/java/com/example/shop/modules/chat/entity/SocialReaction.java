package com.example.shop.modules.chat.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "social_reactions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialReaction {

    @Id
    @Column(name = "reaction_id", length = 64, nullable = false)
    private String reactionId;

    @Builder.Default
    @Column(name = "target_type", length = 24, nullable = false)
    private String targetType = "message";

    @Column(name = "target_id", length = 64, nullable = false)
    private String targetId;

    @Column(name = "user_id", length = 64, nullable = false)
    private String userId;

    @Column(name = "reaction", length = 16, nullable = false)
    private String reaction;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Builder.Default
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
}
