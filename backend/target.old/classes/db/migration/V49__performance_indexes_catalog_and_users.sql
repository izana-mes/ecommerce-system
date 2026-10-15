-- Performance Indexes for Catalog, Search, and User lookups
-- Avoid full table scans on products and users

CREATE INDEX IF NOT EXISTS idx_products_active_id 
    ON products(active, id ASC);

CREATE INDEX IF NOT EXISTS idx_products_seller_active_stock 
    ON products(seller_user_id, active, stock_quantity ASC);

CREATE INDEX IF NOT EXISTS idx_products_supplier_active_stock 
    ON products(supplier_user_id, active, stock_quantity ASC);

CREATE INDEX IF NOT EXISTS idx_products_category_active 
    ON products(category, active);

CREATE INDEX IF NOT EXISTS idx_users_email_lower 
    ON users(LOWER(email));
