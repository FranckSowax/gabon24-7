/**
 * ROUTES DE PAIEMENT - E-Billing (Gabon Insight)
 *
 * Endpoints pour tous les paiements via E-Billing:
 * - POST /api/payments/credits      - Achat de crédits
 * - POST /api/payments/subscription  - Abonnement
 * - POST /api/payments/quiz          - Inscription quiz
 * - POST /api/payments/campaign      - Campagnes publicitaires
 * - GET  /api/payments/status/:ref   - Statut d'un paiement (polling)
 * - GET  /api/payments/history       - Historique des paiements
 * - POST /api/payments/ebilling/callback - Webhook E-Billing
 * - GET  /api/payments/health        - Santé du service
 */

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const ebillingService = require('../services/ebilling-payment.service');
const { requireAuth } = require('../middleware/auth');

// ============================================
// SCHÉMAS DE VALIDATION
// ============================================

const creditPurchaseSchema = z.object({
  packageId: z.string().uuid('Package ID invalide'),
});

const subscriptionPaymentSchema = z.object({
  planSlug: z.enum(['premium', 'discovery', 'pro'], { message: 'Plan invalide' }),
  duration: z.number().int().min(1).max(12).optional().default(1),
});

const quizPaymentSchema = z.object({
  quizId: z.string().min(1, 'Quiz ID requis'),
});

const campaignPaymentSchema = z.object({
  campaignIds: z.array(z.string().uuid()).min(1, 'Au moins une campagne requise'),
  amount: z.number().positive().min(100, 'Montant minimum: 100 FCFA'),
});

// ============================================
// PAIEMENTS PAR TYPE
// ============================================

/**
 * POST /api/payments/credits
 * Initie un paiement E-Billing pour achat de crédits
 */
router.post('/credits', requireAuth, async (req, res) => {
  try {
    const validation = creditPurchaseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const { packageId } = validation.data;
    const userId = req.user.id;

    const result = await ebillingService.initiateCreditPurchase({
      userId,
      packageId,
      userEmail: req.user.email,
      userName: req.user.user_metadata?.full_name || req.user.email,
    });

    if (!result.success) {
      return res.status(result.http_code || 400).json({
        success: false,
        error: result.error || 'Erreur lors du paiement',
      });
    }

    res.json({
      success: true,
      message: 'Facture créée. Redirection vers le portail de paiement.',
      data: result,
    });

  } catch (error) {
    console.error('❌ Erreur paiement crédits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/payments/subscription
 * Initie un paiement E-Billing pour abonnement
 */
router.post('/subscription', requireAuth, async (req, res) => {
  try {
    const validation = subscriptionPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const { planSlug, duration } = validation.data;
    const userId = req.user.id;

    const result = await ebillingService.initiateSubscriptionPayment({
      userId,
      planSlug,
      duration,
      userEmail: req.user.email,
      userName: req.user.user_metadata?.full_name || req.user.email,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: 'Facture créée. Redirection vers le portail de paiement.',
      data: result,
    });

  } catch (error) {
    console.error('❌ Erreur paiement abonnement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/payments/quiz
 * Initie un paiement E-Billing pour inscription quiz
 */
router.post('/quiz', requireAuth, async (req, res) => {
  try {
    const validation = quizPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const { quizId } = validation.data;
    const userId = req.user.id;

    const result = await ebillingService.initiateQuizPayment({
      userId,
      quizId,
      userEmail: req.user.email,
      userName: req.user.user_metadata?.full_name || req.user.email,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: 'Facture créée. Redirection vers le portail de paiement.',
      data: result,
    });

  } catch (error) {
    console.error('❌ Erreur paiement quiz:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/payments/campaign
 * Initie un paiement E-Billing pour campagne publicitaire
 */
router.post('/campaign', requireAuth, async (req, res) => {
  try {
    const validation = campaignPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const { campaignIds, amount } = validation.data;
    const userId = req.user.id;

    const result = await ebillingService.initiateCampaignPayment({
      userId,
      campaignIds,
      amount,
      userEmail: req.user.email,
      userName: req.user.user_metadata?.full_name || req.user.email,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: 'Facture créée. Redirection vers le portail de paiement.',
      data: result,
    });

  } catch (error) {
    console.error('❌ Erreur paiement campagne:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// STATUT & HISTORIQUE
// ============================================

/**
 * GET /api/payments/status/:reference
 * Vérifie le statut d'un paiement (polling frontend)
 * Vérifie aussi auprès de E-Billing si le paiement est toujours pending
 */
router.get('/status/:reference', requireAuth, async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        error: 'Référence requise',
      });
    }

    const result = await ebillingService.checkPaymentStatus(reference);
    res.json(result);

  } catch (error) {
    console.error('❌ Erreur vérification statut:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/payments/history
 * Récupère l'historique des paiements de l'utilisateur
 * Auto-réconcilie les paiements pending avant de retourner l'historique
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;

    // Auto-réconciliation: vérifier les paiements pending en arrière-plan
    ebillingService.reconcileUserPayments(userId).catch(err => {
      console.warn('⚠️ Auto-reconciliation error:', err.message);
    });

    const result = await ebillingService.getUserPaymentHistory(userId, limit);
    res.json(result);

  } catch (error) {
    console.error('❌ Erreur historique:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/payments/reconcile
 * Réconcilie manuellement les paiements pending de l'utilisateur
 */
router.post('/reconcile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await ebillingService.reconcileUserPayments(userId);
    res.json(result);
  } catch (error) {
    console.error('❌ Erreur réconciliation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/payments/retry-credits/:reference
 * Relance le traitement des crédits pour un paiement completed mais non crédité
 */
router.post('/retry-credits/:reference', requireAuth, async (req, res) => {
  try {
    const { reference } = req.params;
    const userId = req.user.id;

    const { data: payment, error } = await ebillingService.supabase
      .from('ebilling_payments')
      .select('*')
      .eq('reference', reference)
      .eq('user_id', userId)
      .single();

    if (error || !payment) {
      return res.status(404).json({ success: false, error: 'Paiement non trouvé' });
    }

    if (payment.status !== 'completed') {
      return res.json({ success: false, error: `Paiement non complété (status: ${payment.status})` });
    }

    if (payment.credits_granted === true) {
      return res.json({ success: true, message: 'Crédits déjà accordés', already_granted: true });
    }

    console.log(`🔄 Retry crédits manuel pour ${reference} par user ${userId}`);
    await ebillingService.processCompletedPayment(payment);

    res.json({ success: true, message: 'Crédits traités avec succès' });

  } catch (error) {
    console.error('❌ Erreur retry crédits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// WEBHOOKS E-BILLING
// ============================================

/**
 * POST /api/payments/ebilling/callback
 * Callback E-Billing - Appelé par E-Billing après paiement
 */
router.post('/ebilling/callback', async (req, res) => {
  try {
    console.log('📥 Callback E-Billing reçu:', JSON.stringify(req.body, null, 2));

    const result = await ebillingService.processCallback(req.body);

    res.json({
      status: 'OK',
      message: 'Callback traité',
      ...result,
    });

  } catch (error) {
    console.error('❌ Erreur callback E-Billing:', error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message,
    });
  }
});

// ============================================
// SANTÉ DU SERVICE
// ============================================

/**
 * GET /api/payments/health
 * Endpoint de vérification de santé
 */
router.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    service: 'ebilling-payments',
    provider: 'Gabon Insight E-Billing',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
