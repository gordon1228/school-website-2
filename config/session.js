// config/session.js - Session configuration

const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'school-website-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiration on each request
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true, // Prevent XSS attacks
        sameSite: 'lax' // CSRF protection
    },
    name: 'school.sid' // Custom session name
};

module.exports = { sessionConfig };