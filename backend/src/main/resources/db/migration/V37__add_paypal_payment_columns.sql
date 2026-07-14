-- V37: Add PayPal-specific columns to the payments table
-- Stores the PayPal Order ID, capture ID, payer email for audit/reconciliation.
-- The payments.metadata JSONB column already stores the full capture response;
-- these columns provide indexed, queryable access to the most important fields.

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS paypal_order_id  VARCHAR(50)  NULL,
    ADD COLUMN IF NOT EXISTS paypal_capture_id VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS payer_email       VARCHAR(255) NULL;

CREATE INDEX IF NOT EXISTS idx_payments_paypal_order_id
    ON payments (paypal_order_id)
    WHERE paypal_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_paypal_capture_id
    ON payments (paypal_capture_id)
    WHERE paypal_capture_id IS NOT NULL;

-- Add PayPal to the routing-key idempotency event table index for faster look-ups.
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_provider_created
    ON payment_webhook_events (provider, created_at DESC);
