-- =====================================================
-- Add indexes for Admin Dashboard analytics (PostgreSQL)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_orders_created_status ON orders(created_at, order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_created ON orders(payment_status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_total_amount ON orders(total_amount);

CREATE INDEX IF NOT EXISTS idx_users_active_created ON users(is_active, created_at);
CREATE INDEX IF NOT EXISTS idx_products_active_stock ON products(active, stock_quantity);
