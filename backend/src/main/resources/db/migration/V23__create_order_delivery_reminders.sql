CREATE TABLE IF NOT EXISTS order_delivery_reminders (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    reminder_day INTEGER NOT NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_order_delivery_reminders_order_day UNIQUE (order_id, reminder_day)
);

CREATE INDEX IF NOT EXISTS idx_order_delivery_reminders_order_id
    ON order_delivery_reminders (order_id);
