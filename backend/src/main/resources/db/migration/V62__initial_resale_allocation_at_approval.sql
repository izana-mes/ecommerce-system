ALTER TABLE seller_resale_authorizations
    ADD COLUMN initial_allocation_quantity INTEGER NOT NULL DEFAULT 0 CHECK (initial_allocation_quantity >= 0);

-- Existing approved partnerships retain their listing allocation. Partnerships
-- without a listing receive zero so they do not silently claim inventory.
