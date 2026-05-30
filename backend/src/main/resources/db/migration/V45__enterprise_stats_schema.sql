-- V45: Enterprise Statistics Schema (Warehouses and Trusted Partners)

CREATE TABLE IF NOT EXISTS warehouses (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    location VARCHAR(255) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 1000,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trusted_partners (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    partner_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optimize counts and aggregations
CREATE INDEX IF NOT EXISTS idx_orders_payment_total ON orders (payment_status, total_amount);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);

-- Seed Warehouses
INSERT INTO warehouses (name, location, capacity) VALUES
('North America Distribution Hub', 'Chicago, IL, USA', 50000)
ON CONFLICT (name) DO NOTHING;

INSERT INTO warehouses (name, location, capacity) VALUES
('European Logistics Center', 'Rotterdam, Netherlands', 45000)
ON CONFLICT (name) DO NOTHING;

INSERT INTO warehouses (name, location, capacity) VALUES
('Asia-Pacific Gateway', 'Singapore', 60000)
ON CONFLICT (name) DO NOTHING;

INSERT INTO warehouses (name, location, capacity) VALUES
('Latin America Fulfillment Center', 'São Paulo, Brazil', 25000)
ON CONFLICT (name) DO NOTHING;

INSERT INTO warehouses (name, location, capacity) VALUES
('West Coast Overflow', 'Seattle, WA, USA', 15000)
ON CONFLICT (name) DO NOTHING;

INSERT INTO warehouses (name, location, capacity) VALUES
('East Coast Express Depot', 'Newark, NJ, USA', 20000)
ON CONFLICT (name) DO NOTHING;

INSERT INTO warehouses (name, location, capacity) VALUES
('UK Regional Depot', 'London, UK', 18000)
ON CONFLICT (name) DO NOTHING;

INSERT INTO warehouses (name, location, capacity) VALUES
('Oceania fulfillment Centre', 'Sydney, Australia', 12000)
ON CONFLICT (name) DO NOTHING;

-- Seed Trusted Partners
INSERT INTO trusted_partners (name, partner_type, status) VALUES
('Global Express Shipping', 'LOGISTICS', 'ACTIVE'),
('Eco-Pack Solutions', 'SUPPLY_CHAIN', 'ACTIVE'),
('Stripe Payment Gateway', 'FINANCIAL', 'ACTIVE'),
('Paypal Merchant Services', 'FINANCIAL', 'ACTIVE'),
('SendGrid Marketing', 'MARKETING', 'ACTIVE'),
('Twilio Telecommunications', 'TECHNOLOGY', 'ACTIVE'),
('Amazon Web Services', 'INFRASTRUCTURE', 'ACTIVE'),
('Cloudflare CDN', 'INFRASTRUCTURE', 'ACTIVE'),
('Salesforce CRM Integration', 'SOFTWARE', 'ACTIVE'),
('FedEx Freight Services', 'LOGISTICS', 'ACTIVE'),
('DHL Global Forwarding', 'LOGISTICS', 'ACTIVE'),
('Shopify Partner Networks', 'COMMERCE', 'ACTIVE'),
('Google Cloud Analytics', 'TECHNOLOGY', 'ACTIVE'),
('Sentry Error Reporting', 'OPERATIONS', 'ACTIVE'),
('Datadog Monitoring Inc.', 'OPERATIONS', 'ACTIVE')
ON CONFLICT (name) DO NOTHING;
