ALTER TABLE products
ADD COLUMN IF NOT EXISTS category VARCHAR(80);

UPDATE products
SET category = CASE
    WHEN product_name ILIKE '%jacket%' THEN 'Jackets'
    WHEN product_name ILIKE '%dress%' THEN 'Dresses'
    WHEN product_name ILIKE '%short%' THEN 'Shorts'
    WHEN product_name ILIKE '%t-shirt%' OR product_name ILIKE '%shirt%' THEN 'Tops'
    WHEN product_name ILIKE '%shawl%' OR product_name ILIKE '%slipcover%' THEN 'Knitwear'
    WHEN product_name ILIKE '%rug%' OR product_name ILIKE '%pouf%' OR product_name ILIKE '%mirror%' THEN 'Home Decor'
    WHEN product_name ILIKE '%analog%' OR product_name ILIKE '%watch%' THEN 'Accessories'
    ELSE 'Clothing'
END
WHERE category IS NULL OR BTRIM(category) = '';

ALTER TABLE products
ALTER COLUMN category SET DEFAULT 'Uncategorized';

UPDATE products
SET category = 'Uncategorized'
WHERE category IS NULL OR BTRIM(category) = '';

ALTER TABLE products
ALTER COLUMN category SET NOT NULL;
