package com.example.shop.modules.messaging.email;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailMessage {

    private String to;
    private String subject;
    private String content;
    private EmailType emailType;

    /**
     * Optional context fields used by the consumer
     * to build email content when subject/content are not pre-built.
     */
    private String recipientName;
    private String token;
    private String otp;

    public enum EmailType {
        GENERIC,
        OTP,
        VERIFICATION,
        PASSWORD_RESET
    }
}
