-- Existing suppliers remain supply only unless attributable direct retail sales are verified.
ALTER TABLE users ADD COLUMN IF NOT EXISTS supplier_operating_mode VARCHAR(24) NOT NULL DEFAULT 'SUPPLY_ONLY';
ALTER TABLE users ADD CONSTRAINT chk_supplier_operating_mode
    CHECK (supplier_operating_mode IN ('SUPPLY_ONLY', 'SUPPLY_AND_SELL'));

ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR(160);
CREATE INDEX IF NOT EXISTS idx_products_sku_lower ON products (LOWER(sku));
CREATE INDEX IF NOT EXISTS idx_products_brand_lower ON products (LOWER(brand));

ALTER TABLE supplier_resale_catalog_flags ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(12,2);
ALTER TABLE supplier_resale_catalog_flags ADD COLUMN IF NOT EXISTS minimum_order_quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE supplier_resale_catalog_flags ADD COLUMN IF NOT EXISTS supplier_product_approved BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE supplier_resale_catalog_flags ADD CONSTRAINT chk_supplier_resale_moq CHECK (minimum_order_quantity > 0);
-- Preserve existing explicit supplier opt-ins where the global product is active/approved.
UPDATE supplier_resale_catalog_flags f SET supplier_product_approved = TRUE
FROM products p WHERE p.product_id = f.product_id AND p.active = TRUE AND f.resale_enabled = TRUE;
-- Before V58 the Supplier-owned Product price was the displayed supplier-side price in Seller discovery.
UPDATE supplier_resale_catalog_flags f SET wholesale_price = p.product_price::NUMERIC(12,2)
FROM products p WHERE p.product_id = f.product_id AND f.resale_enabled = TRUE AND f.wholesale_price IS NULL;

ALTER TABLE seller_resale_requests DROP CONSTRAINT IF EXISTS chk_resale_request_status;
UPDATE seller_resale_requests SET status = 'APPROVED' WHERE status = 'ACCEPTED';
ALTER TABLE seller_resale_requests ADD CONSTRAINT chk_resale_request_status
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'));
