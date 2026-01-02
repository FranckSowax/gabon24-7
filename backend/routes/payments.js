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
const supabaseService = require('../supabase-config');
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
  quizId: z.string().uuid('Quiz ID invalide'),
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
      return res.status(400).json(result);
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

/**
 * POST /api/payments/webhook/pvit
 * Endpoint pour traiter les callbacks PVIT (appelé par le PHP)
 */
router.post('/webhook/pvit', async (req, res) => {
  try {
    const { reference, status, merchant_reference_id, callback_data } = req.body;

    console.log('📥 Webhook PVIT reçu:', { reference, status });

    // Appeler la fonction RPC pour traiter le callback
    const { data, error } = await supabaseService.supabase.rpc(
      'process_pvit_callback',
      {
        p_reference: reference,
        p_status: status,
        p_merchant_reference_id: merchant_reference_id,
        p_callback_data: callback_data || {}
      }
    );

    if (error) {
      console.error('❌ Erreur traitement callback:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, result: data });

  } catch (error) {
    console.error('❌ Erreur webhook:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
