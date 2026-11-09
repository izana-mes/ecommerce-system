-- Extend customer_notifications with related_entity_id and performance indexes
ALTER TABLE customer_notifications
ADD COLUMN IF NOT EXISTS related_entity_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_user_unread
ON customer_notifications(user_id, read_at)
WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_notifications_user_category
ON customer_notifications(user_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_user_read_created
ON customer_notifications(user_id, read_at, created_at DESC);
