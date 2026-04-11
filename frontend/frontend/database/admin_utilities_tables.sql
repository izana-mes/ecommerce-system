-- Admin Utility Tables Migration
-- Run this script against your PostgreSQL database

-- Admin Notes
CREATE TABLE IF NOT EXISTS admin_notes (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Admin Settings (key-value store)
CREATE TABLE IF NOT EXISTS admin_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(128) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL DEFAULT '',
  description VARCHAR(512) NOT NULL DEFAULT '',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed default settings
INSERT INTO admin_settings (setting_key, setting_value, description) VALUES
  ('store_name', 'My Store', 'Name displayed in storefront and emails'),
  ('default_currency', 'USD', 'Default currency code for pricing'),
  ('low_stock_threshold', '5', 'Products at or below this stock level trigger low-stock alerts'),
  ('contact_email', 'admin@example.com', 'Primary contact email for the store'),
  ('maintenance_mode', 'false', 'Set to true to enable maintenance mode on storefront'),
  ('items_per_page', '10', 'Default pagination size for admin tables'),
  ('order_notification_email', 'admin@example.com', 'Email address to receive new order notifications'),
  ('max_upload_size_mb', '5', 'Maximum file upload size in megabytes')
ON CONFLICT (setting_key) DO NOTHING;
