package com.example.shop.modules.messaging.audit;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditEvent {

    private String eventType;
    private String entityType;
    private String entityId;
    private String actor;

    @Builder.Default
    private Map<String, Object> details = new HashMap<>();

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
