// config/app.js - Application configuration

const path = require('path');

const appConfig = {
    // Server settings
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    
    // Path settings
    viewsPath: path.join(__dirname, '../views'),
    publicPath: path.join(__dirname, '../public'),
    uploadsPath: path.join(__dirname, '../uploads'),
    
    // Security settings
    trustProxy: process.env.TRUST_PROXY === 'true',
    rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    
    // Feature flags
    features: {
        debugMode: process.env.NODE_ENV === 'development',
        maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
        registrationEnabled: process.env.REGISTRATION_ENABLED === 'true',
        emailNotifications: process.env.EMAIL_NOTIFICATIONS === 'true'
    },
    
    // Site settings
    site: {
        name: process.env.SITE_NAME || 'School Website',
        description: process.env.SITE_DESCRIPTION || 'Keeping our school community informed and connected.',
        author: process.env.SITE_AUTHOR || 'School Administration',
        version: require('../package.json').version
    }
};

module.exports = appConfig;