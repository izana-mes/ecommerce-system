CREATE TABLE customer_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
    dedupe_key VARCHAR(200) NOT NULL,
    category VARCHAR(32) NOT NULL,
    title VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    target_url VARCHAR(300),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITHOUT TIME ZONE,
    CONSTRAINT uq_customer_notification_dedupe UNIQUE (dedupe_key)
);
CREATE INDEX idx_customer_notification_user_created ON customer_notifications(user_id, created_at DESC);
