const morgan = require('morgan');
const logger = require('../utils/logger');

// Format personnalisé pour Morgan
morgan.token('user-id', (req) => req.user?.id || 'anonymous');
morgan.token('status-emoji', (req, res) => {
  const status = res.statusCode;
  if (status >= 500) return '❌';
  if (status >= 400) return '⚠️';
  if (status >= 300) return '↪️';
  if (status >= 200) return '✅';
  return '❓';
});

// Format de log HTTP
const httpLogFormat = ':status-emoji :method :url :status :response-time ms - :user-id';

// Middleware Morgan avec Winston
const httpLogger = morgan(httpLogFormat, {
  stream: logger.stream,
  skip: (req) => {
    // Skip health checks et static files
    return req.url === '/health' || req.url.startsWith('/static');
  }
});

module.exports = httpLogger;
