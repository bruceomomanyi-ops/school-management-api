// Seed Admin User Script
// Run this to create a default admin account

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const dbConfig = process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
} : {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'myuser',
    password: process.env.DB_PASSWORD || 'MyStrongPass123!',
    database: process.env.DB_NAME || 'school_management',
    port: process.env.DB_PORT || 5432
};

const pool = new Pool(dbConfig);

async function seedAdmin() {
    try {
        console.log('🔄 Creating admin user...');
        
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, role) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = $3
             RETURNING user_id, email, role`,
            ['admin@school.com', hashedPassword, 'admin']
        );
        
        console.log('✅ Admin user created!');
        console.log('Email: admin@school.com');
        console.log('Password: admin123');
        console.log('Role: admin');
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

seedAdmin();
