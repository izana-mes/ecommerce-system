-- Fulfillment visibility for shippers; supplier ownership for catalog APIs.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_carrier VARCHAR(120);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_tracking_public VARCHAR(120);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP WITHOUT TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_queue
    ON orders (payment_status, order_status)
    WHERE payment_status = 'paid' AND LOWER(order_status) IN ('paid', 'processing');

ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_user_id UUID REFERENCES users (users_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_supplier_user_id ON products (supplier_user_id);
