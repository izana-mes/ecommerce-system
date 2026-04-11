const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Load .env.local if it exists
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  });
}

async function testConnection() {
  let connection;
  
  try {
    console.log('🔍 Testing database connection...\n');
    
    const config = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'mydb',
    };

    console.log('Connection config:');
    console.log(`  Host: ${config.host}`);
    console.log(`  User: ${config.user}`);
    console.log(`  Database: ${config.database}`);
    console.log(`  Password: ${config.password ? '***' : '(not set)'}\n`);

    // Test connection
    connection = await mysql.createConnection(config);
    console.log('✅ Successfully connected to MySQL server!\n');

    // Check if database exists
    const [databases] = await connection.execute(
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMAS WHERE SCHEMA_NAME = ?`,
      [config.database]
    );

    if (databases.length === 0) {
      console.log('⚠️  Database does not exist. Creating database...');
      await connection.execute(`CREATE DATABASE IF NOT EXISTS ${config.database}`);
      await connection.changeUser({ database: config.database });
      console.log('✅ Database created successfully!\n');
    } else {
      await connection.changeUser({ database: config.database });
      console.log('✅ Database exists!\n');
    }

    // Check tables
    console.log('📊 Checking tables...\n');
    const [tables] = await connection.execute('SHOW TABLES');
    
    if (tables.length === 0) {
      console.log('⚠️  No tables found in database.');
      console.log('   Please run the SQL script in MySQL Workbench or let the API create them automatically.\n');
    } else {
      console.log('✅ Found tables:');
      tables.forEach((table) => {
        const tableName = Object.values(table)[0];
        console.log(`   - ${tableName}`);
      });
      console.log('');

      // Check each table structure
      for (const table of tables) {
        const tableName = Object.values(table)[0];
        const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
        console.log(`📋 Table: ${tableName}`);
        console.log(`   Columns: ${columns.length}`);
        columns.forEach(col => {
          console.log(`   - ${col.Field} (${col.Type})`);
        });
        console.log('');
      }

      // Check row counts
      console.log('📈 Table row counts:');
      for (const table of tables) {
        const tableName = Object.values(table)[0];
        const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
        const count = rows[0].count;
        console.log(`   ${tableName}: ${count} row(s)`);
      }
      console.log('');
    }

    console.log('✅ Database connection test completed successfully!');
    console.log('🚀 Your database is ready to use!\n');

  } catch (error) {
    console.error('❌ Database connection failed!');
    console.error('Error:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check if MySQL server is running');
    console.error('   2. Verify your .env.local file has correct credentials:');
    console.error('      DB_HOST=localhost');
    console.error('      DB_USER=root');
    console.error('      DB_PASSWORD=your_password');
    console.error('      DB_NAME=mydb');
    console.error('   3. Make sure the database exists (or create it)');
    console.error('   4. Verify your MySQL user has proper permissions\n');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testConnection();

