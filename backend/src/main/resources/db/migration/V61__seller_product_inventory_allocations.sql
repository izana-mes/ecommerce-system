-- Per seller allocation for supplier resale listings. Existing listings receive a
-- conservative split of unreserved supplier stock so aggregate allocations never
-- exceed the stock available at migration time.
CREATE TABLE seller_product_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL UNIQUE REFERENCES seller_product_listings(id) ON DELETE RESTRICT,
    supplier_offer_id UUID NOT NULL REFERENCES supplier_products(id) ON DELETE RESTRICT,
    seller_user_id UUID NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
    supplier_user_id UUID NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
    allocated_quantity INTEGER NOT NULL CHECK (allocated_quantity >= 0),
    sold_quantity INTEGER NOT NULL DEFAULT 0 CHECK (sold_quantity >= 0),
    reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_allocation_committed CHECK (sold_quantity + reserved_quantity <= allocated_quantity)
);
CREATE INDEX idx_seller_allocation_supplier ON seller_product_allocations(supplier_user_id, supplier_offer_id);
CREATE INDEX idx_seller_allocation_seller ON seller_product_allocations(seller_user_id, status);
CREATE TABLE seller_product_allocation_audit (
    id BIGSERIAL PRIMARY KEY,
    allocation_id UUID NOT NULL REFERENCES seller_product_allocations(id) ON DELETE RESTRICT,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    supplier_user_id UUID NOT NULL REFERENCES users(users_id),
    reason TEXT,
    changed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO seller_product_allocations(listing_id, supplier_offer_id, seller_user_id, supplier_user_id, allocated_quantity)
SELECT l.id, l.supplier_offer_id, l.seller_user_id, l.supplier_user_id,
       FLOOR(GREATEST(sp.stock_quantity - sp.reserved_quantity, 0)::NUMERIC /
         GREATEST((SELECT COUNT(*) FROM seller_product_listings l2 WHERE l2.supplier_offer_id = sp.id AND l2.active), 1))::INTEGER
FROM seller_product_listings l JOIN supplier_products sp ON sp.id = l.supplier_offer_id
WHERE l.active ON CONFLICT (listing_id) DO NOTHING;
ALTER TABLE inventory_reservation_items ADD COLUMN seller_listing_id UUID REFERENCES seller_product_listings(id) ON DELETE RESTRICT;
