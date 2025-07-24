// config/database.js
const sql = require('mssql');
require('dotenv').config();

const config = {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE || 'SchoolWebsite',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true', // Use true for Azure
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true', // Use true for local dev
        enableArithAbort: true,
        connectionTimeout: 30000,
        requestTimeout: 30000
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool;

async function connectDB() {
    try {
        if (pool) {
            return pool;
        }
        
        pool = await sql.connect(config);
        console.log('Connected to MSSQL database');
        
        // Test the connection
        await pool.request().query('SELECT 1 as test');
        console.log('Database connection test successful');
        
        return pool;
    } catch (err) {
        console.error('Database connection failed:', err);
        throw err;
    }
}

function getPool() {
    if (!pool) {
        throw new Error('Database not connected. Call connectDB() first.');
    }
    return pool;
}

async function closeDB() {
    try {
        if (pool) {
            await pool.close();
            pool = null;
            console.log('Database connection closed');
        }
    } catch (err) {
        console.error('Error closing database connection:', err);
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    await closeDB();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await closeDB();
    process.exit(0);
});

module.exports = {
    connectDB,
    getPool,
    closeDB,
    sql
};