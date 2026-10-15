package com.example.shop.modules.chat.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SocialReactionCountId implements Serializable {

    @Column(name = "target_type", length = 24, nullable = false)
    private String targetType;

    @Column(name = "target_id", length = 64, nullable = false)
    private String targetId;

    @Column(name = "reaction", length = 16, nullable = false)
    private String reaction;
}
