// config/constants.js - Application constants

const CONSTANTS = {
    // Post limits
    MAX_TITLE_LENGTH: 255,
    MAX_CONTENT_LENGTH: 10000,
    MIN_TITLE_LENGTH: 1,
    MIN_CONTENT_LENGTH: 1,
    
    // Pagination
    POSTS_PER_PAGE: 10,
    ADMIN_POSTS_PER_PAGE: 20,
    
    // File upload (if you add this feature later)
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
    
    // Security
    MAX_LOGIN_ATTEMPTS: 5,
    LOGIN_TIMEOUT: 15 * 60 * 1000, // 15 minutes
    
    // Activity log
    MAX_ACTIVITY_LOG_ENTRIES: 1000,
    
    // User roles (for future expansion)
    USER_ROLES: {
        ADMIN: 'admin',
        EDITOR: 'editor',
        VIEWER: 'viewer'
    },
    
    // Activity types
    ACTIVITY_TYPES: {
        LOGIN: 'LOGIN',
        LOGOUT: 'LOGOUT',
        CREATE: 'CREATE',
        UPDATE: 'UPDATE',
        DELETE: 'DELETE',
        REORDER: 'REORDER'
    }
};

module.exports = CONSTANTS;
