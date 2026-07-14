CREATE TABLE IF NOT EXISTS inventories (
    id BIGSERIAL PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL UNIQUE,
    available_stock INTEGER NOT NULL DEFAULT 0 CHECK (available_stock >= 0),
    reserved_stock INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
    packed_stock INTEGER NOT NULL DEFAULT 0 CHECK (packed_stock >= 0),
    in_transit_stock INTEGER NOT NULL DEFAULT 0 CHECK (in_transit_stock >= 0),
    returned_stock INTEGER NOT NULL DEFAULT 0 CHECK (returned_stock >= 0),
    damaged_stock INTEGER NOT NULL DEFAULT 0 CHECK (damaged_stock >= 0),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventories_available_stock ON inventories(available_stock);

INSERT INTO inventories (product_id, available_stock, reserved_stock, packed_stock, in_transit_stock, returned_stock, damaged_stock)
SELECT p.product_id,
       GREATEST(COALESCE(p.stock_quantity, 0), 0),
       0, 0, 0, 0, 0
FROM products p
ON CONFLICT (product_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS inventory_reservations (
    id BIGSERIAL PRIMARY KEY,
    reservation_code VARCHAR(64) NOT NULL UNIQUE,
    order_number VARCHAR(64) NOT NULL,
    user_id UUID,
    status VARCHAR(24) NOT NULL,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    released_at TIMESTAMP WITHOUT TIME ZONE,
    release_reason VARCHAR(120),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order_number ON inventory_reservations(order_number);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_status_expires ON inventory_reservations(status, expires_at);

CREATE TABLE IF NOT EXISTS inventory_reservation_items (
    id BIGSERIAL PRIMARY KEY,
    reservation_id BIGINT NOT NULL REFERENCES inventory_reservations(id) ON DELETE CASCADE,
    product_id VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservation_items_reservation_id ON inventory_reservation_items(reservation_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservation_items_product_id ON inventory_reservation_items(product_id);

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id BIGSERIAL PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL,
    reservation_code VARCHAR(64),
    order_number VARCHAR(64),
    transaction_type VARCHAR(40) NOT NULL,
    quantity INTEGER NOT NULL,
    before_available_stock INTEGER NOT NULL,
    after_available_stock INTEGER NOT NULL,
    before_reserved_stock INTEGER NOT NULL,
    after_reserved_stock INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product_created ON inventory_transactions(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_order_number ON inventory_transactions(order_number);
