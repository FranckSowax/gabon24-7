/**
 * 💳 ROUTES DE PAIEMENT
 *
 * Endpoints pour tous les paiements:
 * - POST /api/payments/credits - Achat de crédits via PVIT
 * - POST /api/payments/subscription - Abonnement via PVIT
 * - POST /api/payments/quiz - Inscription quiz via PVIT
 * - POST /api/payments/initiate - Paiement générique
 * - GET /api/payments/status/:reference - Statut d'un paiement
 * - GET /api/payments/history - Historique des paiements
 */

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const paymentService = require('../services/payment.service');
const pvitPaymentService = require('../services/pvit-payment.service');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validation');

// Schéma de validation pour l'initiation de paiement
const initiatePaymentSchema = z.object({
  userId: z.string().uuid('userId invalide'),
  amount: z.number()
    .positive('Le montant doit être positif')
    .min(100, 'Montant minimum: 100 FCFA')
    .max(10000000, 'Montant maximum: 10,000,000 FCFA'),
  method: z.enum(['stripe', 'mypvit', 'airtel', 'moov', 'card'], {
    errorMap: () => ({ message: 'Méthode de paiement non supportée' })
  }),
  description: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional(),
  providerData: z.record(z.any()).optional(),
});

// ============================================
// 1. POST /api/payments/initiate - Initier un paiement générique
// 🔒 SÉCURISÉ: Authentification + validation des inputs
// ============================================
router.post('/initiate', requireAuth, validateBody(initiatePaymentSchema), async (req, res) => {
  try {
    const {
      userId,
      amount,
      method,
      description,
      metadata,
      providerData
    } = req.body;

    // Vérifier que l'utilisateur initie un paiement pour lui-même
    if (userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Vous ne pouvez initier un paiement que pour vous-même'
      });
    }

    const result = await paymentService.initiatePayment({
      userId,
      amount,
      method,
      description,
      metadata,
      provider_data: providerData
    });

    res.json({
      success: true,
      transaction: result,
      message: result.instructions || 'Paiement initié'
    });

  } catch (error) {
    console.error('❌ Erreur initiation paiement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 2. POST /api/payments/webhook - Webhook global
// ============================================
router.post('/webhook', async (req, res) => {
  try {
    const { transactionId, status, externalReference } = req.body;
    console.log('📩 Webhook Paiement reçu:', req.body);

    await paymentService.updateTransactionStatus(
      transactionId, 
      status === 'SUCCESS' ? 'completed' : 'failed',
      req.body
    );

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Erreur webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 3. GET /api/payments/status/:transactionId
// ============================================
router.get('/status/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const status = await paymentService.checkStatus(transactionId);
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 4. ROUTES PVIT - Paiements Mobile Money
// ============================================

// Schémas de validation PVIT
const phoneSchema = z.string()
  .min(8, 'Numéro trop court')
  .max(15, 'Numéro trop long')
  .regex(/^[0-9+]+$/, 'Format invalide');

const creditPurchaseSchema = z.object({
  packageId: z.string().uuid('Package ID invalide'),
  phone: phoneSchema
});

const subscriptionPaymentSchema = z.object({
  planSlug: z.enum(['premium', 'discovery', 'pro'], { message: 'Plan invalide' }),
  phone: phoneSchema,
  duration: z.number().int().min(1).max(12).optional().default(1)
});

const quizPaymentSchema = z.object({
  quizId: z.string().min(1, 'Quiz ID requis'),
  phone: phoneSchema
});

/**
 * POST /api/payments/credits
 * Initie un paiement PVIT pour achat de crédits
 */
router.post('/credits', requireAuth, async (req, res) => {
  try {
    const validation = creditPurchaseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message
      });
    }

    const { packageId, phone } = validation.data;
    const userId = req.user.id;

    const result = await pvitPaymentService.initiateCreditPurchase({
      userId,
      packageId,
      phone
    });

    if (!result.success) {
      // Log détaillé pour debug
      console.error('❌ Échec paiement crédits:', {
        userId,
        packageId,
        phone,
        error: result.error,
        pvit_response: result.pvit_response
      });

      return res.status(result.http_code || 400).json({
        success: false,
        error: result.error || 'Erreur lors du paiement',
        details: result.pvit_response
      });
    }

    res.json({
      success: true,
      message: 'Paiement initié. Vérifiez votre téléphone.',
      data: result
    });

  } catch (error) {
    console.error('❌ Erreur paiement crédits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/payments/subscription
 * Initie un paiement PVIT pour abonnement
 */
router.post('/subscription', requireAuth, async (req, res) => {
  try {
    const validation = subscriptionPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message
      });
    }

    const { planSlug, phone, duration } = validation.data;
    const userId = req.user.id;

    const result = await pvitPaymentService.initiateSubscriptionPayment({
      userId,
      planSlug,
      phone,
      duration
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: 'Paiement initié. Vérifiez votre téléphone.',
      data: result
    });

  } catch (error) {
    console.error('❌ Erreur paiement abonnement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/payments/quiz
 * Initie un paiement PVIT pour inscription quiz
 */
router.post('/quiz', requireAuth, async (req, res) => {
  try {
    const validation = quizPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message
      });
    }

    const { quizId, phone } = validation.data;
    const userId = req.user.id;

    const result = await pvitPaymentService.initiateQuizPayment({
      userId,
      quizId,
      phone
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: 'Paiement initié. Vérifiez votre téléphone.',
      data: result
    });

  } catch (error) {
    console.error('❌ Erreur paiement quiz:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/payments/pvit-status/:reference
 * Vérifie le statut d'un paiement PVIT
 */
router.get('/pvit-status/:reference', requireAuth, async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        error: 'Référence requise'
      });
    }

    const result = await pvitPaymentService.checkPaymentStatus(reference);
    res.json(result);

  } catch (error) {
    console.error('❌ Erreur vérification statut:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/payments/history
 * Récupère l'historique des paiements de l'utilisateur
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;

    const result = await pvitPaymentService.getUserPaymentHistory(userId, limit);
    res.json(result);

  } catch (error) {
    console.error('❌ Erreur historique:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 5. WEBHOOKS PVIT - Endpoints appelés par PVIT directement
// ============================================

/**
 * POST /api/payments/pvit/callback
 * Callback principal PVIT - Appelé par PVIT après chaque transaction
 * URL à configurer dans le dashboard PVIT comme "Callback URL"
 */
router.post('/pvit/callback', async (req, res) => {
  try {
    console.log('📥 Callback PVIT reçu:', JSON.stringify(req.body, null, 2));

    // PVIT peut envoyer les données dans différents formats
    const callbackData = {
      merchantReference: req.body.merchantReference || req.body.merchant_reference || req.body.reference,
      merchantReferenceId: req.body.merchantReferenceId || req.body.merchant_reference_id,
      operationStatus: req.body.operationStatus || req.body.status || req.body.operation_status,
      amount: req.body.amount,
      currency: req.body.currency || 'XAF',
      customerMsisdn: req.body.customerMsisdn || req.body.phone,
      ...req.body
    };

    const result = await pvitPaymentService.processCallback(callbackData);

    // PVIT attend une réponse SUCCESS pour confirmer la réception
    res.json({
      responseCode: 'SUCCESS',
      message: 'Callback traité avec succès',
      ...result
    });

  } catch (error) {
    console.error('❌ Erreur callback PVIT:', error);
    // Même en cas d'erreur, renvoyer un format que PVIT comprend
    res.status(500).json({
      responseCode: 'ERROR',
      message: error.message
    });
  }
});

/**
 * POST /api/payments/pvit/reception-secret
 * Réception des nouvelles clés secrètes PVIT
 * URL à configurer dans le dashboard PVIT comme "Reception URL"
 */
router.post('/pvit/reception-secret', async (req, res) => {
  try {
    console.log('🔑 Réception clé secrète PVIT:', {
      account: req.body.operation_account_code || req.body.operationAccountCode,
      hasKey: !!(req.body.secret_key || req.body.secretKey)
    });

    // PVIT peut envoyer les données dans différents formats
    const keyData = {
      operation_account_code: req.body.operation_account_code || req.body.operationAccountCode,
      secret_key: req.body.secret_key || req.body.secretKey,
      expires_in: req.body.expires_in || req.body.expiresIn || 86400
    };

    if (!keyData.operation_account_code || !keyData.secret_key) {
      return res.status(400).json({
        responseCode: 'ERROR',
        message: 'Données de clé manquantes'
      });
    }

    const result = await pvitPaymentService.receiveSecretKey(keyData);

    if (result.success) {
      res.json({
        responseCode: 'SUCCESS',
        message: 'Clé enregistrée avec succès',
        expires_at: result.expires_at
      });
    } else {
      throw new Error(result.error || 'Erreur inconnue');
    }

  } catch (error) {
    console.error('❌ Erreur réception clé PVIT:', error);
    res.status(400).json({
      responseCode: 'ERROR',
      message: error.message
    });
  }
});

/**
 * POST /api/payments/webhook/pvit
 * Alias pour compatibilité (ancien endpoint)
 */
router.post('/webhook/pvit', async (req, res) => {
  try {
    console.log('📥 Webhook PVIT (legacy) reçu:', req.body);

    // Rediriger vers le nouveau handler
    const callbackData = {
      merchantReference: req.body.reference || req.body.merchantReference,
      merchantReferenceId: req.body.merchant_reference_id || req.body.merchantReferenceId,
      operationStatus: req.body.status || req.body.operationStatus,
      amount: req.body.amount,
      ...req.body
    };

    const result = await pvitPaymentService.processCallback(callbackData);
    res.json({ success: true, result });

  } catch (error) {
    console.error('❌ Erreur webhook PVIT:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/payments/pvit/health
 * Endpoint de vérification de santé pour PVIT
 */
router.get('/pvit/health', async (req, res) => {
  try {
    const hasValidKey = await pvitPaymentService.getValidPvitKey();
    res.json({
      status: 'ok',
      service: 'pvit-payments',
      hasValidKey: !!hasValidKey,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
