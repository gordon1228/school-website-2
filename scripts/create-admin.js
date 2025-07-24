// scripts/create-admin.js
const { connectDB } = require('../config/database');
const AuthService = require('../services/authService');

(async () => {
    try {
        await connectDB();  // 👈 This line ensures DB is connected
        const result = await AuthService.createUser('admin', 'admin', 'admin@school.com');
        
        if (result.success) {
            console.log('✅ Admin user created with ID:', result.userId);
        } else {
            console.error('❌ Failed to create admin user:', result.error);
        }
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        process.exit();  // Optional: Exit script
    }
})();
// Note: Ensure you have the database connection and AuthService set up correctly
//       before running this script. This script should be run once to create the admin user.   