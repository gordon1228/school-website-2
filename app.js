// Fixed app.js - Updated with uploads support
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
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
const publicRoutes = require('./routes/public');

// App configuration
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

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
    
    // Handle multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            error: 'File size too large. Maximum size is 5MB per image.'
        });
    }
    
    if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
            success: false,
            error: 'Too many files. Maximum 2 images per post.' // Changed from 5 to 2
        });
    }
    
    if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({
            success: false,
            error: err.message
        });
    }
    
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
        
        // Ensure upload directories exist
        const fs = require('fs');
        const uploadsDir = path.join(__dirname, 'uploads');
        const publicUploadsDir = path.join(__dirname, 'public/uploads');
        
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
            console.log('Created uploads directory');
        }
        
        if (!fs.existsSync(publicUploadsDir)) {
            fs.mkdirSync(publicUploadsDir, { recursive: true });
            console.log('Created public uploads directory');
        }
        
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