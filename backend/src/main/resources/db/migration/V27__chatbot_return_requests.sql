-- Chatbot-initiated return requests table
-- Created by the MCP chatbot tool layer. Staff review these in the admin panel.
CREATE TABLE IF NOT EXISTS chatbot_return_requests (
    id           BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(80)  NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    reason       TEXT         NOT NULL,
    status       VARCHAR(30)  NOT NULL DEFAULT 'PENDING',
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crr_order_number    ON chatbot_return_requests (order_number);
CREATE INDEX IF NOT EXISTS idx_crr_customer_email  ON chatbot_return_requests (LOWER(customer_email));
