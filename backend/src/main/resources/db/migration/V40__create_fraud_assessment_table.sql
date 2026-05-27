CREATE TABLE IF NOT EXISTS fraud_order_assessments (
    order_id BIGINT PRIMARY KEY,
    order_number VARCHAR(40) NOT NULL,
    customer_email VARCHAR(255),
    payment_method VARCHAR(50),
    currency CHAR(3),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    risk_score INTEGER NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    manual_review_required BOOLEAN NOT NULL DEFAULT FALSE,
    risk_reasons TEXT,
    assessed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fraud_assessments_manual_review
    ON fraud_order_assessments (manual_review_required, assessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_fraud_assessments_risk_level
    ON fraud_order_assessments (risk_level, assessed_at DESC);
