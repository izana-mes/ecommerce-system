ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS tracking_secret VARCHAR(64) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_tracking_secret
    ON orders (tracking_secret)
    WHERE tracking_secret IS NOT NULL;
