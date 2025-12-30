/**
 * 💳 ROUTES CREDIT MANAGER - Migration depuis Netlify
 * Gestion des crédits utilisateur pour services IA
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// POST /api/credits/check-balance - Vérifier solde
router.post('/check-balance', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id; // Extrait du JWT
    const { requiredCredits = 0 } = req.body;

    // Récupérer solde utilisateur
    const { data: user } = await supabaseService.supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    const balance = user?.balance || 0;
    const hasCredits = balance >= requiredCredits;

    res.json({
      success: true,
      balance,
      requiredCredits,
      hasCredits
    });

  } catch (error) {
    console.error('❌ Erreur check balance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/credits/consume - Consommer des crédits
router.post('/consume', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id; // Extrait du JWT
    const {
      serviceName,
      amount,
      referenceId = null,
      openaiUsage = null
    } = req.body;

    if (!amount) {
      return res.status(400).json({ success: false, error: 'amount requis' });
    }

    // Récupérer solde actuel
    const { data: user } = await supabaseService.supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    const currentBalance = user?.balance || 0;

    if (currentBalance < amount) {
      return res.json({
        success: false,
        error: 'Crédits insuffisants',
        balance: currentBalance,
        required: amount
      });
    }

    // Déduire crédits
    const newBalance = currentBalance - amount;
    const { error: updateError } = await supabaseService.supabase
      .from('user_credits')
      .update({ balance: newBalance })
      .eq('user_id', userId);

    if (updateError) {
      return res.status(500).json({ success: false, error: updateError.message });
    }

    // Enregistrer transaction
    await supabaseService.supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        type: 'consume',
        amount: -amount,
        balance_after: newBalance,
        service_name: serviceName,
        reference_id: referenceId,
        metadata: openaiUsage ? { openai_usage: openaiUsage } : null
      });

    res.json({
      success: true,
      balance: newBalance,
      consumed: amount
    });

  } catch (error) {
    console.error('❌ Erreur consume credits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/credits/add - Ajouter des crédits
router.post('/add', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id; // Extrait du JWT
    const {
      amount,
      source = 'manual',
      referenceId = null
    } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'amount positif requis' });
    }

    // Récupérer solde actuel
    let { data: user } = await supabaseService.supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    let currentBalance = 0;

    if (!user) {
      // Créer compte crédits
      const { data: newUser } = await supabaseService.supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          balance: amount
        })
        .select()
        .single();
      
      currentBalance = amount;
      user = newUser;
    } else {
      // Ajouter crédits
      currentBalance = user.balance + amount;
      await supabaseService.supabase
        .from('user_credits')
        .update({ balance: currentBalance })
        .eq('user_id', userId);
    }

    // Enregistrer transaction
    await supabaseService.supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        type: 'add',
        amount: amount,
        balance_after: currentBalance,
        source: source,
        reference_id: referenceId
      });

    res.json({
      success: true,
      balance: currentBalance,
      added: amount
    });

  } catch (error) {
    console.error('❌ Erreur add credits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/credits/history - Historique transactions
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id; // Extrait du JWT
    const { limit = 50, offset = 0 } = req.query;

    const { data: transactions } = await supabaseService.supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    res.json({
      success: true,
      transactions: transactions || [],
      total: transactions?.length || 0
    });

  } catch (error) {
    console.error('❌ Erreur get history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/credits/balance - Solde simple
router.get('/balance', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id; // Extrait du JWT

    const { data: user } = await supabaseService.supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', userId)
      .single();

    res.json({
      success: true,
      balance: user?.balance || 0
    });

  } catch (error) {
    res.json({
      success: true,
      balance: 0
    });
  }
});

// GET /api/credits/stats - Statistiques de crédits (avec userId en query)
router.get('/stats', async (req, res) => {
  try {
    const { type, userId } = req.query;

    if (type === 'balance' && userId) {
      const { data, error } = await supabaseService.supabase
        .from('user_credits')
        .select('balance, bonus_balance')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      const bal = Number(data?.balance || 0);
      const bonus = Number(data?.bonus_balance || 0);
      const total = bal + bonus;
      res.json({
        success: true,
        balance: {
          balance: bal,
          bonus_balance: bonus,
          total_balance: total,
          is_low_balance: total < 2,
          xaf_value: total * 10
        }
      });
    } else {
      res.json({ success: false, error: 'Invalid parameters' });
    }
  } catch (error) {
    console.error('❌ Erreur stats crédits:', error);
    res.json({ success: false, error: error.message });
  }
});

// GET /api/credits/packages - Liste des packages de crédits
router.get('/packages', async (req, res) => {
  try {
    const { data: packages, error } = await supabaseService.supabase
      .from('credit_packages')
      .select('id, name, description, credits, bonus_credits, price_fcfa, is_active, display_order')
      .eq('is_active', true)
      .order('credits', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      packages: packages || []
    });
  } catch (error) {
    console.error('❌ Erreur packages crédits:', error);
    res.json({ success: false, packages: [], error: error.message });
  }
});

// POST /api/credits/packages - Acheter un package de crédits
router.post('/packages', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { packageId, paymentMethod, paymentReference } = req.body;

    const { data: pkg, error: pkgError } = await supabaseService.supabase
      .from('credit_packages')
      .select('*')
      .eq('id', packageId)
      .single();

    if (pkgError) throw pkgError;

    const { data, error } = await supabaseService.supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        package_id: packageId,
        credits: pkg.credits,
        amount: pkg.price,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        status: 'completed',
        created_at: new Date().toISOString()
      })
      .select();

    if (error) throw error;

    await supabaseService.supabase.rpc('add_user_credits', {
      p_user_id: userId,
      p_credits: pkg.credits
    });

    res.json({ success: true, transaction: data[0] });
  } catch (error) {
    console.error('❌ Erreur achat crédits:', error);
    res.json({ success: false, error: error.message });
  }
});

// POST /api/credits/manage - Gérer les crédits (check_balance)
router.post('/manage', async (req, res) => {
  try {
    const { action, userId, requiredCredits } = req.body;

    if (action === 'check_balance') {
      const { data, error } = await supabaseService.supabase
        .from('user_credits')
        .select('balance, bonus_balance')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      const total = (data?.balance || 0) + (data?.bonus_balance || 0);

      res.json({
        success: true,
        hasEnough: total >= requiredCredits,
        balance: total
      });
    } else {
      res.json({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('❌ Erreur gestion crédits:', error);
    res.json({ success: false, error: error.message });
  }
});

module.exports = router;
