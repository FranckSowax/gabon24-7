/**
 * 🛡️ MIDDLEWARE DE VALIDATION
 * Validation des inputs avec Zod pour sécuriser les endpoints
 */

const { z } = require('zod');

// ==================== SCHÉMAS DE VALIDATION ====================

/**
 * Schéma pour les campagnes publicitaires
 */
const campaignSchema = z.object({
  name: z.string().min(3, 'Nom trop court (min 3 caractères)').max(100, 'Nom trop long (max 100 caractères)'),
  type: z.enum(['banner', 'video', 'native', 'article_trending', 'banner_feed', 'banner_home', 'video_home']),
  budget: z.number().positive('Le budget doit être positif').max(1000000, 'Budget trop élevé'),
  duration_days: z.number().int().positive().max(365, 'Durée max 365 jours'),
  status: z.enum(['draft', 'pending', 'active', 'paused', 'completed', 'rejected']).optional().default('draft'),
  target_audience: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  image_url: z.string().url().optional().nullable(),
  video_url: z.string().url().optional().nullable(),
  link_url: z.string().url().optional().nullable(),
});

/**
 * Schéma pour les paiements
 */
const paymentSchema = z.object({
  amount: z.number()
    .positive('Le montant doit être positif')
    .min(100, 'Montant minimum: 100 FCFA')
    .max(10000000, 'Montant maximum: 10,000,000 FCFA'),
  method: z.enum(['stripe', 'mypvit', 'airtel', 'moov', 'card']),
  currency: z.enum(['XAF', 'EUR', 'USD']).optional().default('XAF'),
  description: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Schéma pour les feedbacks
 */
const feedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'question', 'complaint', 'suggestion', 'other']),
  message: z.string().min(10, 'Message trop court').max(5000, 'Message trop long'),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  userEmail: z.string().email().optional().nullable(),
  userName: z.string().max(100).optional().nullable(),
});

/**
 * Schéma pour les notes de projet
 */
const projectNoteSchema = z.object({
  projectId: z.string().uuid('ID de projet invalide'),
  noteContent: z.string().min(1, 'Note vide').max(10000, 'Note trop longue'),
});

/**
 * Schéma pour les alertes utilisateur
 */
const alertSchema = z.object({
  keywords: z.array(z.string().min(2).max(50)).max(20, 'Maximum 20 mots-clés'),
  categories: z.array(z.string()).max(10).optional(),
  frequency: z.enum(['instant', 'hourly', 'daily', 'weekly']).optional().default('daily'),
  channels: z.array(z.enum(['email', 'whatsapp', 'push', 'sms'])).min(1),
  active: z.boolean().optional().default(true),
});

/**
 * Schéma pour les sondages
 */
const pollSchema = z.object({
  title: z.string().min(5, 'Titre trop court').max(200, 'Titre trop long'),
  description: z.string().max(1000).optional(),
  options: z.array(z.object({
    text: z.string().min(1).max(200),
    order: z.number().int().optional(),
  })).min(2, 'Minimum 2 options').max(10, 'Maximum 10 options'),
  endDate: z.string().datetime().optional(),
  isPublic: z.boolean().optional().default(true),
});

/**
 * Schéma pour les slides hero
 */
const heroSlideSchema = z.object({
  title: z.string().min(3).max(100),
  subtitle: z.string().max(200).optional(),
  image_url: z.string().url(),
  link_url: z.string().url().optional(),
  order: z.number().int().min(0).max(100),
  is_active: z.boolean().optional().default(true),
});

/**
 * Schéma pour les uploads
 */
const uploadSchema = z.object({
  filename: z.string().min(1).max(255).regex(/^[a-zA-Z0-9._-]+$/, 'Nom de fichier invalide'),
  mimetype: z.string().refine(
    (val) => val.startsWith('image/') || val.startsWith('video/') || val === 'application/pdf',
    'Type de fichier non autorisé'
  ),
  size: z.number().max(50 * 1024 * 1024, 'Fichier trop volumineux (max 50MB)'),
});

/**
 * Schéma pour les paramètres de pagination
 */
const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * Schéma pour les IDs UUID
 */
const uuidSchema = z.string().uuid('ID invalide');

// ==================== MIDDLEWARE DE VALIDATION ====================

/**
 * Crée un middleware de validation pour le body
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return res.status(400).json({
          success: false,
          error: 'Données invalides',
          details: errors,
        });
      }

      // Remplacer le body par les données validées et nettoyées
      req.body = result.data;
      next();
    } catch (error) {
      console.error('Erreur validation body:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur de validation',
      });
    }
  };
}

/**
 * Crée un middleware de validation pour les query params
 */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.query);

      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return res.status(400).json({
          success: false,
          error: 'Paramètres invalides',
          details: errors,
        });
      }

      req.query = result.data;
      next();
    } catch (error) {
      console.error('Erreur validation query:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur de validation',
      });
    }
  };
}

/**
 * Crée un middleware de validation pour les params d'URL
 */
function validateParams(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.params);

      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return res.status(400).json({
          success: false,
          error: 'Paramètres URL invalides',
          details: errors,
        });
      }

      req.params = result.data;
      next();
    } catch (error) {
      console.error('Erreur validation params:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur de validation',
      });
    }
  };
}

/**
 * Middleware pour valider un UUID dans les params
 */
function validateUuidParam(paramName = 'id') {
  return (req, res, next) => {
    const value = req.params[paramName];
    const result = uuidSchema.safeParse(value);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: `${paramName} invalide`,
      });
    }

    next();
  };
}

// ==================== EXPORTS ====================

module.exports = {
  // Schémas
  schemas: {
    campaign: campaignSchema,
    payment: paymentSchema,
    feedback: feedbackSchema,
    projectNote: projectNoteSchema,
    alert: alertSchema,
    poll: pollSchema,
    heroSlide: heroSlideSchema,
    upload: uploadSchema,
    pagination: paginationSchema,
    uuid: uuidSchema,
  },

  // Middlewares
  validateBody,
  validateQuery,
  validateParams,
  validateUuidParam,

  // Helpers pour validation rapide
  validate: {
    campaign: validateBody(campaignSchema),
    payment: validateBody(paymentSchema),
    feedback: validateBody(feedbackSchema),
    projectNote: validateBody(projectNoteSchema),
    alert: validateBody(alertSchema),
    poll: validateBody(pollSchema),
    heroSlide: validateBody(heroSlideSchema),
    pagination: validateQuery(paginationSchema),
  },
};
