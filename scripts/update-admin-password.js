// scripts/update-admin-password.js
const { connectDB, getPool, closeDB, sql } = require('../config/database');
const bcrypt = require('bcrypt');

(async () => {
    try {
        await connectDB();

        const pool = getPool();
        const passwordHash = await bcrypt.hash('admin', 10);

        const result = await pool.request()
            .input('username', sql.NVarChar(50), 'admin')
            .input('password_hash', sql.NVarChar(255), passwordHash)
            .query(`
                UPDATE AdminUsers
                SET password_hash = @password_hash
                WHERE username = @username
            `);

        console.log('✅ Admin password updated.');
    } catch (err) {
        console.error('❌ Failed to update admin password:', err.message);
    } finally {
        await closeDB();
        process.exit(0);
    }
})();
