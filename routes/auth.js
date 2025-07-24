// routes/auth.js
const express = require('express');
const router = express.Router();
const AuthService = require('../services/authService');

// Admin login page
router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// Admin login POST
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    console.log('=== LOGIN ATTEMPT ===');
    console.log('Username:', username);
    
    try {
        const authResult = await AuthService.authenticateUser(username, password);
        
        if (authResult.success) {
            req.session.isAuthenticated = true;
            req.session.username = authResult.user.username;
            req.session.userId = authResult.user.id;
            
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.render('login', { error: 'Session error, please try again' });
                }
                
                console.log('Login successful, redirecting to dashboard');
                res.redirect('/admin/dashboard');
            });
        } else {
            console.log('Login failed:', authResult.message);
            res.render('login', { error: authResult.message });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', { error: 'Login failed. Please try again.' });
    }
});

// DEBUG: Session check endpoint (remove in production)
router.get('/debug/session', (req, res) => {
    res.json({
        sessionID: req.sessionID,
        session: req.session,
        isAuthenticated: req.session?.isAuthenticated,
        cookies: req.headers.cookie
    });
});

module.exports = router;