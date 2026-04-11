-- =====================================================
-- Add indexes for Admin Orders tab filters
-- Run this on existing databases (MySQL)
-- If an index already exists, MySQL may throw a duplicate-name error.
-- =====================================================

USE mydb;

CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_order_payment_created ON orders(order_status, payment_status, created_at);
