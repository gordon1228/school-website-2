// middleware/auth.js

function requireAuth(req, res, next) {
    console.log('=== AUTH CHECK ===');
    console.log('Session exists:', !!req.session);
    console.log('Is authenticated:', req.session?.isAuthenticated);
    console.log('==================');
    
    if (req.session && req.session.isAuthenticated) {
        return next();
    } else {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required',
                redirect: '/admin/login'
            });
        }
        return res.redirect('/admin/login');
    }
}

// Debug middleware (remove in production)
function debugSession(req, res, next) {
    console.log('=== SESSION DEBUG ===');
    console.log('Session ID:', req.sessionID);
    console.log('Is authenticated:', req.session?.isAuthenticated);
    console.log('Method:', req.method, 'URL:', req.url);
    console.log('=====================');
    next();
}

module.exports = {
    requireAuth,
    debugSession
};