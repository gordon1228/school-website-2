// services/authService.js
const bcrypt = require('bcrypt');
const { getPool, sql } = require('../config/database');

class AuthService {
    static async authenticateUser(username, password) {
        try {
            const pool = getPool();
            const result = await pool.request()
                .input('username', sql.NVarChar(50), username)
                .query('SELECT id, username, password_hash FROM AdminUsers WHERE username = @username AND is_active = 1');
            
            const user = result.recordset[0];
            if (!user) {
                return { success: false, message: 'Invalid credentials' };
            }
            
            const passwordMatch = await bcrypt.compare(password, user.password_hash);
            if (!passwordMatch) {
                return { success: false, message: 'Invalid credentials' };
            }
            
            // Update last login
            await pool.request()
                .input('userId', sql.Int, user.id)
                .query('UPDATE AdminUsers SET last_login = GETDATE() WHERE id = @userId');
            
            return { success: true, user: { id: user.id, username: user.username } };
        } catch (error) {
            console.error('Error authenticating user:', error);
            return { success: false, message: 'Authentication error' };
        }
    }

    static async createUser(username, password, email = null) {
        try {
            const pool = getPool();
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(password, saltRounds);
            
            const result = await pool.request()
                .input('username', sql.NVarChar(50), username)
                .input('password_hash', sql.NVarChar(255), passwordHash)
                .input('email', sql.NVarChar(100), email)
                .query(`
                    INSERT INTO AdminUsers (username, password_hash, email, created_at, is_active)
                    OUTPUT INSERTED.id
                    VALUES (@username, @password_hash, @email, GETDATE(), 1)
                `);
            
            return { success: true, userId: result.recordset[0].id };
        } catch (error) {
            console.error('Error creating user:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = AuthService;