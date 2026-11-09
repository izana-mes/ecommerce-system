-- V60: Explicit allow_resale setting for Supplier Products
ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS allow_resale BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE supplier_products SET allow_resale = available;
CREATE INDEX IF NOT EXISTS idx_supplier_products_allow_resale ON supplier_products (approved, allow_resale, product_id);
