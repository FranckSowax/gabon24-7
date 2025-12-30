const winston = require('winston');
const path = require('path');

// Définir les niveaux de log personnalisés
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Définir les couleurs pour chaque niveau
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Format pour les logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Format pour la console (plus lisible)
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  )
);

// Transports (où les logs sont écrits)
const transports = [
  // Console (toujours actif)
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.LOG_LEVEL || 'info'
  }),
  
  // Fichier pour les erreurs
  new winston.transports.File({
    filename: path.join('logs', 'error.log'),
    level: 'error',
    format: format,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // Fichier pour tous les logs
  new winston.transports.File({
    filename: path.join('logs', 'combined.log'),
    format: format,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Créer le logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exitOnError: false,
});

// En mode test, désactiver les logs
if (process.env.NODE_ENV === 'test') {
  logger.transports.forEach((t) => (t.silent = true));
}

// Helper functions pour faciliter l'utilisation
logger.logRequest = (req, message = 'Request received') => {
  logger.http(message, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id || 'anonymous'
  });
};

logger.logError = (error, context = {}) => {
  logger.error(error.message, {
    stack: error.stack,
    ...context
  });
};

logger.logSuccess = (message, data = {}) => {
  logger.info(`✅ ${message}`, data);
};

logger.logWarning = (message, data = {}) => {
  logger.warn(`⚠️ ${message}`, data);
};

logger.logDebug = (message, data = {}) => {
  logger.debug(`🔍 ${message}`, data);
};

// Stream pour Morgan (HTTP logger middleware)
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

module.exports = logger;
