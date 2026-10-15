package com.example.shop.modules.chat.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.chat.dto.*;
import com.example.shop.modules.chat.entity.*;
import com.example.shop.modules.chat.realtime.ChatRealtimePublisher;
import com.example.shop.modules.chat.repository.*;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatServiceImpl implements ChatService {

    private final SocialConversationRepository conversationRepository;
    private final SocialConversationMemberRepository memberRepository;
    private final SocialMessageRepository messageRepository;
    private final SocialReactionRepository reactionRepository;
    private final SocialReactionCountRepository reactionCountRepository;
    private final UserRepository userRepository;
    private final ChatRealtimePublisher realtimePublisher;

    private static final Set<String> VALID_REACTIONS = Set.of("like", "love", "care", "haha", "wow", "sad", "angry");

    @Override
    @Transactional(readOnly = true)
    public List<ConversationDto> getConversations(User currentUser, String search) {
        String userId = currentUser.getId().toString();
        List<SocialConversation> conversations = conversationRepository.findConversationsForUser(userId);
        return conversations.stream()
                .map(c -> toConversationDto(c, userId, search))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ConversationDto getConversation(String conversationId, User currentUser) {
        String userId = currentUser.getId().toString();
        assertAccess(conversationId, currentUser);
        SocialConversation conv = conversationRepository.findByConversationIdAndDeletedAtIsNull(conversationId)
                .orElseThrow(() -> new BusinessException("Conversation not found", HttpStatus.NOT_FOUND));
        return toConversationDto(conv, userId, null);
    }

    @Override
    @Transactional
    public ConversationDto createOrGetDirectConversation(User currentUser, String targetUserId, String initialMessage) {
        String userId = currentUser.getId().toString();
        if (userId.equals(targetUserId)) {
            throw new BusinessException("Cannot start conversation with yourself", HttpStatus.BAD_REQUEST);
        }

        UUID targetId = parseUserId(targetUserId);
        User targetUser = userRepository.findById(targetId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        List<SocialConversation> existing = conversationRepository.findDirectConversationBetween(userId, targetUserId);
        if (!existing.isEmpty()) {
            SocialConversation conv = existing.get(0);
            if (initialMessage != null && !initialMessage.trim().isEmpty()) {
                sendMessage(conv.getConversationId(), currentUser, SendMessageRequest.builder().body(initialMessage.trim()).build());
            }
            return toConversationDto(conv, userId, null);
        }

        String convId = "conv_" + UUID.randomUUID().toString().replace("-", "");
        SocialConversation conv = SocialConversation.builder()
                .conversationId(convId)
                .type("direct")
                .createdByUserId(userId)
                .status("active")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .lastMessageAt(LocalDateTime.now())
                .build();
        conversationRepository.save(conv);

        addMember(convId, userId, "member");
        addMember(convId, targetUserId, "member");

        if (initialMessage != null && !initialMessage.trim().isEmpty()) {
            sendMessage(convId, currentUser, SendMessageRequest.builder().body(initialMessage.trim()).build());
        }

        ConversationDto dto = toConversationDto(conv, userId, null);
        realtimePublisher.publishConversationUpdate(targetUserId, toConversationDto(conv, targetUserId, null));
        return dto;
    }

    @Override
    @Transactional
    public ConversationDto createGroupConversation(User currentUser, CreateConversationRequest request) {
        String userId = currentUser.getId().toString();
        Set<String> memberIds = new LinkedHashSet<>();
        if (request.getMemberIds() != null) {
            for (String memberId : request.getMemberIds()) {
                if (memberId == null || memberId.isBlank() || userId.equals(memberId)) {
                    continue;
                }
                UUID parsedMemberId = parseUserId(memberId);
                if (!userRepository.existsById(parsedMemberId)) {
                    throw new BusinessException("User not found", HttpStatus.NOT_FOUND);
                }
                memberIds.add(parsedMemberId.toString());
            }
        }

        String convId = "conv_" + UUID.randomUUID().toString().replace("-", "");
        String title = request.getTitle() != null && !request.getTitle().trim().isEmpty()
                ? request.getTitle().trim()
                : "Group Chat";

        SocialConversation conv = SocialConversation.builder()
                .conversationId(convId)
                .type("group")
                .title(title)
                .createdByUserId(userId)
                .status("active")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .lastMessageAt(LocalDateTime.now())
                .build();
        conversationRepository.save(conv);

        addMember(convId, userId, "admin");
        for (String memberId : memberIds) {
            addMember(convId, memberId, "member");
            realtimePublisher.publishConversationUpdate(memberId, toConversationDto(conv, memberId, null));
        }

        if (request.getInitialMessage() != null && !request.getInitialMessage().trim().isEmpty()) {
            sendMessage(convId, currentUser, SendMessageRequest.builder().body(request.getInitialMessage().trim()).build());
        }

        return toConversationDto(conv, userId, null);
    }

    @Override
    @Transactional
    public ConversationDto createSupportConversation(User currentUser, String initialMessage) {
        String userId = currentUser.getId().toString();
        String convId = "conv_supp_" + UUID.randomUUID().toString().replace("-", "");

        SocialConversation conv = SocialConversation.builder()
                .conversationId(convId)
                .type("support")
                .title("Customer Support")
                .createdByUserId(userId)
                .status("open")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .lastMessageAt(LocalDateTime.now())
                .build();
        conversationRepository.save(conv);

        addMember(convId, userId, "customer");

        if (initialMessage != null && !initialMessage.trim().isEmpty()) {
            sendMessage(convId, currentUser, SendMessageRequest.builder().body(initialMessage.trim()).build());
        }

        return toConversationDto(conv, userId, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MessageDto> getMessages(String conversationId, User currentUser, String beforeMessageId, int limit) {
        String userId = currentUser.getId().toString();
        assertAccess(conversationId, currentUser);

        int pageSize = Math.min(Math.max(limit, 1), 100);
        List<SocialMessage> messages;
        if (beforeMessageId != null && !beforeMessageId.isBlank()) {
            SocialMessage before = messageRepository.findById(beforeMessageId).orElse(null);
            if (before != null) {
                messages = messageRepository.findBeforeByConversationId(
                        conversationId, before.getCreatedAt(), PageRequest.of(0, pageSize));
            } else {
                messages = messageRepository.findRecentByConversationId(conversationId, PageRequest.of(0, pageSize));
            }
        } else {
            messages = messageRepository.findRecentByConversationId(conversationId, PageRequest.of(0, pageSize));
        }

        List<SocialMessage> chronological = new ArrayList<>(messages);
        Collections.reverse(chronological);

        List<String> messageIds = chronological.stream().map(SocialMessage::getMessageId).collect(Collectors.toList());
        Map<String, List<SocialReaction>> reactionsMap = new HashMap<>();
        Map<String, List<SocialReactionCount>> countsMap = new HashMap<>();
        if (!messageIds.isEmpty()) {
            reactionRepository.findByTargetTypeAndTargetIdIn("message", messageIds)
                    .forEach(r -> reactionsMap.computeIfAbsent(r.getTargetId(), k -> new ArrayList<>()).add(r));
            reactionCountRepository.findByIdTargetTypeAndIdTargetIdIn("message", messageIds)
                    .forEach(rc -> countsMap.computeIfAbsent(rc.getId().getTargetId(), k -> new ArrayList<>()).add(rc));
        }

        return chronological.stream()
                .map(m -> toMessageDto(m, userId, reactionsMap.getOrDefault(m.getMessageId(), List.of()),
                        countsMap.getOrDefault(m.getMessageId(), List.of())))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public MessageDto sendMessage(String conversationId, User currentUser, SendMessageRequest request) {
        String userId = currentUser.getId().toString();
        assertAccess(conversationId, currentUser);

        String body = request.getBody() != null ? request.getBody().trim() : "";
        if (body.isEmpty()) {
            throw new BusinessException("Message body cannot be empty", HttpStatus.BAD_REQUEST);
        }
        if (body.length() > 4000) {
            throw new BusinessException("Message body cannot exceed 4000 characters", HttpStatus.BAD_REQUEST);
        }

        String msgId = "msg_" + UUID.randomUUID().toString().replace("-", "");
        String role = getSenderRole(currentUser);

        SocialMessage msg = SocialMessage.builder()
                .messageId(msgId)
                .conversationId(conversationId)
                .senderUserId(userId)
                .senderRole(role)
                .body(body)
                .replyToMessageId(request.getReplyToMessageId())
                .createdAt(LocalDateTime.now())
                .build();
        messageRepository.save(msg);

        conversationRepository.findById(conversationId).ifPresent(c -> {
            c.setLastMessageId(msgId);
            c.setLastMessageAt(msg.getCreatedAt());
            c.setUpdatedAt(LocalDateTime.now());
            conversationRepository.save(c);
        });

        // Increment unread for all other members
        memberRepository.findByIdConversationIdAndDeletedAtIsNull(conversationId).forEach(m -> {
            if (!m.getId().getUserId().equals(userId)) {
                int currentUnread = m.getMessageUnreadCount() == null ? 0 : m.getMessageUnreadCount();
                m.setMessageUnreadCount(currentUnread + 1);
                memberRepository.save(m);
                realtimePublisher.publishConversationUpdate(m.getId().getUserId(), toConversationDto(
                        conversationRepository.findById(conversationId).orElse(null), m.getId().getUserId(), null));
            }
        });

        MessageDto dto = toMessageDto(msg, userId, List.of(), List.of());
        realtimePublisher.publishNewMessage(conversationId, dto);
        return dto;
    }

    @Override
    @Transactional
    public MessageDto editMessage(String messageId, User currentUser, EditMessageRequest request) {
        String userId = currentUser.getId().toString();
        SocialMessage msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new BusinessException("Message not found", HttpStatus.NOT_FOUND));

        assertAccess(msg.getConversationId(), currentUser);
        if (!userId.equals(msg.getSenderUserId())) {
            throw new BusinessException("You can only edit your own messages", HttpStatus.FORBIDDEN);
        }
        if (msg.getDeletedForEveryoneAt() != null) {
            throw new BusinessException("Cannot edit a deleted message", HttpStatus.BAD_REQUEST);
        }

        String body = request.getBody() != null ? request.getBody().trim() : "";
        if (body.isEmpty()) {
            throw new BusinessException("Message body cannot be empty", HttpStatus.BAD_REQUEST);
        }
        if (body.length() > 4000) {
            throw new BusinessException("Message body cannot exceed 4000 characters", HttpStatus.BAD_REQUEST);
        }

        msg.setBody(body);
        msg.setEditedAt(LocalDateTime.now());
        messageRepository.save(msg);

        List<SocialReaction> reactions = reactionRepository.findByTargetTypeAndTargetId("message", messageId);
        List<SocialReactionCount> counts = reactionCountRepository.findByIdTargetTypeAndIdTargetId("message", messageId);
        MessageDto dto = toMessageDto(msg, userId, reactions, counts);
        realtimePublisher.publishEditMessage(msg.getConversationId(), dto);
        return dto;
    }

    @Override
    @Transactional
    public void deleteMessage(String messageId, User currentUser) {
        String userId = currentUser.getId().toString();
        SocialMessage msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new BusinessException("Message not found", HttpStatus.NOT_FOUND));

        assertAccess(msg.getConversationId(), currentUser);
        if (!userId.equals(msg.getSenderUserId())) {
            throw new BusinessException("You can only delete your own messages", HttpStatus.FORBIDDEN);
        }

        msg.setDeletedForEveryoneAt(LocalDateTime.now());
        msg.setBody(null);
        messageRepository.save(msg);

        realtimePublisher.publishDeleteMessage(msg.getConversationId(), messageId);
    }

    @Override
    @Transactional
    public MessageDto toggleReaction(String messageId, User currentUser, String reaction) {
        String userId = currentUser.getId().toString();
        SocialMessage msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new BusinessException("Message not found", HttpStatus.NOT_FOUND));

        assertAccess(msg.getConversationId(), currentUser);
        if (msg.getDeletedForEveryoneAt() != null) {
            throw new BusinessException("Cannot react to a deleted message", HttpStatus.BAD_REQUEST);
        }

        String normalized = reaction != null ? reaction.trim().toLowerCase() : "";
        if (!VALID_REACTIONS.contains(normalized)) {
            throw new BusinessException("Invalid reaction: " + reaction, HttpStatus.BAD_REQUEST);
        }

        Optional<SocialReaction> existing = reactionRepository.findByTargetTypeAndTargetIdAndUserId("message", messageId, userId);
        if (existing.isPresent()) {
            String existingReaction = existing.get().getReaction();
            reactionRepository.delete(existing.get());
            decrementCount("message", messageId, existingReaction);
            if (!existingReaction.equals(normalized)) {
                addReaction(messageId, userId, normalized);
                incrementCount("message", messageId, normalized);
            }
        } else {
            addReaction(messageId, userId, normalized);
            incrementCount("message", messageId, normalized);
        }

        List<SocialReaction> allReactions = reactionRepository.findByTargetTypeAndTargetId("message", messageId);
        List<SocialReactionCount> allCounts = reactionCountRepository.findByIdTargetTypeAndIdTargetId("message", messageId);
        List<ReactionSummaryDto> summaries = buildPublicReactionSummaries(allReactions, allCounts);
        String actorReaction = allReactions.stream()
                .filter(r -> userId.equals(r.getUserId()))
                .map(SocialReaction::getReaction)
                .findFirst()
                .orElse(null);
        realtimePublisher.publishReactionUpdate(msg.getConversationId(), messageId, userId, actorReaction, summaries);
        return toMessageDto(msg, userId, allReactions, allCounts);
    }

    @Override
    @Transactional
    public void removeReaction(String messageId, User currentUser, String reaction) {
        String userId = currentUser.getId().toString();
        SocialMessage msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new BusinessException("Message not found", HttpStatus.NOT_FOUND));

        assertAccess(msg.getConversationId(), currentUser);
        Optional<SocialReaction> existing = reactionRepository.findByTargetTypeAndTargetIdAndUserId("message", messageId, userId);
        if (existing.isPresent() && existing.get().getReaction().equalsIgnoreCase(reaction)) {
            reactionRepository.delete(existing.get());
            decrementCount("message", messageId, existing.get().getReaction());

            List<SocialReaction> allReactions = reactionRepository.findByTargetTypeAndTargetId("message", messageId);
            List<SocialReactionCount> allCounts = reactionCountRepository.findByIdTargetTypeAndIdTargetId("message", messageId);
            List<ReactionSummaryDto> summaries = buildPublicReactionSummaries(allReactions, allCounts);
            realtimePublisher.publishReactionUpdate(msg.getConversationId(), messageId, userId, null, summaries);
        }
    }

    @Override
    @Transactional
    public void markAsRead(String conversationId, User currentUser) {
        String userId = currentUser.getId().toString();
        assertAccess(conversationId, currentUser);

        memberRepository.findByIdConversationIdAndIdUserIdAndDeletedAtIsNull(conversationId, userId).ifPresent(m -> {
            String latestMessageId = messageRepository.findFirstByConversationIdOrderByCreatedAtDesc(conversationId)
                    .map(SocialMessage::getMessageId)
                    .orElse(null);
            int unread = m.getMessageUnreadCount() == null ? 0 : m.getMessageUnreadCount();
            boolean alreadyCaughtUp = unread == 0
                    && ((latestMessageId == null && m.getLastReadMessageId() == null)
                    || (latestMessageId != null && latestMessageId.equals(m.getLastReadMessageId())));
            if (alreadyCaughtUp) {
                return;
            }
            m.setLastReadAt(LocalDateTime.now());
            m.setMessageUnreadCount(0);
            m.setMentionUnreadCount(0);
            m.setLastReadMessageId(latestMessageId);
            memberRepository.save(m);
            realtimePublisher.publishReadUpdate(conversationId, userId);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserSearchResultDto> searchUsers(User currentUser, String query, int limit) {
        String q = query != null ? query.trim() : "";
        if (q.length() < 1) {
            return Collections.emptyList();
        }

        int pageSize = Math.min(Math.max(limit, 1), 50);
        List<User> users = userRepository.searchUsers(q, PageRequest.of(0, pageSize));
        String currentUserId = currentUser.getId().toString();

        return users.stream()
                .filter(u -> !u.getId().toString().equals(currentUserId))
                .map(u -> {
                    String fullName = ((u.getFirstName() != null ? u.getFirstName() : "") + " "
                            + (u.getLastName() != null ? u.getLastName() : "")).trim();
                    String role = getSenderRole(u);
                    return UserSearchResultDto.builder()
                            .userId(u.getId().toString())
                            .username(u.getUsername())
                            .email(u.getEmail())
                            .fullName(fullName.isEmpty() ? u.getEmail() : fullName)
                            .role(role)
                            .isOnline(false)
                            .build();
                })
                .collect(Collectors.toList());
    }

    @Override
    public void handleTyping(String conversationId, User currentUser, boolean typing) {
        String userId = currentUser.getId().toString();
        assertAccess(conversationId, currentUser);

        String senderName = ((currentUser.getFirstName() != null ? currentUser.getFirstName() : "") + " "
                + (currentUser.getLastName() != null ? currentUser.getLastName() : "")).trim();
        if (senderName.isEmpty()) senderName = currentUser.getEmail();

        realtimePublisher.publishTyping(conversationId, userId, senderName, typing);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasConversationAccess(String conversationId, User user) {
        if (user == null || conversationId == null || conversationId.isBlank()) {
            return false;
        }
        String userId = user.getId().toString();
        if (memberRepository.existsByIdConversationIdAndIdUserIdAndDeletedAtIsNull(conversationId, userId)) {
            return true;
        }
        String role = getSenderRole(user);
        if ("admin".equals(role) || "employee".equals(role) || "shipper".equals(role)) {
            SocialConversation conv = conversationRepository.findById(conversationId).orElse(null);
            return conv != null && conv.getDeletedAt() == null && "support".equals(conv.getType());
        }
        return false;
    }

    // ======================== HELPER METHODS ========================

    private void addMember(String convId, String userId, String role) {
        SocialConversationMemberId id = new SocialConversationMemberId(convId, userId);
        if (!memberRepository.existsByIdConversationIdAndIdUserIdAndDeletedAtIsNull(convId, userId)) {
            SocialConversationMember m = SocialConversationMember.builder()
                    .id(id)
                    .role(role)
                    .joinedAt(LocalDateTime.now())
                    .messageUnreadCount(0)
                    .mentionUnreadCount(0)
                    .isOnline(false)
                    .build();
            memberRepository.save(m);
        }
    }

    private UUID parseUserId(String userId) {
        try {
            return UUID.fromString(userId);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("Invalid user id", HttpStatus.BAD_REQUEST);
        }
    }

    private void assertAccess(String conversationId, User user) {
        String userId = user.getId().toString();
        boolean isMember = memberRepository.existsByIdConversationIdAndIdUserIdAndDeletedAtIsNull(conversationId, userId);
        if (isMember) return;

        // Check if staff/admin can access support conversation
        String role = getSenderRole(user);
        if ("admin".equals(role) || "employee".equals(role) || "shipper".equals(role)) {
            SocialConversation conv = conversationRepository.findById(conversationId).orElse(null);
            if (conv != null && "support".equals(conv.getType())) {
                // Auto-join support staff
                addMember(conversationId, userId, "staff");
                return;
            }
        }

        throw new BusinessException("Access denied to this conversation", HttpStatus.FORBIDDEN);
    }

    private void addReaction(String messageId, String userId, String reaction) {
        SocialReaction r = SocialReaction.builder()
                .reactionId("rxn_" + UUID.randomUUID().toString().replace("-", ""))
                .targetType("message")
                .targetId(messageId)
                .userId(userId)
                .reaction(reaction)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        reactionRepository.save(r);
    }

    private void incrementCount(String targetType, String targetId, String reaction) {
        SocialReactionCountId id = new SocialReactionCountId(targetType, targetId, reaction);
        SocialReactionCount count = reactionCountRepository.findById(id)
                .orElse(SocialReactionCount.builder().id(id).count(0).updatedAt(LocalDateTime.now()).build());
        count.setCount(count.getCount() + 1);
        count.setUpdatedAt(LocalDateTime.now());
        reactionCountRepository.save(count);
    }

    private void decrementCount(String targetType, String targetId, String reaction) {
        SocialReactionCountId id = new SocialReactionCountId(targetType, targetId, reaction);
        reactionCountRepository.findById(id).ifPresent(count -> {
            int newCount = Math.max(0, count.getCount() - 1);
            if (newCount == 0) {
                reactionCountRepository.delete(count);
            } else {
                count.setCount(newCount);
                count.setUpdatedAt(LocalDateTime.now());
                reactionCountRepository.save(count);
            }
        });
    }

    private String getSenderRole(User user) {
        if (user == null || user.getRoles() == null || user.getRoles().isEmpty()) {
            return "customer";
        }
        try {
            String authorities = user.getAuthorities().stream()
                    .map(a -> a.getAuthority().toLowerCase())
                    .collect(Collectors.joining(","));
            if (authorities.contains("admin")) return "admin";
            if (authorities.contains("shipper")) return "shipper";
            if (authorities.contains("staff") || authorities.contains("employee")) return "employee";
            if (authorities.contains("supplier") || authorities.contains("seller")) return "seller";
        } catch (Exception e) {
            return "customer";
        }
        return "customer";
    }

    private ConversationDto toConversationDto(SocialConversation conv, String userId, String search) {
        if (conv == null) return null;

        List<SocialConversationMember> members = memberRepository.findByIdConversationIdAndDeletedAtIsNull(conv.getConversationId());
        List<MemberDto> memberDtos = members.stream().map(m -> {
            try {
                User u = userRepository.findById(UUID.fromString(m.getId().getUserId())).orElse(null);
                String fullName = u != null
                        ? ((u.getFirstName() != null ? u.getFirstName() : "") + " "
                        + (u.getLastName() != null ? u.getLastName() : "")).trim()
                        : null;
                return MemberDto.builder()
                        .userId(m.getId().getUserId())
                        .email(u != null ? u.getEmail() : null)
                        .username(u != null ? u.getUsername() : null)
                        .fullName(fullName != null && !fullName.isEmpty() ? fullName : (u != null ? u.getEmail() : null))
                        .role(m.getRole())
                        .isOnline(m.getIsOnline())
                        .lastSeenAt(m.getLastSeenAt())
                        .build();
            } catch (Exception e) {
                return null;
            }
        }).filter(Objects::nonNull).collect(Collectors.toList());

        String title = conv.getTitle();
        boolean isOnline = false;
        if ("direct".equals(conv.getType())) {
            MemberDto other = memberDtos.stream().filter(m -> !userId.equals(m.getUserId())).findFirst().orElse(null);
            if (other != null) {
                title = other.getFullName() != null && !other.getFullName().isBlank() ? other.getFullName() : other.getEmail();
                isOnline = Boolean.TRUE.equals(other.getIsOnline());
            }
        }

        if (title == null || title.isBlank()) {
            title = "support".equals(conv.getType()) ? "Customer Support" : "Conversation";
        }

        if (search != null && !search.isBlank()) {
            final String q = search.toLowerCase();
            final String finalTitle = title;
            boolean matches = (finalTitle.toLowerCase().contains(q))
                    || memberDtos.stream().anyMatch(m ->
                            (m.getFullName() != null && m.getFullName().toLowerCase().contains(q)) ||
                            (m.getEmail() != null && m.getEmail().toLowerCase().contains(q)) ||
                            (m.getUsername() != null && m.getUsername().toLowerCase().contains(q)));
            if (!matches) return null;
        }

        SocialConversationMember myMembership = members.stream()
                .filter(m -> userId.equals(m.getId().getUserId())).findFirst().orElse(null);
        int unreadCount = myMembership != null ? myMembership.getMessageUnreadCount() : 0;

        String lastMessagePreview = null;
        if (conv.getLastMessageId() != null) {
            SocialMessage last = messageRepository.findById(conv.getLastMessageId()).orElse(null);
            if (last != null) {
                if (last.getDeletedForEveryoneAt() != null) {
                    lastMessagePreview = "Message deleted";
                } else if (last.getBody() != null) {
                    lastMessagePreview = last.getBody().length() > 80 ? last.getBody().substring(0, 80) + "..." : last.getBody();
                }
            }
        }

        return ConversationDto.builder()
                .conversationId(conv.getConversationId())
                .type(conv.getType())
                .title(title)
                .avatarUrl(conv.getAvatarUrl())
                .orderId(conv.getOrderId())
                .status(conv.getStatus())
                .lastMessageId(conv.getLastMessageId())
                .lastMessagePreview(lastMessagePreview)
                .lastMessageAt(conv.getLastMessageAt() != null ? conv.getLastMessageAt() : conv.getCreatedAt())
                .unreadCount(unreadCount)
                .pinned(false)
                .isOnline(isOnline)
                .participants(memberDtos)
                .createdAt(conv.getCreatedAt())
                .updatedAt(conv.getUpdatedAt())
                .build();
    }

    private MessageDto toMessageDto(SocialMessage msg, String currentUserId,
                                    List<SocialReaction> reactions, List<SocialReactionCount> counts) {
        List<ReactionSummaryDto> reactionSummaries = buildReactionSummaries(reactions, counts, currentUserId);
        String myReaction = reactions.stream()
                .filter(r -> currentUserId.equals(r.getUserId()))
                .map(SocialReaction::getReaction)
                .findFirst().orElse(null);

        String senderName = null;
        if (msg.getSenderUserId() != null) {
            try {
                User sender = userRepository.findById(UUID.fromString(msg.getSenderUserId())).orElse(null);
                if (sender != null) {
                    senderName = ((sender.getFirstName() != null ? sender.getFirstName() : "") + " "
                            + (sender.getLastName() != null ? sender.getLastName() : "")).trim();
                    if (senderName.isEmpty()) senderName = sender.getEmail();
                }
            } catch (Exception e) {
                // ignore
            }
        }

        boolean deleted = msg.getDeletedForEveryoneAt() != null;
        boolean edited = msg.getEditedAt() != null;
        return MessageDto.builder()
                .messageId(msg.getMessageId())
                .conversationId(msg.getConversationId())
                .senderUserId(msg.getSenderUserId())
                .senderName(senderName)
                .senderRole(msg.getSenderRole())
                .body(deleted ? null : msg.getBody())
                .edited(edited)
                .editedAt(msg.getEditedAt())
                .deleted(deleted)
                .deletedAt(msg.getDeletedForEveryoneAt())
                .replyToMessageId(msg.getReplyToMessageId())
                .reactions(reactionSummaries)
                .myReaction(myReaction)
                .createdAt(msg.getCreatedAt())
                .build();
    }

    private List<ReactionSummaryDto> buildReactionSummaries(List<SocialReaction> reactions,
                                                             List<SocialReactionCount> counts, String userId) {
        Map<String, Integer> countMap = new HashMap<>();
        for (SocialReactionCount rc : counts) {
            countMap.put(rc.getId().getReaction(), rc.getCount());
        }
        if (countMap.isEmpty() && !reactions.isEmpty()) {
            for (SocialReaction r : reactions) {
                countMap.merge(r.getReaction(), 1, Integer::sum);
            }
        }
        Set<String> myReactions = reactions.stream()
                .filter(r -> userId.equals(r.getUserId()))
                .map(SocialReaction::getReaction)
                .collect(Collectors.toSet());

        return countMap.entrySet().stream()
                .filter(e -> e.getValue() > 0)
                .map(e -> ReactionSummaryDto.builder()
                        .reaction(e.getKey())
                        .count(e.getValue())
                        .reactedByMe(myReactions.contains(e.getKey()))
                        .build())
                .collect(Collectors.toList());
    }

    private List<ReactionSummaryDto> buildPublicReactionSummaries(List<SocialReaction> reactions,
                                                                  List<SocialReactionCount> counts) {
        return buildReactionSummaries(reactions, counts, "").stream()
                .map(s -> ReactionSummaryDto.builder()
                        .reaction(s.getReaction())
                        .count(s.getCount())
                        .reactedByMe(false)
                        .build())
                .collect(Collectors.toList());
    }
}
