/**
 * Middleware d'erreur Express centralisé.
 *
 * À monter en DERNIER dans server.js, après toutes les routes :
 *   const { errorHandler, notFoundHandler } = require('./middleware/error-handler');
 *   app.use(notFoundHandler);
 *   app.use(errorHandler);
 *
 * Comportement :
 *   - Génère un requestId stable par requête (UUID v4 simple) pour corrélation logs/Sentry.
 *   - Capture l'exception dans Sentry (si configuré).
 *   - Log structuré côté serveur (stack + contexte minimal).
 *   - Réponse client : JSON uniforme { error, requestId }, sans détails internes
 *     (sauf en NODE_ENV=development).
 */

const crypto = require('crypto');
const { captureException } = require('../lib/sentry');

function makeRequestId() {
  return crypto.randomBytes(8).toString('hex');
}

function notFoundHandler(req, res, _next) {
  const requestId = makeRequestId();
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    requestId,
  });
}

function errorHandler(err, req, res, _next) {
  const requestId = makeRequestId();
  const status = err.status || err.statusCode || 500;

  // Log structuré côté serveur (toujours).
  console.error(
    JSON.stringify({
      level: 'error',
      requestId,
      method: req.method,
      path: req.path,
      status,
      message: err.message,
      stack: err.stack,
      userId: req.user?.id || null,
    })
  );

  // Capture Sentry (no-op si désactivé).
  captureException(err, {
    tags: { requestId, path: req.path, method: req.method },
    user: req.user ? { id: req.user.id, email: req.user.email } : undefined,
  });

  const payload = {
    error: status >= 500 ? 'Internal server error' : err.message || 'Error',
    requestId,
  };

  if (process.env.NODE_ENV !== 'production') {
    payload.detail = err.message;
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
}

module.exports = { errorHandler, notFoundHandler, makeRequestId };
