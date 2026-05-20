package com.example.shop.config;

import com.example.shop.modules.security.SecurityEventLogger;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketSessionRegistry {

    private final SecurityEventLogger securityEventLogger;

    @Value("${application.security.websocket.node-id:${HOSTNAME:node-unknown}}")
    private String nodeId;

    private final Map<String, SessionRecord> sessionsById = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> sessionsByUser = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> sessionsByJti = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> sessionsBySid = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> sessionsByFid = new ConcurrentHashMap<>();

    public void registerTransportSession(WebSocketSession session) {
        sessionsById.compute(session.getId(), (id, existing) -> {
            if (existing == null) {
                return SessionRecord.transportOnly(id, session, nodeId);
            }
            existing.setSession(session);
            return existing;
        });
    }

    public void registerAuthContext(String sessionId, AuthContext context) {
        if (sessionId == null || sessionId.isBlank() || context == null) return;
        sessionsById.compute(sessionId, (id, existing) -> {
            SessionRecord record = existing == null ? SessionRecord.transportOnly(id, null, nodeId) : existing;
            record.setUserId(context.userId());
            record.setUserEmail(context.userEmail());
            record.setJti(context.jti());
            record.setSid(context.sid());
            record.setFid(context.fid());
            record.setDeviceId(context.deviceId());
            record.setConnectedAt(Instant.now());
            record.setRequestId(context.requestId());
            return record;
        });
        index(sessionsByUser, context.userId(), sessionId);
        index(sessionsByJti, context.jti(), sessionId);
        index(sessionsBySid, context.sid(), sessionId);
        index(sessionsByFid, context.fid(), sessionId);

        securityEventLogger.info("websocket_connect_authenticated", Map.of(
                "wsSessionId", sessionId,
                "userId", safe(context.userId()),
                "jti", safe(context.jti()),
                "sid", safe(context.sid()),
                "fid", safe(context.fid()),
                "deviceId", safe(context.deviceId()),
                "requestId", safe(context.requestId()),
                "nodeId", safe(nodeId)
        ));
    }

    public void unregister(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) return;
        SessionRecord record = sessionsById.remove(sessionId);
        if (record == null) return;
        deindex(sessionsByUser, record.getUserId(), sessionId);
        deindex(sessionsByJti, record.getJti(), sessionId);
        deindex(sessionsBySid, record.getSid(), sessionId);
        deindex(sessionsByFid, record.getFid(), sessionId);
    }

    public int forceDisconnectByJti(String jti, String reason, String requestId, String sourceNodeId) {
        return disconnectIndexed(sessionsByJti.get(jti), reason, requestId, sourceNodeId, "jti", jti);
    }

    public int forceDisconnectBySession(String sid, String reason, String requestId, String sourceNodeId) {
        return disconnectIndexed(sessionsBySid.get(sid), reason, requestId, sourceNodeId, "sid", sid);
    }

    public int forceDisconnectByFamily(String fid, String reason, String requestId, String sourceNodeId) {
        return disconnectIndexed(sessionsByFid.get(fid), reason, requestId, sourceNodeId, "fid", fid);
    }

    public int forceDisconnectByUser(String userId, String reason, String requestId, String sourceNodeId) {
        return disconnectIndexed(sessionsByUser.get(userId), reason, requestId, sourceNodeId, "userId", userId);
    }

    private int disconnectIndexed(Set<String> sessionIds, String reason, String requestId, String sourceNodeId, String scope, String scopeValue) {
        if (sessionIds == null || sessionIds.isEmpty()) return 0;
        int closed = 0;
        for (String sessionId : sessionIds.toArray(new String[0])) {
            SessionRecord record = sessionsById.get(sessionId);
            if (record == null) continue;
            WebSocketSession session = record.getSession();
            if (session == null || !session.isOpen()) {
                unregister(sessionId);
                continue;
            }
            try {
                session.close(CloseStatus.POLICY_VIOLATION);
                closed++;
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("wsSessionId", sessionId);
                payload.put("scope", scope);
                payload.put("scopeValue", safe(scopeValue));
                payload.put("reason", safe(reason));
                payload.put("userId", safe(record.getUserId()));
                payload.put("jti", safe(record.getJti()));
                payload.put("sid", safe(record.getSid()));
                payload.put("fid", safe(record.getFid()));
                payload.put("requestId", safe(requestId));
                payload.put("sourceNodeId", safe(sourceNodeId));
                payload.put("nodeId", safe(nodeId));
                securityEventLogger.warn("websocket_forced_disconnect", payload);
            } catch (IOException ex) {
                log.warn("Failed to close websocket session {} due to {}", sessionId, ex.getMessage());
            } finally {
                unregister(sessionId);
            }
        }
        return closed;
    }

    private void index(Map<String, Set<String>> index, String key, String sessionId) {
        if (key == null || key.isBlank()) return;
        index.computeIfAbsent(key, ignored -> ConcurrentHashMap.newKeySet()).add(sessionId);
    }

    private void deindex(Map<String, Set<String>> index, String key, String sessionId) {
        if (key == null || key.isBlank()) return;
        Set<String> set = index.get(key);
        if (set == null) return;
        set.remove(sessionId);
        if (set.isEmpty()) {
            index.remove(key);
        }
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    public record AuthContext(
            String userId,
            String userEmail,
            String jti,
            String sid,
            String fid,
            String deviceId,
            String requestId
    ) {}

    @Getter
    private static class SessionRecord {
        private final String sessionId;
        private final String nodeId;
        private WebSocketSession session;
        private Instant connectedAt;
        private String userId;
        private String userEmail;
        private String jti;
        private String sid;
        private String fid;
        private String deviceId;
        private String requestId;

        private SessionRecord(String sessionId, WebSocketSession session, String nodeId) {
            this.sessionId = sessionId;
            this.session = session;
            this.nodeId = nodeId;
            this.connectedAt = Instant.now();
        }

        static SessionRecord transportOnly(String sessionId, WebSocketSession session, String nodeId) {
            return new SessionRecord(sessionId, session, nodeId);
        }

        void setSession(WebSocketSession session) {
            this.session = session;
        }

        void setConnectedAt(Instant connectedAt) {
            this.connectedAt = connectedAt;
        }

        void setUserId(String userId) {
            this.userId = userId;
        }

        void setUserEmail(String userEmail) {
            this.userEmail = userEmail;
        }

        void setJti(String jti) {
            this.jti = jti;
        }

        void setSid(String sid) {
            this.sid = sid;
        }

        void setFid(String fid) {
            this.fid = fid;
        }

        void setDeviceId(String deviceId) {
            this.deviceId = deviceId;
        }

        void setRequestId(String requestId) {
            this.requestId = requestId;
        }
    }
}
