const express = require('express');
const router = express.Router();
const paymentService = require('../services/payment.service');
const supabaseService = require('../supabase-config');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validation');
const { z } = require('zod');

// ==================== SCHÉMAS DE VALIDATION ====================
const purchaseSchema = z.object({
  userId: z.string().uuid('userId invalide'),
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
  userId: z.string().uuid('userId invalide'),
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
    const { userId, packageId, paymentMethod, phoneNumber, mobileOperator } = req.body;

    if (!userId || !packageId) {
      return res.status(400).json({ success: false, error: 'userId et packageId requis' });
    }

    if (!paymentMethod || paymentMethod === 'demo') {
      return res.status(400).json({ success: false, error: 'Méthode de paiement requise' });
    }

    // 1. Récupérer le package
    const { data: pkg, error: pkgError } = await supabaseService.supabase
      .from('credit_packages')
      .select('*')
      .eq('id', packageId)
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
    console.error('❌ Erreur achat package:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 3. POST /api/credits-premium/webhook/mobile-money - Callback pour Mobile Money
// ============================================
router.post('/webhook/mobile-money', validateBody(mobileMoneyWebhookSchema), async (req, res) => {
  try {
    const { transactionId, status, externalReference } = req.body;
    console.log('📩 Webhook Mobile Money reçu:', req.body);

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
// 4. GET /api/credits-premium/balance/:userId
// ============================================
router.get('/balance/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
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
    const { userId, serviceName, amount, description } = req.body;

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
