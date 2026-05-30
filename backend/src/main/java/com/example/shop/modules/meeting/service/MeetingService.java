package com.example.shop.modules.meeting.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.meeting.realtime.MeetingRealtimePublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class MeetingService {

    private static final Pattern MENTION = Pattern.compile("@([A-Za-z0-9._%+-]+(?:@[A-Za-z0-9.-]+\\.[A-Za-z]{2,})?)");
    private static final Set<String> PRIVILEGED_ROLES = Set.of("ROLE_ADMIN", "ROLE_MANAGER", "ROLE_EMPLOYEE");
    private static final Set<String> SHIFT_BOUND_ROLES = Set.of("ROLE_SHIPPER");

    private final JdbcTemplate jdbcTemplate;
    private final MeetingRealtimePublisher realtimePublisher;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listMeetings(String actor, Instant from, Instant to, String view, boolean team) {
        Instant safeFrom = from == null ? Instant.now().minus(Duration.ofDays(7)) : from;
        Instant safeTo = to == null ? safeFrom.plus(Duration.ofDays("month".equalsIgnoreCase(view) ? 45 : 8)) : to;
        List<Map<String, Object>> meetings = jdbcTemplate.query("""
                SELECT DISTINCT m.*
                FROM meetings m
                LEFT JOIN meeting_participants p ON p.meeting_id = m.meeting_id
                WHERE m.start_at < ? AND m.end_at > ?
                  AND m.status <> 'CANCELLED'
                  AND ((? = TRUE AND m.visibility = 'PUBLIC') OR lower(m.created_by) = lower(?) OR lower(p.participant_email) = lower(?))
                ORDER BY m.start_at ASC
                """, this::mapMeeting, ts(safeTo), ts(safeFrom), team, actor, actor);
        meetings.forEach(this::hydrateMeeting);
        return meetings;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getMeeting(UUID id, String actor) {
        Map<String, Object> meeting = findMeeting(id);
        if (!canView(meeting, actor)) {
            throw new BusinessException("Meeting not found.");
        }
        hydrateMeeting(meeting);
        meeting.put("activity", activity(id));
        meeting.put("action_items", actionItems(id));
        return meeting;
    }

    @Transactional
    public Map<String, Object> createMeeting(Map<String, Object> body, String actor) {
        String title = required(body, "title");
        Instant startAt = parseInstant(body.get("startAt"), "startAt");
        Instant endAt = parseInstant(body.get("endAt"), "endAt");
        validateWindow(startAt, endAt);
        List<String> participants = participants(body, actor);
        List<String> warnings = analyzeConflicts(null, participants, startAt, endAt, true);

        UUID id = UUID.randomUUID();
        UUID seriesId = UUID.randomUUID();
        String conversationId = "meet_" + compact(id);
        String threadId = "mthread_" + compact(id);
        insertMeeting(id, seriesId, title, text(body.get("description")), startAt, endAt, body, actor, conversationId, threadId);
        insertSocialContainers(conversationId, threadId, id, title, actor, participants);
        replaceParticipants(id, participants);
        insertAttachments(id, listOfMaps(body.get("attachments")), actor);
        event(id, "CREATED", actor, Map.of("title", title));

        int repeatCount = repeatCount(body);
        String repeatRule = optional(body.get("repeatRule"), "");
        if (repeatCount > 1 && StringUtils.hasText(repeatRule)) {
            createRepeats(id, seriesId, body, actor, participants, repeatRule, repeatCount);
        }

        notifyParticipants(id, participants, "Meeting invitation", "You were invited to " + title, "INVITED");
        broadcast(id, participants, "created");
        Map<String, Object> meeting = getMeeting(id, actor);
        meeting.put("conflict_warnings", warnings);
        return meeting;
    }

    @Transactional
    public Map<String, Object> updateMeeting(UUID id, Map<String, Object> body, String actor) {
        Map<String, Object> existing = findMeeting(id);
        requireOrganizer(existing, actor);
        String title = optional(body.get("title"), String.valueOf(existing.get("title")));
        Instant startAt = parseInstant(body.getOrDefault("startAt", existing.get("start_at")), "startAt");
        Instant endAt = parseInstant(body.getOrDefault("endAt", existing.get("end_at")), "endAt");
        validateWindow(startAt, endAt);
        List<String> participants = participants(body, actor);
        List<String> warnings = analyzeConflicts(id, participants, startAt, endAt, true);

        jdbcTemplate.update("""
                UPDATE meetings
                SET title = ?, description = ?, start_at = ?, end_at = ?, timezone = ?, priority = ?, visibility = ?,
                    meeting_room = ?, online_link = ?, related_type = ?, related_id = ?, notes = ?, updated_by = ?,
                    updated_at = CURRENT_TIMESTAMP, reminder_sent_at = NULL
                WHERE meeting_id = ?
                """, title, text(body.get("description")), ts(startAt), ts(endAt), optional(body.get("timezone"), "UTC"),
                enumValue(body.get("priority"), "MEDIUM"), enumValue(body.get("visibility"), "PUBLIC"),
                text(body.get("meetingRoom")), text(body.get("onlineLink")), text(body.get("relatedType")),
                text(body.get("relatedId")), text(body.get("notes")), actor, id);
        replaceParticipants(id, participants);
        replaceAttachments(id, listOfMaps(body.get("attachments")), actor);
        event(id, "UPDATED", actor, Map.of("title", title));
        notifyParticipants(id, participants, "Meeting updated", title + " was updated", "UPDATED");
        notifyManagers(id, warnings, actor);
        broadcast(id, participants, "updated");
        Map<String, Object> meeting = getMeeting(id, actor);
        meeting.put("conflict_warnings", warnings);
        return meeting;
    }

    @Transactional
    public Map<String, Object> reschedule(UUID id, Map<String, Object> body, String actor) {
        Map<String, Object> meeting = findMeeting(id);
        requireOrganizer(meeting, actor);
        Instant startAt = parseInstant(body.get("startAt"), "startAt");
        Instant endAt = parseInstant(body.get("endAt"), "endAt");
        validateWindow(startAt, endAt);
        List<String> participants = participantEmails(id);
        List<String> warnings = analyzeConflicts(id, participants, startAt, endAt, true);
        jdbcTemplate.update("""
                UPDATE meetings
                SET start_at = ?, end_at = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP, reminder_sent_at = NULL
                WHERE meeting_id = ?
                """, ts(startAt), ts(endAt), actor, id);
        event(id, "RESCHEDULED", actor, Map.of("startAt", startAt.toString(), "endAt", endAt.toString()));
        notifyParticipants(id, participants, "Meeting rescheduled", meeting.get("title") + " has a new time", "RESCHEDULED");
        notifyManagers(id, warnings, actor);
        broadcast(id, participants, "rescheduled");
        Map<String, Object> updated = getMeeting(id, actor);
        updated.put("conflict_warnings", warnings);
        return updated;
    }

    @Transactional
    public Map<String, Object> cancel(UUID id, String actor) {
        Map<String, Object> meeting = findMeeting(id);
        requireOrganizer(meeting, actor);
        jdbcTemplate.update("""
                UPDATE meetings
                SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP, updated_by = ?, updated_at = CURRENT_TIMESTAMP
                WHERE meeting_id = ?
                """, actor, id);
        List<String> participants = participantEmails(id);
        event(id, "CANCELLED", actor, Map.of("title", String.valueOf(meeting.get("title"))));
        notifyParticipants(id, participants, "Meeting cancelled", meeting.get("title") + " was cancelled", "CANCELLED");
        broadcast(id, participants, "cancelled");
        return getMeeting(id, actor);
    }

    @Transactional
    public Map<String, Object> updateAttendance(UUID id, Map<String, Object> body, String actor) {
        String status = enumValue(body.get("status"), "PENDING");
        int updated = jdbcTemplate.update("""
                UPDATE meeting_participants
                SET attendance_status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE meeting_id = ? AND lower(participant_email) = lower(?)
                """, status, id, actor);
        if (updated == 0) {
            throw new BusinessException("You are not a participant in this meeting.");
        }
        event(id, "ATTENDANCE_" + status, actor, Map.of("status", status));
        broadcast(id, participantEmails(id), "attendance");
        return getMeeting(id, actor);
    }

    @Transactional
    public Map<String, Object> postMessage(UUID id, Map<String, Object> body, String actor) {
        Map<String, Object> meeting = getMeeting(id, actor);
        String message = required(body, "body");
        String messageId = "msg_" + UUID.randomUUID().toString().replace("-", "");
        String conversationId = String.valueOf(meeting.get("chat_conversation_id"));
        jdbcTemplate.update("""
                INSERT INTO social_messages (message_id, conversation_id, sender_user_id, sender_role, body, type)
                VALUES (?, ?, ?, 'employee', ?, 'text')
                """, messageId, conversationId, actor, message);
        jdbcTemplate.update("""
                UPDATE social_conversations
                SET last_message_id = ?, last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE conversation_id = ?
                """, messageId, conversationId);
        handleMentions(id, messageId, "message", message, actor);
        event(id, "CHAT_MESSAGE", actor, Map.of("messageId", messageId));
        broadcast(id, participantEmails(id), "chat");
        return Map.of("message_id", messageId, "body", message, "created_at", LocalDateTime.now().toString());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> messages(UUID id, String actor) {
        Map<String, Object> meeting = getMeeting(id, actor);
        return jdbcTemplate.query("""
                SELECT message_id, sender_user_id, body, created_at
                FROM social_messages
                WHERE conversation_id = ?
                ORDER BY created_at ASC
                """, (rs, rowNum) -> mapSimple(rs, "message_id", "sender_user_id", "body", "created_at"),
                meeting.get("chat_conversation_id"));
    }

    @Transactional
    public Map<String, Object> postComment(UUID id, Map<String, Object> body, String actor) {
        Map<String, Object> meeting = getMeeting(id, actor);
        String comment = required(body, "body");
        String commentId = "cmt_" + UUID.randomUUID().toString().replace("-", "");
        String threadId = String.valueOf(meeting.get("comment_thread_id"));
        jdbcTemplate.update("""
                INSERT INTO social_comments (comment_id, thread_id, parent_comment_id, author_user_id, author_role, body)
                VALUES (?, ?, ?, ?, 'employee', ?)
                """, commentId, threadId, text(body.get("parentCommentId")), actor, comment);
        jdbcTemplate.update("""
                UPDATE social_comment_threads
                SET comment_count = comment_count + 1, last_comment_at = CURRENT_TIMESTAMP
                WHERE thread_id = ?
                """, threadId);
        handleMentions(id, commentId, "comment", comment, actor);
        event(id, "COMMENT", actor, Map.of("commentId", commentId));
        broadcast(id, participantEmails(id), "comment");
        return Map.of("comment_id", commentId, "body", comment, "created_at", LocalDateTime.now().toString());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> comments(UUID id, String actor) {
        Map<String, Object> meeting = getMeeting(id, actor);
        return jdbcTemplate.query("""
                SELECT comment_id, author_user_id, body, parent_comment_id, created_at
                FROM social_comments
                WHERE thread_id = ? AND deleted_at IS NULL
                ORDER BY created_at ASC
                """, (rs, rowNum) -> mapSimple(rs, "comment_id", "author_user_id", "body", "parent_comment_id", "created_at"),
                meeting.get("comment_thread_id"));
    }

    @Transactional
    public Map<String, Object> createActionItem(UUID id, Map<String, Object> body, String actor) {
        getMeeting(id, actor);
        UUID itemId = UUID.randomUUID();
        String assignedTo = text(body.get("assignedTo"));
        jdbcTemplate.update("""
                INSERT INTO meeting_action_items (action_item_id, meeting_id, body, assigned_to, due_at, created_by)
                VALUES (?, ?, ?, ?, ?, ?)
                """, itemId, id, required(body, "body"), assignedTo, parseTimestamp(body.get("dueAt")), actor);
        if (StringUtils.hasText(assignedTo)) {
            createNotification(assignedTo, "Meeting action item", "You were assigned an action item", "MEETING_ACTION", itemId.toString());
        }
        event(id, "ACTION_ITEM_CREATED", actor, Map.of("actionItemId", itemId.toString()));
        broadcast(id, participantEmails(id), "action_item");
        return actionItem(itemId);
    }

    @Transactional
    public Map<String, Object> updateActionItem(UUID meetingId, UUID itemId, Map<String, Object> body, String actor) {
        getMeeting(meetingId, actor);
        String status = enumValue(body.get("status"), "OPEN");
        jdbcTemplate.update("""
                UPDATE meeting_action_items
                SET status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE action_item_id = ? AND meeting_id = ?
                """, status, itemId, meetingId);
        event(meetingId, "ACTION_ITEM_" + status, actor, Map.of("actionItemId", itemId.toString()));
        broadcast(meetingId, participantEmails(meetingId), "action_item");
        return actionItem(itemId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> availability(List<String> participants, Instant startAt, Instant endAt) {
        validateWindow(startAt, endAt);
        List<String> normalized = participants.stream().map(this::normalizeEmail).filter(StringUtils::hasText).distinct().toList();
        return Map.of(
                "available", analyzeConflicts(null, normalized, startAt, endAt, false).isEmpty(),
                "warnings", analyzeConflicts(null, normalized, startAt, endAt, false),
                "participants", normalized
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> analytics(String actor, Instant from, Instant to) {
        Instant safeFrom = from == null ? Instant.now().minus(Duration.ofDays(30)) : from;
        Instant safeTo = to == null ? Instant.now().plus(Duration.ofDays(1)) : to;
        Integer total = jdbcTemplate.queryForObject("""
                SELECT count(*) FROM meetings WHERE created_by = ? AND start_at >= ? AND start_at < ?
                """, Integer.class, actor, ts(safeFrom), ts(safeTo));
        Integer accepted = jdbcTemplate.queryForObject("""
                SELECT count(*) FROM meeting_participants p
                JOIN meetings m ON m.meeting_id = p.meeting_id
                WHERE m.created_by = ? AND p.attendance_status = 'ACCEPTED' AND m.start_at >= ? AND m.start_at < ?
                """, Integer.class, actor, ts(safeFrom), ts(safeTo));
        Double hours = jdbcTemplate.queryForObject("""
                SELECT coalesce(sum(extract(epoch from (end_at - start_at)) / 3600.0), 0)
                FROM meetings WHERE created_by = ? AND status <> 'CANCELLED' AND start_at >= ? AND start_at < ?
                """, Double.class, actor, ts(safeFrom), ts(safeTo));
        return Map.of("meetings", value(total), "accepted_attendances", value(accepted),
                "scheduled_hours", Math.round((hours == null ? 0.0 : hours) * 100.0) / 100.0);
    }

    @Scheduled(fixedDelayString = "${application.meetings.reminder-delay-ms:60000}")
    @Transactional
    public void sendDueReminders() {
        List<Map<String, Object>> rows = jdbcTemplate.query("""
                SELECT meeting_id, title
                FROM meetings
                WHERE status = 'SCHEDULED'
                  AND reminder_sent_at IS NULL
                  AND start_at BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '15 minutes'
                LIMIT 50
                """, (rs, rowNum) -> Map.of("id", rs.getObject("meeting_id", UUID.class), "title", rs.getString("title")));
        for (Map<String, Object> row : rows) {
            UUID id = (UUID) row.get("id");
            List<String> participants = participantEmails(id);
            notifyParticipants(id, participants, "Meeting starting soon", row.get("title") + " starts within 15 minutes", "REMINDER");
            jdbcTemplate.update("UPDATE meetings SET reminder_sent_at = CURRENT_TIMESTAMP WHERE meeting_id = ?", id);
            broadcast(id, participants, "reminder");
        }
    }

    private void insertMeeting(UUID id, UUID seriesId, String title, String description, Instant startAt, Instant endAt,
                               Map<String, Object> body, String actor, String conversationId, String threadId) {
        jdbcTemplate.update("""
                INSERT INTO meetings (meeting_id, series_id, title, description, start_at, end_at, timezone, priority,
                    visibility, meeting_room, online_link, related_type, related_id, repeat_rule, chat_conversation_id,
                    comment_thread_id, notes, created_by, updated_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, seriesId, title, description, ts(startAt), ts(endAt), optional(body.get("timezone"), "UTC"),
                enumValue(body.get("priority"), "MEDIUM"), enumValue(body.get("visibility"), "PUBLIC"),
                text(body.get("meetingRoom")), text(body.get("onlineLink")), text(body.get("relatedType")),
                text(body.get("relatedId")), text(body.get("repeatRule")), conversationId, threadId,
                text(body.get("notes")), actor, actor);
    }

    private void createRepeats(UUID firstId, UUID seriesId, Map<String, Object> body, String actor,
                               List<String> participants, String rule, int count) {
        Instant originalStart = parseInstant(body.get("startAt"), "startAt");
        Instant originalEnd = parseInstant(body.get("endAt"), "endAt");
        Duration step = switch (rule.toUpperCase(Locale.ROOT)) {
            case "DAILY" -> Duration.ofDays(1);
            case "WEEKLY" -> Duration.ofDays(7);
            case "MONTHLY" -> Duration.ofDays(30);
            default -> Duration.ZERO;
        };
        if (step.isZero()) {
            return;
        }
        for (int i = 1; i < Math.min(count, 24); i++) {
            UUID id = UUID.randomUUID();
            Instant start = originalStart.plus(step.multipliedBy(i));
            Instant end = originalEnd.plus(step.multipliedBy(i));
            String conversationId = "meet_" + compact(id);
            String threadId = "mthread_" + compact(id);
            insertMeeting(id, seriesId, required(body, "title"), text(body.get("description")), start, end, body, actor, conversationId, threadId);
            insertSocialContainers(conversationId, threadId, id, required(body, "title"), actor, participants);
            replaceParticipants(id, participants);
            insertAttachments(id, listOfMaps(body.get("attachments")), actor);
            event(id, "CREATED_FROM_REPEAT", actor, Map.of("parentMeetingId", firstId.toString()));
        }
    }

    private List<String> analyzeConflicts(UUID excludeId, List<String> participants, Instant startAt, Instant endAt, boolean enforceShift) {
        List<String> warnings = new ArrayList<>();
        for (String email : participants) {
            Integer overlaps = jdbcTemplate.queryForObject("""
                    SELECT count(*)
                    FROM meetings m
                    JOIN meeting_participants p ON p.meeting_id = m.meeting_id
                    WHERE lower(p.participant_email) = lower(?)
                      AND m.status <> 'CANCELLED'
                      AND m.start_at < ? AND m.end_at > ?
                      AND (? IS NULL OR m.meeting_id <> ?)
                    """, Integer.class, email, ts(endAt), ts(startAt), excludeId, excludeId);
            if (value(overlaps) > 0) {
                warnings.add(email + " has another meeting at this time.");
            }
            ShiftState shift = shiftState(email, startAt, endAt);
            if (shift.boundToShift() && !shift.covered()) {
                String warning = email + " is outside their working shift.";
                warnings.add(warning);
                if (enforceShift) {
                    throw new BusinessException(warning);
                }
            } else if (shift.boundToShift() && shift.overlapOnly()) {
                warnings.add(email + " is only partially covered by a working shift.");
            }
        }
        return warnings;
    }

    private ShiftState shiftState(String email, Instant startAt, Instant endAt) {
        List<String> roles = userRoles(email);
        boolean bound = roles.stream().anyMatch(SHIFT_BOUND_ROLES::contains);
        if (!bound || roles.stream().anyMatch(PRIVILEGED_ROLES::contains)) {
            return new ShiftState(false, true, false);
        }
        Integer hasAny = jdbcTemplate.queryForObject("""
                SELECT count(*) FROM shifts s JOIN users u ON u.users_id = s.assignee_user_id
                WHERE lower(u.email) = lower(?) AND s.status IN ('PENDING', 'ACCEPTED', 'COMPLETED')
                  AND s.start_at < ? AND s.end_at > ?
                """, Integer.class, email, ts(endAt), ts(startAt));
        Integer covered = jdbcTemplate.queryForObject("""
                SELECT count(*) FROM shifts s JOIN users u ON u.users_id = s.assignee_user_id
                WHERE lower(u.email) = lower(?) AND s.status IN ('PENDING', 'ACCEPTED', 'COMPLETED')
                  AND s.start_at <= ? AND s.end_at >= ?
                """, Integer.class, email, ts(startAt), ts(endAt));
        return new ShiftState(true, value(covered) > 0, value(hasAny) > 0);
    }

    private List<String> userRoles(String email) {
        return jdbcTemplate.query("""
                SELECT r.name FROM users u
                JOIN user_roles ur ON ur.users_id = u.users_id
                JOIN roles r ON r.roles_id = ur.roles_id
                WHERE lower(u.email) = lower(?)
                """, (rs, rowNum) -> rs.getString(1), email);
    }

    private void replaceParticipants(UUID id, List<String> participants) {
        jdbcTemplate.update("DELETE FROM meeting_participants WHERE meeting_id = ?", id);
        for (String email : participants) {
            Map<String, Object> user = lookupUser(email);
            jdbcTemplate.update("""
                    INSERT INTO meeting_participants (meeting_id, participant_email, participant_user_id, display_name)
                    VALUES (?, ?, ?, ?)
                    """, id, email, user.get("id"), user.get("name"));
        }
    }

    private void insertAttachments(UUID id, List<Map<String, Object>> attachments, String actor) {
        for (Map<String, Object> attachment : attachments) {
            if (!StringUtils.hasText(text(attachment.get("fileUrl")))) {
                continue;
            }
            jdbcTemplate.update("""
                    INSERT INTO meeting_attachments (attachment_id, meeting_id, file_name, file_url, content_type, uploaded_by)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, UUID.randomUUID(), id, optional(attachment.get("fileName"), "Attachment"),
                    text(attachment.get("fileUrl")), text(attachment.get("contentType")), actor);
        }
    }

    private void replaceAttachments(UUID id, List<Map<String, Object>> attachments, String actor) {
        jdbcTemplate.update("DELETE FROM meeting_attachments WHERE meeting_id = ?", id);
        insertAttachments(id, attachments, actor);
    }

    private void insertSocialContainers(String conversationId, String threadId, UUID meetingId, String title, String actor,
                                        List<String> participants) {
        jdbcTemplate.update("""
                INSERT INTO social_conversations (conversation_id, type, title, created_by_user_id, metadata)
                VALUES (?, 'group', ?, ?, CAST(? AS jsonb))
                ON CONFLICT (conversation_id) DO NOTHING
                """, conversationId, title, actor, "{\"meeting_id\":\"" + meetingId + "\"}");
        for (String participant : participants) {
            jdbcTemplate.update("""
                    INSERT INTO social_conversation_members (conversation_id, user_id, role)
                    VALUES (?, ?, 'member')
                    ON CONFLICT (conversation_id, user_id) DO NOTHING
                    """, conversationId, participant);
        }
        jdbcTemplate.update("""
                INSERT INTO social_comment_threads (thread_id, target_type, target_id)
                VALUES (?, 'meeting', ?)
                ON CONFLICT (thread_id) DO NOTHING
                """, threadId, meetingId.toString());
    }

    private void notifyParticipants(UUID meetingId, List<String> participants, String title, String message, String eventType) {
        for (String participant : participants) {
            createNotification(participant, title, message, "MEETING", meetingId.toString());
        }
        event(meetingId, "NOTIFIED_" + eventType, "system", Map.of("count", String.valueOf(participants.size())));
    }

    private void notifyManagers(UUID meetingId, List<String> warnings, String actor) {
        if (warnings.isEmpty()) {
            return;
        }
        List<String> managers = jdbcTemplate.query("""
                SELECT DISTINCT u.email
                FROM users u
                JOIN user_roles ur ON ur.users_id = u.users_id
                JOIN roles r ON r.roles_id = ur.roles_id
                WHERE r.name IN ('ROLE_ADMIN', 'ROLE_MANAGER')
                """, (rs, rowNum) -> rs.getString(1));
        for (String manager : managers) {
            createNotification(manager, "Scheduling conflict", String.join(" ", warnings), "MEETING", meetingId.toString());
        }
        event(meetingId, "MANAGER_CONFLICT_NOTICE", actor, Map.of("warnings", String.join(" | ", warnings)));
    }

    private void createNotification(String recipient, String title, String message, String sourceType, String sourceId) {
        jdbcTemplate.update("""
                INSERT INTO app_notifications (recipient, title, message, channel, source_type, source_id)
                VALUES (?, ?, ?, 'IN_APP', ?, ?)
                """, recipient, title, message, sourceType, sourceId);
        realtimePublisher.publishCalendarChanged(recipient, Map.of("type", "notification", "sourceId", sourceId));
    }

    private void handleMentions(UUID meetingId, String sourceId, String sourceType, String body, String actor) {
        Matcher matcher = MENTION.matcher(body);
        while (matcher.find()) {
            String token = matcher.group(1);
            String email = resolveMentionEmail(token);
            if (!StringUtils.hasText(email)) {
                continue;
            }
            jdbcTemplate.update("""
                    INSERT INTO social_mentions (mention_id, source_type, source_id, mentioned_user_id, mentioned_username, created_by_user_id, priority)
                    VALUES (?, ?, ?, ?, ?, ?, 'normal')
                    """, "men_" + UUID.randomUUID().toString().replace("-", ""), sourceType, sourceId, email, token, actor);
            createNotification(email, "You were mentioned", "You were mentioned in meeting notes or chat.", "MEETING_MENTION", meetingId.toString());
        }
    }

    private String resolveMentionEmail(String token) {
        if (token.contains("@")) {
            return token.toLowerCase(Locale.ROOT);
        }
        List<String> matches = jdbcTemplate.query("""
                SELECT email FROM users WHERE lower(username) = lower(?) LIMIT 1
                """, (rs, rowNum) -> rs.getString(1), token);
        return matches.isEmpty() ? null : matches.get(0);
    }

    private void broadcast(UUID id, List<String> participants, String type) {
        Map<String, Object> payload = Map.of("type", type, "meetingId", id.toString(), "at", LocalDateTime.now().toString());
        realtimePublisher.publishMeetingChanged(id.toString(), payload);
        realtimePublisher.publishTeamChanged(payload);
        for (String participant : participants) {
            realtimePublisher.publishCalendarChanged(participant, payload);
        }
    }

    private void hydrateMeeting(Map<String, Object> meeting) {
        UUID id = (UUID) meeting.get("meeting_id");
        meeting.put("participants", jdbcTemplate.query("""
                SELECT participant_email, participant_user_id, display_name, role, attendance_status, online_status, joined_at, is_late
                FROM meeting_participants WHERE meeting_id = ? ORDER BY participant_email
                """, (rs, rowNum) -> mapSimple(rs, "participant_email", "participant_user_id", "display_name", "role",
                "attendance_status", "online_status", "joined_at", "is_late"), id));
        meeting.put("attachments", jdbcTemplate.query("""
                SELECT attachment_id, file_name, file_url, content_type, uploaded_by, created_at
                FROM meeting_attachments WHERE meeting_id = ? ORDER BY created_at
                """, (rs, rowNum) -> mapSimple(rs, "attachment_id", "file_name", "file_url", "content_type", "uploaded_by", "created_at"), id));
    }

    private Map<String, Object> findMeeting(UUID id) {
        List<Map<String, Object>> rows = jdbcTemplate.query("SELECT * FROM meetings WHERE meeting_id = ?", this::mapMeeting, id);
        if (rows.isEmpty()) {
            throw new BusinessException("Meeting not found.");
        }
        return rows.get(0);
    }

    private boolean canView(Map<String, Object> meeting, String actor) {
        if ("PUBLIC".equals(meeting.get("visibility")) || actor.equalsIgnoreCase(String.valueOf(meeting.get("created_by")))) {
            return true;
        }
        return participantEmails((UUID) meeting.get("meeting_id")).stream().anyMatch(actor::equalsIgnoreCase);
    }

    private void requireOrganizer(Map<String, Object> meeting, String actor) {
        if (!actor.equalsIgnoreCase(String.valueOf(meeting.get("created_by"))) && userRoles(actor).stream().noneMatch(PRIVILEGED_ROLES::contains)) {
            throw new BusinessException("Only the organizer or manager can change this meeting.");
        }
    }

    private List<String> participantEmails(UUID id) {
        return jdbcTemplate.query("SELECT participant_email FROM meeting_participants WHERE meeting_id = ?",
                (rs, rowNum) -> rs.getString(1), id);
    }

    private List<Map<String, Object>> activity(UUID id) {
        return jdbcTemplate.query("""
                SELECT id, event_type, actor, details::text AS details, created_at
                FROM meeting_activity_events WHERE meeting_id = ? ORDER BY created_at DESC LIMIT 100
                """, (rs, rowNum) -> mapSimple(rs, "id", "event_type", "actor", "details", "created_at"), id);
    }

    private List<Map<String, Object>> actionItems(UUID id) {
        return jdbcTemplate.query("""
                SELECT action_item_id, body, assigned_to, due_at, status, created_by, created_at, updated_at
                FROM meeting_action_items WHERE meeting_id = ? ORDER BY created_at DESC
                """, (rs, rowNum) -> mapSimple(rs, "action_item_id", "body", "assigned_to", "due_at", "status", "created_by", "created_at", "updated_at"), id);
    }

    private Map<String, Object> actionItem(UUID id) {
        return jdbcTemplate.queryForObject("""
                SELECT action_item_id, meeting_id, body, assigned_to, due_at, status, created_by, created_at, updated_at
                FROM meeting_action_items WHERE action_item_id = ?
                """, (rs, rowNum) -> mapSimple(rs, "action_item_id", "meeting_id", "body", "assigned_to", "due_at", "status", "created_by", "created_at", "updated_at"), id);
    }

    private void event(UUID id, String type, String actor, Map<String, Object> details) {
        jdbcTemplate.update("""
                INSERT INTO meeting_activity_events (meeting_id, event_type, actor, details)
                VALUES (?, ?, ?, CAST(? AS jsonb))
                """, id, type, actor, toJson(details));
    }

    private Map<String, Object> mapMeeting(ResultSet rs, int rowNum) throws java.sql.SQLException {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("meeting_id", rs.getObject("meeting_id", UUID.class));
        row.put("series_id", rs.getObject("series_id", UUID.class));
        row.put("title", rs.getString("title"));
        row.put("description", rs.getString("description"));
        row.put("start_at", fmt(rs.getTimestamp("start_at")));
        row.put("end_at", fmt(rs.getTimestamp("end_at")));
        row.put("timezone", rs.getString("timezone"));
        row.put("priority", rs.getString("priority"));
        row.put("visibility", rs.getString("visibility"));
        row.put("status", rs.getString("status"));
        row.put("meeting_room", rs.getString("meeting_room"));
        row.put("online_link", rs.getString("online_link"));
        row.put("related_type", rs.getString("related_type"));
        row.put("related_id", rs.getString("related_id"));
        row.put("repeat_rule", rs.getString("repeat_rule"));
        row.put("chat_conversation_id", rs.getString("chat_conversation_id"));
        row.put("comment_thread_id", rs.getString("comment_thread_id"));
        row.put("notes", rs.getString("notes"));
        row.put("created_by", rs.getString("created_by"));
        row.put("created_at", fmt(rs.getTimestamp("created_at")));
        row.put("updated_at", fmt(rs.getTimestamp("updated_at")));
        return row;
    }

    private Map<String, Object> mapSimple(ResultSet rs, String... columns) throws java.sql.SQLException {
        Map<String, Object> row = new LinkedHashMap<>();
        for (String column : columns) {
            Object value = rs.getObject(column);
            row.put(column, value instanceof Timestamp timestamp ? fmt(timestamp) : value);
        }
        return row;
    }

    private Map<String, Object> lookupUser(String email) {
        List<Map<String, Object>> users = jdbcTemplate.query("""
                SELECT users_id, email, first_name, last_name FROM users WHERE lower(email) = lower(?) LIMIT 1
                """, (rs, rowNum) -> {
            String name = (optional(rs.getString("first_name"), "") + " " + optional(rs.getString("last_name"), "")).trim();
            return Map.of("id", rs.getObject("users_id", UUID.class), "name", name.isBlank() ? rs.getString("email") : name);
        }, email);
        if (!users.isEmpty()) {
            return users.get(0);
        }
        Map<String, Object> fallback = new LinkedHashMap<>();
        fallback.put("id", null);
        fallback.put("name", email);
        return fallback;
    }

    private List<String> participants(Map<String, Object> body, String actor) {
        List<String> participants = new ArrayList<>();
        Object raw = body.get("participants");
        if (raw instanceof Collection<?> collection) {
            for (Object item : collection) {
                if (item instanceof Map<?, ?> map) {
                    participants.add(normalizeEmail(map.get("email")));
                } else {
                    participants.add(normalizeEmail(item));
                }
            }
        }
        participants.add(normalizeEmail(actor));
        return participants.stream().filter(StringUtils::hasText).distinct().toList();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> listOfMaps(Object raw) {
        if (!(raw instanceof Collection<?> collection)) {
            return List.of();
        }
        List<Map<String, Object>> values = new ArrayList<>();
        for (Object item : collection) {
            if (item instanceof Map<?, ?> map) {
                values.add((Map<String, Object>) map);
            }
        }
        return values;
    }

    private void validateWindow(Instant startAt, Instant endAt) {
        if (!endAt.isAfter(startAt)) {
            throw new BusinessException("Meeting end time must be after start time.");
        }
        if (Duration.between(startAt, endAt).toHours() > 24) {
            throw new BusinessException("Meeting duration cannot exceed 24 hours.");
        }
    }

    private Timestamp parseTimestamp(Object raw) {
        return raw == null || !StringUtils.hasText(raw.toString()) ? null : ts(parseInstant(raw, "timestamp"));
    }

    private Instant parseInstant(Object raw, String field) {
        try {
            if (raw instanceof Instant instant) {
                return instant;
            }
            if (raw instanceof Timestamp timestamp) {
                return timestamp.toInstant();
            }
            String value = String.valueOf(raw).trim();
            if (value.endsWith("Z") || value.contains("+")) {
                return Instant.parse(value);
            }
            return LocalDateTime.parse(value).toInstant(ZoneOffset.UTC);
        } catch (Exception ex) {
            throw new BusinessException(field + " must be an ISO date-time.");
        }
    }

    private String required(Map<String, Object> body, String field) {
        String value = text(body.get(field));
        if (!StringUtils.hasText(value)) {
            throw new BusinessException(field + " is required.");
        }
        return value;
    }

    private String text(Object value) {
        String raw = value == null ? null : String.valueOf(value).trim();
        return StringUtils.hasText(raw) ? raw : null;
    }

    private String optional(Object value, String fallback) {
        String raw = text(value);
        return raw == null ? fallback : raw;
    }

    private String enumValue(Object value, String fallback) {
        return optional(value, fallback).trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeEmail(Object value) {
        return optional(value, "").trim().toLowerCase(Locale.ROOT);
    }

    private Timestamp ts(Instant instant) {
        return Timestamp.from(instant);
    }

    private String fmt(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant().toString();
    }

    private int value(Integer value) {
        return value == null ? 0 : value;
    }

    private int repeatCount(Map<String, Object> body) {
        Object raw = body.get("repeatCount");
        if (raw == null) {
            return 1;
        }
        try {
            return Math.max(1, Integer.parseInt(String.valueOf(raw)));
        } catch (NumberFormatException ex) {
            return 1;
        }
    }

    private String compact(UUID id) {
        return id.toString().replace("-", "");
    }

    private String toJson(Map<String, Object> details) {
        StringJoiner joiner = new StringJoiner(",", "{", "}");
        for (Map.Entry<String, Object> entry : details.entrySet()) {
            joiner.add("\"" + entry.getKey().replace("\"", "\\\"") + "\":\"" +
                    String.valueOf(entry.getValue()).replace("\"", "\\\"") + "\"");
        }
        return joiner.toString();
    }

    private record ShiftState(boolean boundToShift, boolean covered, boolean overlapOnly) {
    }
}
