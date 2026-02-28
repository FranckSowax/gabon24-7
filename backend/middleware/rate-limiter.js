const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * 🛡️ RATE LIMITING GRANULAIRE
 * Configuration de limiteurs de taux adaptés à chaque type d'endpoint
 */

// ============================================
// CONFIGURATION DES LIMITEURS
// ============================================

/**
 * Limiteur général pour toutes les API
 * 1000 requêtes par 15 minutes par IP
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: {
    success: false,
    error: 'Trop de requêtes. Veuillez réessayer dans quelques minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.logWarning('Rate limit dépassé - Général', {
      ip: req.ip,
      url: req.url,
      userId: req.user?.id
    });
    res.status(429).json({
      success: false,
      error: 'Trop de requêtes. Veuillez réessayer dans quelques minutes.',
      retryAfter: '15 minutes'
    });
  }
});

/**
 * Limiteur strict pour les endpoints IA
 * 50 requêtes par 15 minutes par utilisateur
 */
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Limiter par utilisateur si authentifié, sinon par IP
    return req.user?.id || req.ip;
  },
  message: {
    success: false,
    error: 'Limite de requêtes IA atteinte. Veuillez patienter.',
    retryAfter: '15 minutes'
  },
  handler: (req, res) => {
    logger.logWarning('Rate limit dépassé - IA', {
      ip: req.ip,
      userId: req.user?.id,
      endpoint: req.url
    });
    res.status(429).json({
      success: false,
      error: 'Limite de requêtes IA atteinte. Veuillez patienter.',
      retryAfter: '15 minutes'
    });
  }
});

/**
 * Limiteur pour l'authentification
 * 10 tentatives par 15 minutes par IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Ne compte que les échecs
  message: {
    success: false,
    error: 'Trop de tentatives d\'authentification. Compte temporairement bloqué.',
    retryAfter: '15 minutes'
  },
  handler: (req, res) => {
    logger.logWarning('Rate limit dépassé - Auth', {
      ip: req.ip,
      email: req.body?.email
    });
    res.status(429).json({
      success: false,
      error: 'Trop de tentatives d\'authentification. Compte temporairement bloqué.',
      retryAfter: '15 minutes'
    });
  }
});

/**
 * Limiteur pour les paiements (POST uniquement)
 * Skip les GET (polling statut) pour ne limiter que les créations de paiement
 * 20 requêtes par heure par IP
 */
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' || req.path.includes('/ebilling/callback'),
  message: {
    success: false,
    error: 'Trop de tentatives de paiement. Veuillez patienter.',
    retryAfter: '1 heure'
  },
  handler: (req, res) => {
    logger.logWarning('Rate limit dépassé - Paiement', {
      ip: req.ip,
      userId: req.user?.id,
      amount: req.body?.amount
    });
    res.status(429).json({
      success: false,
      error: 'Trop de tentatives de paiement. Veuillez patienter.',
      retryAfter: '1 heure'
    });
  }
});

/**
 * Limiteur pour les uploads de fichiers
 * 30 uploads par heure par utilisateur
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    error: 'Limite d\'uploads atteinte. Veuillez patienter.',
    retryAfter: '1 heure'
  },
  handler: (req, res) => {
    logger.logWarning('Rate limit dépassé - Upload', {
      ip: req.ip,
      userId: req.user?.id,
      fileSize: req.file?.size
    });
    res.status(429).json({
      success: false,
      error: 'Limite d\'uploads atteinte. Veuillez patienter.',
      retryAfter: '1 heure'
    });
  }
});

/**
 * Limiteur pour les emails
 * 10 emails par heure par utilisateur
 */
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    error: 'Limite d\'envoi d\'emails atteinte.',
    retryAfter: '1 heure'
  },
  handler: (req, res) => {
    logger.logWarning('Rate limit dépassé - Email', {
      ip: req.ip,
      userId: req.user?.id
    });
    res.status(429).json({
      success: false,
      error: 'Limite d\'envoi d\'emails atteinte.',
      retryAfter: '1 heure'
    });
  }
});

/**
 * Limiteur pour les créations de campagnes
 * 10 campagnes par jour par utilisateur
 */
const campaignCreationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 heures
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    error: 'Limite de création de campagnes atteinte pour aujourd\'hui.',
    retryAfter: '24 heures'
  },
  handler: (req, res) => {
    logger.logWarning('Rate limit dépassé - Création campagne', {
      ip: req.ip,
      userId: req.user?.id
    });
    res.status(429).json({
      success: false,
      error: 'Limite de création de campagnes atteinte pour aujourd\'hui.',
      retryAfter: '24 heures'
    });
  }
});

/**
 * Limiteur pour les recherches
 * 200 recherches par heure par utilisateur
 */
const searchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    error: 'Limite de recherches atteinte.',
    retryAfter: '1 heure'
  }
});

/**
 * Limiteur pour les endpoints publics (lecture seule)
 * 500 requêtes par 15 minutes par IP
 */
const publicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Trop de requêtes. Veuillez réessayer plus tard.'
  }
});

/**
 * Limiteur pour les webhooks
 * 100 requêtes par minute (pour gérer les pics)
 */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Identifier par signature webhook si disponible
    return req.headers['x-webhook-signature'] || req.ip;
  }
});

// ============================================
// EXPORT DES LIMITEURS
// ============================================

module.exports = {
  generalLimiter,
  aiLimiter,
  authLimiter,
  paymentLimiter,
  uploadLimiter,
  emailLimiter,
  campaignCreationLimiter,
  searchLimiter,
  publicReadLimiter,
  webhookLimiter
};
