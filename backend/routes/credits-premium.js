const express = require('express');
const router = express.Router();
const paymentService = require('../services/payment.service');
const supabaseService = require('../supabase-config');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validation');
const { z } = require('zod');
const crypto = require('crypto');

// ==================== SCHÉMAS DE VALIDATION ====================
const purchaseSchema = z.object({
  userId: z.string().uuid('userId invalide').optional().nullable(), // ignoré: l'identité vient du JWT
  packageId: z.string().min(1).max(200),
  paymentMethod: z.string().max(50).optional().nullable(),
  phoneNumber: z.string().max(40).optional().nullable(),
  mobileOperator: z.string().max(50).optional().nullable(),
}).passthrough();

const mobileMoneyWebhookSchema = z.object({
  transactionId: z.string().min(1).max(200),
  status: z.string().min(1).max(50),
  externalReference: z.string().max(200).optional().nullable(),
}).passthrough();

const consumePremiumSchema = z.object({
  userId: z.string().uuid('userId invalide').optional().nullable(), // ignoré: l'identité vient du JWT
  serviceName: z.string().max(100).optional().nullable(),
  amount: z.coerce.number().int().positive('amount positif requis').max(1_000_000),
  description: z.string().max(500).optional().nullable(),
}).passthrough();

// ============================================
// 1. GET /api/credits-premium/packages - Liste des packages
// ============================================
router.get('/packages', async (req, res) => {
  try {
    const { data: packages, error } = await supabaseService.supabase
      .from('credit_packages')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    res.json({ success: true, packages: packages || [] });
  } catch (error) {
    console.error('❌ Erreur récupération packages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 2. POST /api/credits-premium/purchase - Acheter un package (avec PaymentService)
// ============================================
router.post('/purchase', requireAuth, validateBody(purchaseSchema), async (req, res) => {
  try {
    const userId = req.user.id; // Jamais depuis le body
    const { packageId, paymentMethod, phoneNumber, mobileOperator } = req.body;

    if (!packageId) {
      return res.status(400).json({ success: false, error: 'packageId requis' });
    }

    if (!paymentMethod || paymentMethod === 'demo') {
      return res.status(400).json({ success: false, error: 'Méthode de paiement requise' });
    }

    // 1. Récupérer le package
    const { data: pkg, error: pkgError } = await supabaseService.supabase
      .from('credit_packages')
      .select('*')
      .eq('id', packageId)
      .eq('is_active', true)
      .single();

    if (pkgError || !pkg) return res.status(404).json({ success: false, error: 'Package introuvable' });

    // 2. Initier le paiement via le PaymentService
    const result = await paymentService.initiatePayment({
      userId,
      amount: pkg.price_xaf,
      method: paymentMethod,
      description: `Achat crédits: ${pkg.name}`,
      metadata: {
        type: 'credit_purchase',
        packageId: pkg.id,
        credits: pkg.credits,
        bonus: pkg.bonus_credits,
        email: req.user?.email 
      },
      provider_data: {
        phoneNumber,
        operator: mobileOperator
      }
    });

    res.json({
      success: true,
      transaction: result,
      message: result.instructions || 'Paiement initié'
    });

  } catch (error) {
    if (error.code === 'UNSUPPORTED_PAYMENT_METHOD') {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error('❌ Erreur achat package:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 3. POST /api/credits-premium/webhook/mobile-money - Callback pour Mobile Money
// ============================================
// SECURITE: webhook authentifié par secret partagé (en-tête X-Webhook-Secret,
// variable MOBILE_MONEY_WEBHOOK_SECRET). Sans secret configuré, il est fermé:
// auparavant n'importe qui pouvait passer une transaction en 'completed'.
function verifyMobileMoneyWebhook(req, res, next) {
  const expected = process.env.MOBILE_MONEY_WEBHOOK_SECRET;
  if (!expected) {
    return res.status(503).json({ error: 'Webhook non configuré' });
  }
  const received = String(req.headers['x-webhook-secret'] || '');
  const a = crypto.createHash('sha256').update(received).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Signature invalide' });
  }
  next();
}

router.post('/webhook/mobile-money', verifyMobileMoneyWebhook, validateBody(mobileMoneyWebhookSchema), async (req, res) => {
  try {
    const { transactionId, status } = req.body;
    console.log('📩 Webhook Mobile Money reçu:', { transactionId, status });

    await paymentService.updateTransactionStatus(
      transactionId, 
      status === 'SUCCESS' ? 'completed' : 'failed',
      req.body
    );

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Erreur webhook:', error.message);
    res.status(500).json({ error: 'Erreur de traitement' });
  }
});

// ============================================
// 4. GET /api/credits-premium/balance/:userId
// ============================================
router.get('/balance/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    const { data: userCredits } = await supabaseService.supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    const balance = userCredits?.balance || 0;
    const bonusBalance = userCredits?.bonus_balance || 0;

    res.json({
      success: true,
      balance,
      bonus_balance: bonusBalance,
      total_balance: balance + bonusBalance
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 5. POST /api/credits-premium/consume - Consommer des crédits
// ============================================
router.post('/consume', requireAuth, validateBody(consumePremiumSchema), async (req, res) => {
  try {
    const userId = req.user.id; // Jamais depuis le body: on ne débite que son propre compte
    const { serviceName, amount, description } = req.body;

    const { data, error } = await supabaseService.supabase
      .rpc('consume_credits', {
        p_user_id: userId,
        p_amount: amount,
        p_service_name: serviceName,
        p_description: description || `Utilisation ${serviceName}`
      });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
