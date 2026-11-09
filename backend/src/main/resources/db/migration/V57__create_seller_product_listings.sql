-- V57: Seller product listings
-- A Seller's own storefront listing referencing a Supplier product.
-- The Seller does NOT own the source product; they own this listing only.
-- Requires a valid seller_resale_authorization to create or activate.
--
-- Supplier-owned (read-only for Seller): productName, frontImg, backImg, category (source)
-- Seller-managed: custom_title (optional override), retail_price, active

CREATE TABLE IF NOT EXISTS seller_product_listings (
    id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    authorization_id        UUID         NOT NULL REFERENCES seller_resale_authorizations(id) ON DELETE RESTRICT,
    supplier_product_id     VARCHAR(50)  NOT NULL,
    seller_user_id          UUID         NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
    supplier_user_id        UUID         NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
    -- Seller-managed fields
    custom_title            VARCHAR(255),
    retail_price            NUMERIC(12,2) NOT NULL,
    active                  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_listing_product FOREIGN KEY (supplier_product_id)
        REFERENCES products(product_id) ON DELETE RESTRICT,

    -- One listing per Seller/Product (can deactivate, not duplicate)
    CONSTRAINT uq_listing_seller_product UNIQUE (seller_user_id, supplier_product_id)
);

CREATE INDEX IF NOT EXISTS idx_listing_seller_active
    ON seller_product_listings(seller_user_id, active);

CREATE INDEX IF NOT EXISTS idx_listing_product
    ON seller_product_listings(supplier_product_id, active);

CREATE INDEX IF NOT EXISTS idx_listing_authorization
    ON seller_product_listings(authorization_id);
