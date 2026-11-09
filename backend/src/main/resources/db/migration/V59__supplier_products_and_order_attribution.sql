-- Supplier-owned wholesale offers have inventory independent from the global catalog.
CREATE TABLE supplier_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR(50) NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    supplier_user_id UUID NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
    supplier_sku VARCHAR(100),
    wholesale_price NUMERIC(12,2) NOT NULL CHECK (wholesale_price > 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0 AND reserved_quantity <= stock_quantity),
    minimum_order_quantity INTEGER NOT NULL DEFAULT 1 CHECK (minimum_order_quantity > 0),
    approved BOOLEAN NOT NULL DEFAULT FALSE,
    available BOOLEAN NOT NULL DEFAULT FALSE,
    supply_terms TEXT,
    direct_retail_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    direct_retail_price NUMERIC(12,2),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_supplier_product UNIQUE (supplier_user_id, product_id)
);
CREATE UNIQUE INDEX uq_supplier_sku ON supplier_products(supplier_user_id, LOWER(supplier_sku)) WHERE supplier_sku IS NOT NULL;
CREATE INDEX idx_supplier_products_catalog ON supplier_products(approved, available, product_id);

ALTER TABLE seller_resale_requests ADD COLUMN supplier_offer_id UUID REFERENCES supplier_products(id) ON DELETE RESTRICT;
ALTER TABLE seller_resale_authorizations ADD COLUMN supplier_offer_id UUID REFERENCES supplier_products(id) ON DELETE RESTRICT;

-- Conservative data migration: only explicitly opted-in, already approved offers are distributable.
INSERT INTO supplier_products(product_id, supplier_user_id, supplier_sku, wholesale_price,
    stock_quantity, minimum_order_quantity, approved, available, supply_terms)
SELECT p.product_id, p.supplier_user_id,
       CASE WHEN p.sku IS NULL OR (SELECT COUNT(*) FROM products p2 WHERE p2.supplier_user_id = p.supplier_user_id AND LOWER(p2.sku) = LOWER(p.sku)) = 1 THEN p.sku ELSE NULL END,
       COALESCE(f.wholesale_price, p.product_price::NUMERIC(12,2)),
       GREATEST(COALESCE(p.stock_quantity, 0), 0), GREATEST(COALESCE(f.minimum_order_quantity, 1), 1),
       COALESCE(f.supplier_product_approved, FALSE),
       COALESCE(f.resale_enabled, FALSE), f.commercial_note
FROM products p
LEFT JOIN supplier_resale_catalog_flags f ON f.product_id = p.product_id
WHERE p.supplier_user_id IS NOT NULL AND p.product_price > 0
ON CONFLICT (supplier_user_id, product_id) DO NOTHING;

-- An active legacy listing backed by an active approved authorization is historical proof
-- of Seller distribution permission; retain that eligibility after moving to offer rows.
UPDATE supplier_products sp SET approved = TRUE, available = TRUE
FROM seller_product_listings l
JOIN seller_resale_authorizations a ON a.id = l.authorization_id
WHERE l.supplier_product_id = sp.product_id AND l.supplier_user_id = sp.supplier_user_id
  AND l.active = TRUE AND a.is_active = TRUE;

ALTER TABLE seller_product_listings ADD COLUMN supplier_offer_id UUID REFERENCES supplier_products(id) ON DELETE RESTRICT;
ALTER TABLE seller_product_listings DROP CONSTRAINT uq_listing_seller_product;
UPDATE seller_product_listings l SET supplier_offer_id = sp.id
FROM supplier_products sp
WHERE l.supplier_product_id = sp.product_id AND l.supplier_user_id = sp.supplier_user_id;
UPDATE seller_resale_requests r SET supplier_offer_id = sp.id
FROM supplier_products sp WHERE r.supplier_product_id = sp.product_id AND r.supplier_user_id = sp.supplier_user_id;
UPDATE seller_resale_authorizations a SET supplier_offer_id = r.supplier_offer_id
FROM seller_resale_requests r WHERE a.resale_request_id = r.id;
UPDATE seller_product_listings l SET supplier_offer_id = a.supplier_offer_id
FROM seller_resale_authorizations a WHERE l.authorization_id = a.id AND l.supplier_offer_id IS NULL;
CREATE INDEX idx_listing_supplier_offer ON seller_product_listings(supplier_offer_id, active);
CREATE UNIQUE INDEX uq_listing_seller_offer ON seller_product_listings(seller_user_id, supplier_offer_id) WHERE supplier_offer_id IS NOT NULL;
CREATE UNIQUE INDEX uq_listing_seller_legacy_product ON seller_product_listings(seller_user_id, supplier_product_id) WHERE supplier_offer_id IS NULL;

ALTER TABLE order_items ADD COLUMN seller_listing_id UUID REFERENCES seller_product_listings(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN supplier_offer_id UUID REFERENCES supplier_products(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN seller_user_id UUID REFERENCES users(users_id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN supplier_user_id UUID REFERENCES users(users_id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN sale_channel VARCHAR(24);
ALTER TABLE order_items ADD COLUMN supplier_unit_price NUMERIC(12,2);
ALTER TABLE order_items ADD COLUMN supplier_line_total NUMERIC(12,2);
CREATE INDEX idx_order_items_seller ON order_items(seller_user_id, order_id);
CREATE INDEX idx_order_items_supplier ON order_items(supplier_user_id, order_id);

ALTER TABLE inventory_reservation_items ADD COLUMN supplier_offer_id UUID REFERENCES supplier_products(id) ON DELETE RESTRICT;
CREATE INDEX idx_reservation_items_supplier_offer ON inventory_reservation_items(supplier_offer_id);
