-- =====================================================
-- Add indexes for Admin Orders tab filters (PostgreSQL)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_payment_created ON orders(order_status, payment_status, created_at);
