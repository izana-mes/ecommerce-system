package com.example.shop.modules.otp.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "otp_verification", indexes = {
                @Index(name = "idx_otp_email", columnList = "email"),
                @Index(name = "idx_otp_expires_at", columnList = "expires_at")
})
@EntityListeners(AuditingEntityListener.class)
public class OtpVerification {

        @Id
        @GeneratedValue(strategy = GenerationType.UUID)
        @Column(name = "otp_verification_id")
        private UUID id;

        @Column(name = "email", nullable = false, length = 150)
        private String email;

        @Column(name = "otp_code", nullable = false, length = 6)
        private String otpCode;

        @Column(name = "is_used")
        @Builder.Default
        private boolean isUsed = false;

        @Column(name = "expires_at", nullable = false)
        private LocalDateTime expiresAt;

        @CreatedDate
        @Column(name = "created_at", updatable = false)
        private LocalDateTime createdAt;

        @LastModifiedDate
        @Column(name = "updated_at")
        private LocalDateTime updatedAt;
}
