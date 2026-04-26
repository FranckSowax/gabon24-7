const supabaseService = require('../supabase-config');

/**
 * Middleware d'audit log pour actions admin sensibles.
 * Usage : router.use(requireAdmin, auditLog('campaigns'))
 *         router.delete('/:id', auditLog('campaign_delete'), handler)
 *
 * Loggue de manière non-bloquante : un échec d'écriture audit ne casse pas la requête.
 */
function auditLog(action, resourceType = null) {
  return (req, res, next) => {
    const startedAt = Date.now();

    // Capturer la fin de la requête pour logger le status final
    res.on('finish', () => {
      const adminUser = req.user || {};
      const entry = {
        admin_user_id: adminUser.id || null,
        admin_email: adminUser.email || null,
        action,
        resource_type: resourceType,
        resource_id: req.params?.id || null,
        method: req.method,
        path: req.originalUrl,
        status_code: res.statusCode,
        ip_address: req.ip || req.headers['x-forwarded-for'] || null,
        user_agent: req.headers['user-agent'] || null,
        payload: sanitizePayload(req.body),
      };

      supabaseService.supabase
        .from('admin_audit_log')
        .insert(entry)
        .then(({ error }) => {
          if (error) console.warn('⚠️ audit_log insert failed:', error.message);
        })
        .catch(err => console.warn('⚠️ audit_log exception:', err.message));
    });

    next();
  };
}

// Retire les champs sensibles avant log (mots de passe, tokens, cartes)
function sanitizePayload(body) {
  if (!body || typeof body !== 'object') return null;
  const SENSITIVE = ['password', 'token', 'secret', 'card', 'cvv', 'pin'];
  const cleaned = {};
  for (const key of Object.keys(body)) {
    const lower = key.toLowerCase();
    if (SENSITIVE.some(s => lower.includes(s))) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof body[key] === 'string' && body[key].length > 1000) {
      cleaned[key] = body[key].slice(0, 1000) + '...[truncated]';
    } else {
      cleaned[key] = body[key];
    }
  }
  return cleaned;
}

module.exports = { auditLog };
