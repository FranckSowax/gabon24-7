/**
 * Routes d'authentification - Sécurité anti-bot
 *
 * Inclut:
 * - Validation Cloudflare Turnstile
 * - Rate limiting sur les endpoints sensibles
 */

const express = require('express');
const router = express.Router();

// Clé secrète Turnstile (à configurer dans les variables d'environnement)
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA'; // Test key

// Rate limiting simple en mémoire (pour production, utiliser Redis)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // Max 10 tentatives par minute

/**
 * Middleware de rate limiting pour les endpoints d'auth
 */
function authRateLimit(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const now = Date.now();

  // Nettoyer les anciennes entrées
  for (const [key, value] of rateLimitMap.entries()) {
    if (now - value.timestamp > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(key);
    }
  }

  const record = rateLimitMap.get(ip);

  if (!record) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return next();
  }

  if (now - record.timestamp > RATE_LIMIT_WINDOW) {
    // Nouvelle fenêtre
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return next();
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: 'Trop de tentatives. Veuillez réessayer dans une minute.',
      retryAfter: Math.ceil((RATE_LIMIT_WINDOW - (now - record.timestamp)) / 1000)
    });
  }

  record.count++;
  next();
}

/**
 * POST /api/auth/verify-turnstile
 * Vérifie un token Turnstile avec l'API Cloudflare
 */
router.post('/verify-turnstile', authRateLimit, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token de vérification manquant'
      });
    }

    // Obtenir l'IP du client
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Vérifier le token avec l'API Cloudflare Turnstile
    const formData = new URLSearchParams();
    formData.append('secret', TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    formData.append('remoteip', ip);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    const data = await response.json();

    if (data.success) {
      // Token valide
      console.log(`✅ Turnstile vérifié pour IP: ${ip}`);
      return res.json({
        success: true,
        message: 'Vérification réussie'
      });
    } else {
      // Token invalide
      console.warn(`⚠️ Turnstile échoué pour IP: ${ip}`, data['error-codes']);
      return res.status(400).json({
        success: false,
        message: 'Échec de la vérification de sécurité',
        errors: data['error-codes']
      });
    }

  } catch (error) {
    console.error('❌ Erreur vérification Turnstile:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification'
    });
  }
});

/**
 * GET /api/auth/security-status
 * Retourne le statut de sécurité (pour debug/monitoring)
 */
router.get('/security-status', (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const record = rateLimitMap.get(ip);

  res.json({
    success: true,
    turnstileEnabled: !!TURNSTILE_SECRET_KEY && TURNSTILE_SECRET_KEY !== '1x0000000000000000000000000000000AA',
    rateLimiting: {
      windowMs: RATE_LIMIT_WINDOW,
      maxRequests: RATE_LIMIT_MAX_REQUESTS,
      currentCount: record ? record.count : 0,
      remaining: record ? Math.max(0, RATE_LIMIT_MAX_REQUESTS - record.count) : RATE_LIMIT_MAX_REQUESTS
    }
  });
});

module.exports = router;
