// Test MySQL Database Connection
require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'myuser',
    password: process.env.DB_PASSWORD || 'MyStrongPass123!',
    database: process.env.DB_NAME || 'school_management',
};

async function testConnection() {
    let connection;
    try {
        console.log('🔄 Attempting to connect to MySQL...');
        console.log('Config:', {
            host: dbConfig.host,
            user: dbConfig.user,
            database: dbConfig.database,
        });

        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Successfully connected to MySQL database!');

        // Test query
        const [rows] = await connection.query('SELECT 1 as test');
        console.log('✅ Test query successful:', rows);

        // Check if database exists
        const [databases] = await connection.query("SHOW DATABASES LIKE 'school_management'");
        if (databases.length > 0) {
            console.log('✅ Database "school_management" exists');
        } else {
            console.log('⚠️  Database "school_management" does not exist yet');
            console.log('   Run: mysql -u myuser -p < database/schema.sql');
        }

        return true;
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
        if (err.code === 'ECONNREFUSED') {
            console.error('   MySQL server is not running or wrong port');
        } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('   Wrong username or password');
        } else if (err.code === 'ER_BAD_DB_ERROR') {
            console.error('   Database does not exist');
        }
        return false;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

testConnection();
