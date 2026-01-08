// =========================================
// FILE: middlewares/logger.js - NEW
// Logging Middleware untuk Debugging
// =========================================

const fs = require('fs');
const path = require('path');

// Pastikan folder logs ada
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

/**
 * Format timestamp
 */
const getTimestamp = () => {
  return new Date().toISOString();
};

/**
 * Write to log file
 */
const writeToFile = (filename, message) => {
  const logFile = path.join(logsDir, filename);
  const timestamp = getTimestamp();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  fs.appendFile(logFile, logMessage, (err) => {
    if (err) console.error('Error writing to log file:', err);
  });
};

/**
 * Main logging middleware
 */
const logger = (req, res, next) => {
  const start = Date.now();
  const { method, url, ip } = req;
  const userAgent = req.get('user-agent') || 'Unknown';

  // Log request
  console.log(`📥 [${method}] ${url} - IP: ${ip}`);
  writeToFile('access.log', `${method} ${url} - IP: ${ip} - UA: ${userAgent}`);

  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    
    // Log response
    console.log(`📤 [${method}] ${url} - ${statusCode} - ${duration}ms`);
    writeToFile('access.log', `${method} ${url} - ${statusCode} - ${duration}ms`);

    // Log errors
    if (statusCode >= 400) {
      console.error(`❌ ERROR [${method}] ${url} - ${statusCode}`);
      writeToFile('error.log', `${method} ${url} - ${statusCode} - Response: ${data}`);
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Log custom message
 */
const logInfo = (message) => {
  console.log(`ℹ️ ${message}`);
  writeToFile('info.log', message);
};

/**
 * Log error
 */
const logError = (error, context = '') => {
  const errorMessage = `${context ? `[${context}] ` : ''}${error.message || error}`;
  console.error(`❌ ${errorMessage}`);
  writeToFile('error.log', `${errorMessage}\nStack: ${error.stack || 'No stack trace'}`);
};

/**
 * Log WhatsApp activity
 */
const logWhatsApp = (activity, details = '') => {
  const message = `WhatsApp: ${activity} ${details}`;
  console.log(`📱 ${message}`);
  writeToFile('whatsapp.log', message);
};

module.exports = {
  logger,
  logInfo,
  logError,
  logWhatsApp
};