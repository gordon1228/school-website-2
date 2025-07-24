// Fixed app.js - Remove conflicting routes
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const { connectDB } = require('./config/database');

// Middleware
const { debugSession } = require('./middleware/auth');

// Routes
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public'); // Add this

// App configuration
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'school-website-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
    }
}));

// DEBUG: Session debugging middleware (remove in production)
if (process.env.NODE_ENV !== 'production') {
    app.use(debugSession);
}

// Mount route handlers
app.use('/', publicRoutes);        // Public routes (homepage, search, etc.)
app.use('/admin', adminRoutes);    // Admin routes (dashboard, etc.)
app.use('/admin', authRoutes);     // Auth routes (login, logout)

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

// 404 handler
app.use((req, res) => {
    res.status(404).send('Page not found');
});

// Initialize database and start server
async function startServer() {
    try {
        await connectDB();
        console.log('Database connected successfully');
        
        app.listen(PORT, () => {
            console.log(`School website running on http://localhost:${PORT}`);
            console.log(`Admin login: http://localhost:${PORT}/admin/login`);
            if (process.env.NODE_ENV !== 'production') {
                console.log('Admin credentials: admin / password');
            }
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();