-- Demo catalog so GET /api/products is not empty on fresh Postgres (e.g. Render).
-- Safe to re-run: skips rows that already exist.

INSERT INTO products (product_id, front_img, back_img, product_name, product_price, product_reviews, stock_quantity, active, created_at, updated_at)
VALUES
    ('1', '/Products/product_1.jpg', '/Products/product_1-1.jpg', 'Cropped Faux Leather Jacket', 29, '8k+ reviews', 25, TRUE, NOW(), NOW()),
    ('2', '/Products/product_2.jpg', '/Products/product_2-1.jpg', 'Calvin Shorts', 62, '2k+ reviews', 25, TRUE, NOW(), NOW()),
    ('3', '/Products/product_3.jpg', '/Products/product_3-1.jpg', 'Shirt In Botanical Cheetah Print', 60, '7k+ reviews', 25, TRUE, NOW(), NOW()),
    ('4', '/Products/product_4.jpg', '/Products/product_4-1.jpg', 'Cotton Jersey T-Shirt', 17, '5k+ reviews', 25, TRUE, NOW(), NOW()),
    ('5', '/Products/product_5.jpg', '/Products/product_5-1.jpg', 'Cableknit Shawl', 100, '9k+ reviews', 25, TRUE, NOW(), NOW()),
    ('6', '/Products/product_6.jpg', '/Products/product_6-1.jpg', 'Colorful Jacket', 69, '1k+ reviews', 25, TRUE, NOW(), NOW()),
    ('7', '/Products/product_7.jpg', '/Products/product_7-1.jpg', 'Zessi Dresses', 99, '3k+ reviews', 25, TRUE, NOW(), NOW()),
    ('8', '/Products/product_8.jpg', '/Products/product_8-1.jpg', 'Kirby T-Shirt', 37, '4k+ reviews', 25, TRUE, NOW(), NOW()),
    ('9', '/LimitedEdition/limited-1.jpg', NULL, 'Hosking Blue Area Rug', 29, '8k+ reviews', 25, TRUE, NOW(), NOW()),
    ('10', '/LimitedEdition/limited-2.jpg', NULL, 'Hanneman Pouf', 92, '5k+ reviews', 25, TRUE, NOW(), NOW()),
    ('11', '/LimitedEdition/limited-3.jpg', NULL, 'Cushion Futon Slipcover', 25, '1k+ reviews', 25, TRUE, NOW(), NOW()),
    ('12', '/LimitedEdition/limited-4.jpg', NULL, 'Hub Accent Mirror', 27, '7k+ reviews', 25, TRUE, NOW(), NOW()),
    ('13', '/LimitedEdition/limited-5.jpg', NULL, 'Bold Male Black Analog', 39, '71+ reviews', 25, TRUE, NOW(), NOW())
ON CONFLICT (product_id) DO NOTHING;
