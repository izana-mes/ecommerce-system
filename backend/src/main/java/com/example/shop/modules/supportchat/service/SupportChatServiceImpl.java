package com.example.shop.modules.supportchat.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.supportchat.dto.ChatMessageDto;
import com.example.shop.modules.supportchat.dto.ConversationSummaryDto;
import com.example.shop.modules.supportchat.dto.SendMessageRequest;
import com.example.shop.modules.supportchat.dto.SupportChatResponseDto;
import com.example.shop.modules.supportchat.dto.UpdateConversationRequest;
import com.example.shop.modules.supportchat.entity.SupportChatConversation;
import com.example.shop.modules.supportchat.entity.SupportChatMessage;
import com.example.shop.modules.supportchat.realtime.SupportChatRealtimePublisher;
import com.example.shop.modules.supportchat.repository.SupportChatConversationRepository;
import com.example.shop.modules.supportchat.repository.SupportChatMessageRepository;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SupportChatServiceImpl implements SupportChatService {

    private final SupportChatConversationRepository conversationRepository;
    private final SupportChatMessageRepository messageRepository;
    private final SupportChatRealtimePublisher realtimePublisher;

    @Override
    @Transactional
    public SupportChatResponseDto getMessages(String requestedConversationId, Object principal, String guestId) {
        User user = (principal instanceof User) ? (User) principal : null;
        
        String conversationId = requestedConversationId;
        if (conversationId == null || conversationId.isEmpty()) {
            SupportChatConversation conv = getOrCreateConversation(user, guestId);
            conversationId = conv.getConversationId();
        }

        if (!hasAccess(conversationId, user, guestId)) {
            throw new BusinessException("Conversation not found", HttpStatus.NOT_FOUND);
        }

        List<ChatMessageDto> messages = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId)
                .stream().map(this::toDto).collect(Collectors.toList());

        return SupportChatResponseDto.builder()
                .conversationId(conversationId)
                .conversation(toSummaryDto(conversationRepository.findById(conversationId).orElseThrow()))
                .messages(messages)
                .build();
    }

    @Override
    @Transactional
    public SupportChatResponseDto sendMessage(SendMessageRequest request, Object principal, String guestId) {
        User user = (principal instanceof User) ? (User) principal : null;

        String messageBody = request.getMessage() != null ? request.getMessage().trim() : "";
        if (messageBody.isEmpty()) {
            throw new BusinessException("Message is required", HttpStatus.BAD_REQUEST);
        }

        String conversationId = request.getConversationId();
        if (conversationId == null || conversationId.isEmpty()) {
            SupportChatConversation conv = getOrCreateConversation(user, guestId);
            conversationId = conv.getConversationId();
        }

        if (!hasAccess(conversationId, user, guestId)) {
            throw new BusinessException("Conversation not found", HttpStatus.NOT_FOUND);
        }

        String senderRole = getSenderRole(user);
        String senderEmail = user != null ? user.getEmail() : null;

        SupportChatMessage message = SupportChatMessage.builder()
                .messageId("msg_" + UUID.randomUUID().toString().replace("-", ""))
                .conversationId(conversationId)
                .senderRole(senderRole)
                .senderEmail(senderEmail)
                .body(messageBody)
                .createdAt(LocalDateTime.now())
                .build();

        messageRepository.save(message);

        SupportChatConversation conv = conversationRepository.findById(conversationId).orElseThrow();
        conv.setUpdatedAt(LocalDateTime.now());
        conv.setLastMessageAt(LocalDateTime.now());
        conversationRepository.save(conv);

        List<ChatMessageDto> messages = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId)
                .stream().map(this::toDto).collect(Collectors.toList());

        SupportChatResponseDto response = SupportChatResponseDto.builder()
                .conversationId(conversationId)
                .conversation(toSummaryDto(conv))
                .messages(messages)
                .build();
        realtimePublisher.publishConversationSnapshot(response);
        realtimePublisher.publishStaffConversationUpdate(response.getConversation());
        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConversationSummaryDto> getConversations(int limit) {
        Page<SupportChatConversation> page = conversationRepository.findAllByOrderByLastMessageAtDesc(PageRequest.of(0, Math.max(1, limit)));
        return page.stream().map(this::toSummaryDto).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public SupportChatResponseDto updateConversation(String conversationId, UpdateConversationRequest request, Object principal) {
        User actor = (principal instanceof User) ? (User) principal : null;
        requireStaffAccess(actor);

        SupportChatConversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new BusinessException("Conversation not found", HttpStatus.NOT_FOUND));

        if (request.getStatus() != null) {
            conversation.setStatus(normalizeStatus(request.getStatus()));
        }
        if (request.getPriority() != null) {
            conversation.setPriority(normalizePriority(request.getPriority()));
        }
        if (request.getInternalNote() != null) {
            conversation.setInternalNote(trimmed(request.getInternalNote()));
        }
        if (Boolean.TRUE.equals(request.getAssignToSelf())) {
            conversation.setAssignedToUserId(actor.getId() == null ? actor.getEmail() : actor.getId().toString());
            conversation.setAssignedToEmail(actor.getEmail());
            if ("open".equals(conversation.getStatus())) {
                conversation.setStatus("in_progress");
            }
        }
        if (Boolean.TRUE.equals(request.getClearAssignment())) {
            conversation.setAssignedToUserId(null);
            conversation.setAssignedToEmail(null);
        }

        conversation.setUpdatedAt(LocalDateTime.now());
        SupportChatConversation saved = conversationRepository.save(conversation);
        List<ChatMessageDto> messages = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId)
                .stream().map(this::toDto).collect(Collectors.toList());

        SupportChatResponseDto response = SupportChatResponseDto.builder()
                .conversationId(conversationId)
                .conversation(toSummaryDto(saved))
                .messages(messages)
                .build();
        realtimePublisher.publishConversationSnapshot(response);
        realtimePublisher.publishStaffConversationUpdate(response.getConversation());
        return response;
    }

    private SupportChatConversation getOrCreateConversation(User user, String guestId) {
        if (user != null) {
            Optional<SupportChatConversation> existing = conversationRepository.findFirstByCustomerUserIdOrderByLastMessageAtDesc(user.getId().toString());
            if (existing.isPresent()) return existing.get();
        } else if (guestId != null && !guestId.trim().isEmpty()) {
            Optional<SupportChatConversation> existing = conversationRepository.findFirstByGuestIdOrderByLastMessageAtDesc(guestId.trim());
            if (existing.isPresent()) return existing.get();
        } else {
            throw new BusinessException("Missing customer identity", HttpStatus.BAD_REQUEST);
        }

        String newId = "conv_" + UUID.randomUUID().toString().replace("-", "");
        SupportChatConversation conv = SupportChatConversation.builder()
                .conversationId(newId)
                .customerUserId(user != null ? user.getId().toString() : null)
                .customerEmail(user != null ? user.getEmail() : null)
                .guestId(guestId)
                .status("open")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .lastMessageAt(LocalDateTime.now())
                .build();

        return conversationRepository.save(conv);
    }

    private boolean hasAccess(String conversationId, User user, String guestId) {
        Optional<SupportChatConversation> opt = conversationRepository.findById(conversationId);
        if (opt.isEmpty()) return false;

        SupportChatConversation conv = opt.get();
        String actorRole = getSenderRole(user);
        if ("employee".equals(actorRole) || "admin".equals(actorRole) || "shipper".equals(actorRole)) return true;

        if (user != null && conv.getCustomerUserId() != null && conv.getCustomerUserId().equals(user.getId().toString())) return true;
        if (user != null && conv.getCustomerEmail() != null && conv.getCustomerEmail().equalsIgnoreCase(user.getEmail())) return true;
        if (guestId != null && conv.getGuestId() != null && conv.getGuestId().equals(guestId.trim())) return true;

        return false;
    }

    private String getSenderRole(User user) {
        if (user == null) return "customer";
        // Use getAuthorities() instead of getRoles().toString() to avoid triggering
        // Lombok @Data toString() on Role which accesses the lazy Role.users collection.
        String r = user.getAuthorities().stream()
                .map(a -> a.getAuthority().toLowerCase())
                .collect(Collectors.joining(","));
        if (r.contains("admin")) return "admin";
        if (r.contains("shipper")) return "shipper";
        if (r.contains("staff") || r.contains("employee")) return "employee";
        return "customer";
    }

    private void requireStaffAccess(User user) {
        String role = getSenderRole(user);
        if (!"employee".equals(role) && !"admin".equals(role) && !"shipper".equals(role)) {
            throw new BusinessException("Access denied", HttpStatus.FORBIDDEN);
        }
    }

    private String normalizeStatus(String value) {
        String normalized = value == null ? "open" : value.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "open", "in_progress", "resolved" -> normalized;
            default -> throw new BusinessException("Unsupported conversation status", HttpStatus.BAD_REQUEST);
        };
    }

    private String normalizePriority(String value) {
        String normalized = value == null ? "normal" : value.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "low", "normal", "high", "urgent" -> normalized;
            default -> throw new BusinessException("Unsupported conversation priority", HttpStatus.BAD_REQUEST);
        };
    }

    private String trimmed(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        return normalized.length() > 2000 ? normalized.substring(0, 2000) : normalized;
    }

    private ChatMessageDto toDto(SupportChatMessage msg) {
        return ChatMessageDto.builder()
                .messageId(msg.getMessageId())
                .conversationId(msg.getConversationId())
                .senderRole(msg.getSenderRole())
                .senderEmail(msg.getSenderEmail())
                .body(msg.getBody())
                .createdAt(msg.getCreatedAt().toString() + "Z")
                .build();
    }

    private ConversationSummaryDto toSummaryDto(SupportChatConversation conv) {
        SupportChatMessage lastMsg = messageRepository.findFirstByConversationIdOrderByCreatedAtDesc(conv.getConversationId());
        String preview = lastMsg != null ? lastMsg.getBody() : "";
        if (preview.length() > 160) preview = preview.substring(0, 160);

        String customerLabel = conv.getCustomerEmail() != null ? conv.getCustomerEmail() : (conv.getGuestId() != null ? conv.getGuestId() : "Guest customer");

        return ConversationSummaryDto.builder()
                .conversationId(conv.getConversationId())
                .customerLabel(customerLabel)
                .status(conv.getStatus())
                .priority(conv.getPriority())
                .assignedToEmail(conv.getAssignedToEmail())
                .assignedToUserId(conv.getAssignedToUserId())
                .internalNote(conv.getInternalNote())
                .createdAt(conv.getCreatedAt().toString() + "Z")
                .lastMessageAt(conv.getLastMessageAt().toString() + "Z")
                .lastMessagePreview(preview)
                .build();
    }
}
