/**
 * Accès de l'agent qui dépose le récap vidéo quotidien.
 *
 * WHY: l'agent utilisait un compte administrateur, qui donne tous les droits du
 * back-office (campagnes, utilisateurs, fichiers) pour une seule tâche : déposer
 * une vidéo par jour. Il a désormais une clé à lui, valable uniquement sur la
 * route de dépôt du récap. Si elle fuit, on la change sans toucher au reste.
 *
 * La clé est lue dans la variable d'environnement RECAP_AGENT_KEY et envoyée par
 * l'agent dans l'en-tête `X-Agent-Key`. Tant que la variable n'est pas définie,
 * la route reste fermée (503).
 *
 * @example
 *   router.post('/recap', recapAgentLimiter, requireRecapAgent, handler);
 */

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

/** Une clé plus courte se devine : elle est refusée comme si elle était absente. */
const MIN_KEY_LENGTH = 32;

/** Comparaison en temps constant (les empreintes ont toujours la même longueur). */
function _sameSecret(received, expected) {
  const a = crypto.createHash('sha256').update(String(received)).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

/** Laisse passer uniquement une requête portant la clé de l'agent. */
function requireRecapAgent(req, res, next) {
  const expected = process.env.RECAP_AGENT_KEY;
  if (!expected || expected.length < MIN_KEY_LENGTH) {
    return res.status(503).json({
      success: false,
      error: 'Dépôt du récap non configuré sur ce serveur',
      code: 'RECAP_AGENT_NOT_CONFIGURED',
    });
  }

  const received = req.headers['x-agent-key'];
  if (typeof received !== 'string' || received.length === 0 || !_sameSecret(received, expected)) {
    return res.status(401).json({ success: false, error: 'Clé d\'agent invalide', code: 'RECAP_AGENT_UNAUTHORIZED' });
  }

  req.isRecapAgent = true;
  return next();
}

// Un dépôt par jour suffit. La limite, placée avant la vérification de la clé,
// freine aussi les essais de clés au hasard.
const recapAgentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Trop de tentatives de dépôt. Réessayez plus tard.', code: 'RECAP_AGENT_RATE_LIMITED' },
});

module.exports = { requireRecapAgent, recapAgentLimiter, MIN_KEY_LENGTH };
