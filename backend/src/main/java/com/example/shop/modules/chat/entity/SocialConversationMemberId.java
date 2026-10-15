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
public class SocialConversationMemberId implements Serializable {

    @Column(name = "conversation_id", length = 64, nullable = false)
    private String conversationId;

    @Column(name = "user_id", length = 64, nullable = false)
    private String userId;
}
