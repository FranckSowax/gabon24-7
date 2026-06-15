/**
 * Initialisation Sentry pour le backend Express.
 *
 * À require **en tout premier** dans server.js (avant les autres imports),
 * pour que Sentry puisse instrumenter Express, HTTP et les exceptions
 * non capturées dès le démarrage du process.
 *
 * Variables d'env :
 *   - SENTRY_DSN          (obligatoire pour activer la capture ; sinon no-op)
 *   - SENTRY_ENVIRONMENT  (défaut : NODE_ENV ou 'development')
 *   - SENTRY_RELEASE      (optionnel : commit SHA ou version)
 *   - SENTRY_TRACES_RATE  (défaut 0.1 — 10% des requêtes tracées)
 */

let Sentry = null;
let moduleAvailable = false;

try {
  Sentry = require('@sentry/node');
  moduleAvailable = true;
} catch (err) {
  // Module non installé — on désactive silencieusement plutôt que de crasher.
  console.warn(
    "⚠️  @sentry/node non installé — capture d'erreur désactivée. Pour activer : npm install @sentry/node"
  );
}

const dsn = process.env.SENTRY_DSN;
const isEnabled = moduleAvailable && Boolean(dsn);

if (isEnabled) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_RATE || 0.1),
    beforeSend(event) {
      if (event.request) {
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
          delete event.request.headers['x-csrf-token'];
        }
        if (event.request.data && typeof event.request.data === 'object') {
          const scrubKeys = ['password', 'token', 'apiKey', 'api_key', 'secret', 'creditCard'];
          for (const k of scrubKeys) {
            if (k in event.request.data) event.request.data[k] = '[scrubbed]';
          }
        }
      }
      return event;
    },
  });
  console.log(`✅ Sentry initialisé (env=${process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV})`);
} else if (moduleAvailable) {
  console.log('ℹ️  SENTRY_DSN non défini — Sentry désactivé pour ce process.');
}

const noopMiddleware = (_req, _res, next) => next();
const noopErrorMiddleware = (err, _req, _res, next) => next(err);

module.exports = {
  Sentry,
  isEnabled,
  requestHandler: isEnabled
    ? Sentry.Handlers.requestHandler({ user: ['id', 'email'] })
    : noopMiddleware,
  errorHandler: isEnabled ? Sentry.Handlers.errorHandler() : noopErrorMiddleware,
  captureException: (err, context) => {
    if (!isEnabled) return;
    Sentry.captureException(err, context);
  },
};
