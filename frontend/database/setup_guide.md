# MySQL Workbench Database Setup Guide

## Step-by-Step Instructions

### 1. Open MySQL Workbench

1. Launch MySQL Workbench
2. Connect to your MySQL server (usually `localhost` or `127.0.0.1`)
3. Enter your MySQL username and password

### 2. Create the Database

**Option A: Using the SQL Script (Recommended)**

1. In MySQL Workbench, go to **File** → **Open SQL Script**
2. Navigate to `database/create_database.sql`
3. Open the file
4. Click the **Execute** button (lightning bolt icon) or press `Ctrl+Shift+Enter`
5. Verify the tables were created by checking the "Result Grid" panel

**Option B: Manual Creation**

1. Click on **Server** → **Data Import**
2. Or simply execute this in a new query tab:

```sql
CREATE DATABASE IF NOT EXISTS mydb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mydb;
```

Then copy and paste the table creation SQL from `create_database.sql`

### 3. Verify Database Creation

Execute this query to see all tables:

```sql
USE mydb;
SHOW TABLES;
```

You should see:
- `users`
- `cart_items`
- `wishlist_items`
- `orders`
- `order_items`
- `payments`

### 4. Check Table Structures

To verify the table structures are correct:

```sql
DESCRIBE users;
DESCRIBE cart_items;
DESCRIBE wishlist_items;
DESCRIBE orders;
DESCRIBE order_items;
DESCRIBE payments;
```

### 5. Update Your Environment Variables

Make sure your `.env.local` file has the correct database credentials:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=mydb
```

## Database Tables Overview

### 1. `users` Table
- Stores user accounts (both regular users and admins)
- Passwords are hashed with bcrypt
- Role field distinguishes between 'user' and 'admin'

### 2. `cart_items` Table
- Stores shopping cart items
- Each product can have a quantity
- Automatically synced with Redux state

### 3. `wishlist_items` Table
- Stores wishlist items
- Each product appears once per wishlist
- Automatically synced with Redux state

### 4. `orders` Table
- Stores checkout orders
- Includes totals, shipping, status, and payment method

### 5. `order_items` Table
- Stores product lines for each order
- Linked to `orders.id` via foreign key

### 6. `payments` Table
- Stores payment transaction state for each order
- Supports pending/paid/failed/refunded lifecycle

## Creating a Test Admin User

After the database is created, you can create an admin user using the API:

**Using API:**
```bash
POST http://localhost:3000/api/auth/admin
Content-Type: application/json

{
  "username": "admin",
  "email": "admin@example.com",
  "password": "admin123",
  "firstName": "Admin",
  "lastName": "User"
}
```

**Or manually in MySQL (NOT RECOMMENDED - passwords won't be hashed):**
```sql
-- Only if you hash the password manually using bcrypt
INSERT INTO users (username, email, password, role, first_name, last_name) 
VALUES ('admin', 'admin@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin', 'Admin', 'User');
```

## Troubleshooting

### Error: Access Denied
- Make sure your MySQL user has CREATE DATABASE and CREATE TABLE privileges
- Check your username and password in the connection settings

### Error: Table Already Exists
- The script uses `CREATE TABLE IF NOT EXISTS`, so existing tables won't be overwritten
- If you want to recreate tables, drop them first:
  ```sql
  DROP TABLE IF EXISTS users;
  DROP TABLE IF EXISTS cart_items;
  DROP TABLE IF EXISTS wishlist_items;
  DROP TABLE IF EXISTS payments;
  DROP TABLE IF EXISTS order_items;
  DROP TABLE IF EXISTS orders;
  ```

### Error: Character Set
- Make sure your MySQL server supports utf8mb4
- MySQL 5.5.3+ supports utf8mb4

## Next Steps

1. ✅ Database created
2. ✅ Tables created
3. ✅ Update `.env.local` with database credentials
4. ✅ Start your Next.js application: `npm run dev`
5. ✅ Test registration and login at `/login`

## VNPAY Sandbox Integration

After DB setup, add VNPAY config in `.env.local` (you can copy from `.env.example`):

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
VNPAY_TMN_CODE=your_vnp_tmn_code
VNPAY_HASH_SECRET=your_vnp_hash_secret
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:3000/payment/vnpay-return
VNPAY_IPN_URL=http://localhost:3000/api/vnpay/ipn
```

- Return URL route in this project: `/payment/vnpay-return`
- IPN URL route in this project: `/api/vnpay/ipn`
- For VNPAY SIT/IPN testing, local URL must be public (use tunnel like ngrok/cloudflared).

## PostgreSQL Note

If you are using PostgreSQL instead of MySQL:

1. Set `DB_CLIENT=postgres` and `DB_PORT=5432` in `.env.local`.
2. Run PostgreSQL schema file:
   - `database/create_order_payment_tables_postgres.sql`

## Security Notes

- **NEVER** commit your `.env.local` file to version control
- Change default passwords immediately
- In production, use strong passwords and restrict database access
- Consider using environment-specific databases for dev/staging/production
