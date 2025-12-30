const express = require('express');
const router = express.Router();
const { z } = require('zod');
const paymentService = require('../services/payment.service');
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

module.exports = router;
