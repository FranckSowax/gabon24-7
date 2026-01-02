/**
 * 🎫 ROUTES ADMIN - GESTION DES ABONNEMENTS
 *
 * Endpoints pour gérer les abonnements et l'attribution des crédits.
 * Le paiement n'étant pas encore implémenté, ces routes permettent
 * d'activer manuellement les abonnements.
 *
 * ⚠️ SÉCURITÉ: Toutes les routes requièrent une authentification admin
 */

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const subscriptionCreditsService = require('../services/subscription-credits-service');
const { supabase } = require('../config/supabase');

/**
 * GET /api/admin/subscriptions/stats
 * Récupère les statistiques des abonnements
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await subscriptionCreditsService.getSubscriptionStats();

    // Récupérer aussi les crédits totaux distribués
    const { data: creditsData } = await supabase
      .from('credit_transactions')
      .select('amount')
      .eq('type', 'subscription');

    const totalCreditsDistributed = creditsData?.reduce((sum, t) => sum + t.amount, 0) || 0;

    res.json({
      success: true,
      stats: {
        ...stats,
        total_credits_distributed: totalCreditsDistributed
      }
    });
  } catch (error) {
    console.error('❌ Erreur stats abonnements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/subscriptions/list
 * Liste tous les abonnements avec pagination
 */
router.get('/list', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('subscriptions')
      .select(`
        *,
        plan:subscription_plans(id, name, slug, price_monthly, monthly_credits),
        user:user_id(id, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: subscriptions, count, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      subscriptions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('❌ Erreur liste abonnements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/subscriptions/activate
 * Active un abonnement pour un utilisateur et attribue les crédits
 */
router.post('/activate', requireAdmin, async (req, res) => {
  try {
    const { user_id, user_email, plan_slug, duration_months = 1 } = req.body;

    // Validation
    if (!plan_slug) {
      return res.status(400).json({
        success: false,
        error: 'Le plan est requis (plan_slug)'
      });
    }

    // Trouver l'utilisateur par ID ou email
    let userId = user_id;
    if (!userId && user_email) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', user_email)
        .single();

      if (userError || !userData) {
        // Essayer dans auth.users via RPC
        const { data: authData } = await supabase.rpc('get_user_by_email', {
          p_email: user_email
        });

        if (!authData) {
          return res.status(404).json({
            success: false,
            error: `Utilisateur non trouvé: ${user_email}`
          });
        }
        userId = authData;
      } else {
        userId = userData.id;
      }
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'user_id ou user_email requis'
      });
    }

    // Activer l'abonnement
    const result = await subscriptionCreditsService.activateSubscription(
      userId,
      plan_slug,
      duration_months
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    console.log(`✅ Admin: Abonnement ${plan_slug} activé pour ${userId}`);

    res.json({
      success: true,
      message: `Abonnement ${plan_slug} activé avec succès`,
      data: result
    });

  } catch (error) {
    console.error('❌ Erreur activation abonnement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/subscriptions/grant-credits
 * Attribue des crédits bonus à un utilisateur
 */
router.post('/grant-credits', requireAdmin, async (req, res) => {
  try {
    const { user_id, user_email, amount, reason = 'bonus' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Montant invalide (doit être > 0)'
      });
    }

    // Trouver l'utilisateur
    let userId = user_id;
    if (!userId && user_email) {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', user_email)
        .single();

      userId = userData?.id;
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'user_id ou user_email requis'
      });
    }

    // Attribuer les crédits via RPC ou directement
    const { data: rpcData, error: rpcError } = await supabase.rpc('add_user_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_reason: `admin_${reason}`,
      p_description: `Crédits bonus attribués par admin (${reason})`
    });

    if (rpcError) {
      // Fallback direct
      const { data: existing } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (existing) {
        await supabase
          .from('user_credits')
          .update({ balance: existing.balance + amount })
          .eq('user_id', userId);
      } else {
        await supabase
          .from('user_credits')
          .insert({ user_id: userId, balance: amount });
      }
    }

    // Log transaction
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount,
        type: 'bonus',
        description: `Crédits bonus (${reason})`,
        metadata: { granted_by: 'admin', reason }
      });

    console.log(`✅ Admin: ${amount} crédits attribués à ${userId}`);

    res.json({
      success: true,
      message: `${amount} crédits attribués avec succès`,
      credits_granted: amount
    });

  } catch (error) {
    console.error('❌ Erreur attribution crédits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/subscriptions/renew
 * Renouvelle un abonnement existant
 */
router.post('/renew', requireAdmin, async (req, res) => {
  try {
    const { subscription_id } = req.body;

    if (!subscription_id) {
      return res.status(400).json({
        success: false,
        error: 'subscription_id requis'
      });
    }

    const result = await subscriptionCreditsService.renewSubscription(subscription_id);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: 'Abonnement renouvelé avec succès',
      data: result
    });

  } catch (error) {
    console.error('❌ Erreur renouvellement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/subscriptions/cancel
 * Annule un abonnement
 */
router.post('/cancel', requireAdmin, async (req, res) => {
  try {
    const { subscription_id, immediate = false } = req.body;

    if (!subscription_id) {
      return res.status(400).json({
        success: false,
        error: 'subscription_id requis'
      });
    }

    const updateData = immediate
      ? { status: 'cancelled', updated_at: new Date().toISOString() }
      : { cancel_at_period_end: true, updated_at: new Date().toISOString() };

    const { error } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', subscription_id);

    if (error) throw error;

    res.json({
      success: true,
      message: immediate
        ? 'Abonnement annulé immédiatement'
        : 'Abonnement sera annulé à la fin de la période'
    });

  } catch (error) {
    console.error('❌ Erreur annulation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/subscriptions/user/:userId
 * Récupère l'abonnement et les crédits d'un utilisateur
 */
router.get('/user/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Abonnement actif
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Solde de crédits
    const balance = await subscriptionCreditsService.getUserBalance(userId);

    // Historique des transactions (10 dernières)
    const { data: transactions } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({
      success: true,
      user_id: userId,
      subscription: subscription || null,
      credits: {
        balance,
        transactions: transactions || []
      }
    });

  } catch (error) {
    console.error('❌ Erreur récupération utilisateur:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/subscriptions/plans
 * Liste les plans d'abonnement disponibles
 */
router.get('/plans', requireAdmin, async (req, res) => {
  try {
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      plans
    });

  } catch (error) {
    console.error('❌ Erreur récupération plans:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
