// scripts/hash-password.js
// Run this script to generate a hashed password for the admin user

const bcrypt = require('bcrypt');

async function hashPassword(password) {
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    return hash;
}

// Change 'password' to your desired admin password
hashPassword('password').then(hash => {
    console.log('=== ADMIN PASSWORD HASH ===');
    console.log('Password: password');
    console.log('Hash:', hash);
    console.log('===========================');
    console.log('Use this hash in your database INSERT statement:');
    console.log(`INSERT INTO AdminUsers (username, password_hash, email) VALUES ('admin', '${hash}', 'admin@school.com');`);
});