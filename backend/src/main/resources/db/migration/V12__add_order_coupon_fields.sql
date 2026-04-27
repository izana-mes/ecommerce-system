ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS coupon_assignment_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_orders_coupon_code ON orders(coupon_code);
