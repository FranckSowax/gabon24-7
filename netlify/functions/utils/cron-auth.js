/**
 * Garde pour les fonctions Netlify déclenchables par HTTP.
 *
 * WHY: une fonction sans planification a une adresse publique
 * (/.netlify/functions/<nom>). Celles qui appellent OpenAI ou écrivent en base
 * avec la clé service_role ne doivent répondre qu'à nos propres tâches
 * planifiées, qui envoient l'en-tête `X-Cron-Secret` = CRON_SECRET.
 *
 * Fermé par défaut : si CRON_SECRET n'est pas configuré, tout appel est refusé.
 *
 * @example
 *   const { rejectUnlessCron, cronHeaders } = require('./utils/cron-auth');
 *   exports.handler = async (event) => {
 *     const denied = rejectUnlessCron(event, headers);
 *     if (denied) return denied;
 *     ...
 *   };
 *   // côté appelant :
 *   await fetch(url, { method: 'POST', headers: { ...cronHeaders() } });
 */

const crypto = require('crypto');

const HEADER = 'x-cron-secret';

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Vrai si l'événement porte le bon secret de tâche planifiée. */
function isAuthorizedCron(event) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const headers = (event && event.headers) || {};
  const key = Object.keys(headers).find((name) => name.toLowerCase() === HEADER);
  const received = key ? headers[key] : undefined;

  return typeof received === 'string' && received.length > 0 && safeEqual(received, expected);
}

/**
 * Renvoie une réponse 401 si l'appel n'est pas autorisé, sinon null.
 * @param {object} event événement Netlify
 * @param {object} [headers] en-têtes de réponse (CORS, Content-Type) à conserver
 */
function rejectUnlessCron(event, headers = {}) {
  if (isAuthorizedCron(event)) return null;
  return {
    statusCode: 401,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ success: false, error: 'Non autorisé' }),
  };
}

/** En-têtes à joindre à un appel vers une fonction protégée. */
function cronHeaders() {
  return process.env.CRON_SECRET ? { 'X-Cron-Secret': process.env.CRON_SECRET } : {};
}

module.exports = { isAuthorizedCron, rejectUnlessCron, cronHeaders };
