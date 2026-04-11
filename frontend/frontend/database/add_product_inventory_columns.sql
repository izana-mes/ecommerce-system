-- =====================================================
-- Add product inventory columns (MySQL)
-- =====================================================

USE mydb;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_quantity INT NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX idx_products_stock_quantity ON products(stock_quantity);
CREATE INDEX idx_products_active ON products(active);
