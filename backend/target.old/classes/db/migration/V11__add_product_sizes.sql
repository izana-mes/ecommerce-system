ALTER TABLE products
    ADD COLUMN IF NOT EXISTS sizes TEXT;

UPDATE products
SET sizes = 'XS,S,M,L,XL'
WHERE sizes IS NULL OR BTRIM(sizes) = '';
