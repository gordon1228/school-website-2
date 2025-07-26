const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

class Logger {
    static log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            data
        };
        
        // Console output with colors
        const colors = {
            ERROR: '\x1b[31m', // Red
            WARN: '\x1b[33m',  // Yellow
            INFO: '\x1b[36m',  // Cyan
            DEBUG: '\x1b[37m', // White
            RESET: '\x1b[0m'
        };
        
        const color = colors[level.toUpperCase()] || colors.INFO;
        console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${colors.RESET}`);
        
        if (data) {
            console.log(JSON.stringify(data, null, 2));
        }
        
        // File output (only in production or if enabled)
        if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
            const logFile = path.join(logsDir, `${level}.log`);
            const logLine = JSON.stringify(logEntry) + '\n';
            
            fs.appendFile(logFile, logLine, (err) => {
                if (err) {
                    console.error('Failed to write to log file:', err);
                }
            });
        }
    }
    
    static error(message, data = null) {
        this.log('ERROR', message, data);
    }
    
    static warn(message, data = null) {
        this.log('WARN', message, data);
    }
    
    static info(message, data = null) {
        this.log('INFO', message, data);
    }
    
    static debug(message, data = null) {
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
            this.log('DEBUG', message, data);
        }
    }
    
    // Express middleware for request logging
    static requestLogger(req, res, next) {
        const start = Date.now();
        
        res.on('finish', () => {
            const duration = Date.now() - start;
            const logData = {
                method: req.method,
                url: req.url,
                status: res.statusCode,
                duration: `${duration}ms`,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            };
            
            if (res.statusCode >= 400) {
                Logger.warn(`HTTP ${res.statusCode} ${req.method} ${req.url}`, logData);
            } else {
                Logger.info(`HTTP ${res.statusCode} ${req.method} ${req.url}`, logData);
            }
        });
        
        next();
    }
}

module.exports = Logger;