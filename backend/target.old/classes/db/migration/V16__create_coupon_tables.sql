CREATE TABLE IF NOT EXISTS coupons (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL,
    discount_value NUMERIC(10, 2) NOT NULL,
    min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    max_discount_amount NUMERIC(10, 2),
    usage_limit INTEGER,
    usage_count INTEGER NOT NULL DEFAULT 0,
    starts_at TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS coupon_assignments (
    id BIGSERIAL PRIMARY KEY,
    coupon_id BIGINT NOT NULL REFERENCES coupons (id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    notification_title VARCHAR(160),
    notification_message TEXT,
    issued_by_email VARCHAR(255),
    issued_at TIMESTAMP NOT NULL,
    acknowledged_at TIMESTAMP,
    used_at TIMESTAMP,
    used_order_id BIGINT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coupon_assignments_coupon_user_issued
    ON coupon_assignments (coupon_id, user_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_coupon_assignments_user_issued
    ON coupon_assignments (user_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_coupon_assignments_used_order
    ON coupon_assignments (used_order_id);
