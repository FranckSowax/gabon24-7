/**
 * ROUTES VEILLE & ALERTES - Abonnements
 *
 * Gestion des abonnements au service Veille & Alertes:
 * - Plans (Particulier / Entreprise)
 * - Souscription via E-Billing
 * - Demo gratuite 24h
 * - Limites par tier
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { requireAuth } = require('../middleware/auth');
const veilleService = require('../services/veille-subscription.service');
const ebillingService = require('../services/ebilling-payment.service');

const supabase = supabaseService.supabase;

// =====================================================
// GET /api/veille/plans - Lister les plans veille (public)
// =====================================================
router.get('/plans', async (req, res) => {
  try {
    const { data: plans, error } = await supabase
      .from('veille_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, plans: plans || [] });
  } catch (err) {
    console.error('Erreur GET /api/veille/plans:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// GET /api/veille/subscription - Abo veille du user connecte
// =====================================================
router.get('/subscription', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const subscription = await veilleService.checkSubscriptionStatus(userId);

    res.json({
      success: true,
      subscription,
      subscribed: subscription !== null
    });
  } catch (err) {
    console.error('Erreur GET /api/veille/subscription:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// GET /api/veille/limits - Limites du tier actuel
// =====================================================
router.get('/limits', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const limits = await veilleService.getUserLimits(userId);

    // Compter les alertes actuelles
    const { count: alertCount } = await supabase
      .from('user_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    res.json({
      success: true,
      ...limits,
      currentAlertCount: alertCount || 0
    });
  } catch (err) {
    console.error('Erreur GET /api/veille/limits:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// POST /api/veille/subscribe - Lancer paiement E-Billing
// =====================================================
router.post('/subscribe', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { planSlug, whatsappNumber, duration = 1 } = req.body;

    if (!planSlug || !whatsappNumber) {
      return res.status(400).json({
        success: false,
        error: 'planSlug et whatsappNumber sont requis'
      });
    }

    if (!['particulier', 'entreprise'].includes(planSlug)) {
      return res.status(400).json({
        success: false,
        error: 'Plan invalide. Choisissez particulier ou entreprise.'
      });
    }

    // Valider le numero WhatsApp (format international)
    const cleanNumber = whatsappNumber.replace(/[\s\-()]/g, '');
    if (!/^\+[1-9]\d{6,14}$/.test(cleanNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Numero WhatsApp invalide. Format requis: +XXX...'
      });
    }

    // Recuperer le plan
    const { data: plan, error: planError } = await supabase
      .from('veille_plans')
      .select('*')
      .eq('slug', planSlug)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return res.status(404).json({ success: false, error: 'Plan non trouve' });
    }

    const amount = plan.price_monthly * (duration || 1);

    // Recuperer info user
    const { data: userData } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .single();

    const reference = ebillingService.generateReference('VEI');

    // Initier le paiement E-Billing
    const result = await ebillingService.initiatePayment({
      userId,
      amount,
      reference,
      type: 'veille_subscription',
      planSlug: plan.slug,
      planName: plan.name,
      planDuration: duration,
      description: `Gabon Insight - Veille ${plan.name} (${duration} mois)`,
      userEmail: userData?.email,
      userName: userData?.full_name || 'Client',
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Mettre a jour le paiement avec les infos veille
    await supabase
      .from('ebilling_payments')
      .update({
        veille_plan_slug: planSlug,
        veille_whatsapp_number: cleanNumber
      })
      .eq('reference', reference);

    res.json({
      success: true,
      ...result,
      plan: { slug: plan.slug, name: plan.name, price: plan.price_monthly }
    });

  } catch (err) {
    console.error('Erreur POST /api/veille/subscribe:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// POST /api/veille/demo - Demarrer demo gratuite 24h
// =====================================================
router.post('/demo', async (req, res) => {
  try {
    const { whatsappNumber, email, name } = req.body;

    if (!whatsappNumber || !email) {
      return res.status(400).json({
        success: false,
        error: 'whatsappNumber et email sont requis'
      });
    }

    const cleanNumber = whatsappNumber.replace(/[\s\-()]/g, '');
    if (!/^\+[1-9]\d{6,14}$/.test(cleanNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Numero WhatsApp invalide. Format requis: +XXX...'
      });
    }

    // Verifier si une demo existe deja pour ce numero
    const { data: existingTrial } = await supabase
      .from('veille_demo_trials')
      .select('*')
      .eq('whatsapp_number', cleanNumber)
      .single();

    if (existingTrial) {
      return res.status(409).json({
        success: false,
        error: 'Une demo a deja ete utilisee avec ce numero WhatsApp.',
        alreadyUsed: true
      });
    }

    // Chercher ou creer l'utilisateur par email
    let userId = null;
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (existingUser) {
      userId = existingUser.id;
    }

    // Recuperer le plan Particulier pour la demo
    const { data: demoPlan } = await supabase
      .from('veille_plans')
      .select('*')
      .eq('slug', 'particulier')
      .single();

    if (!demoPlan) {
      return res.status(500).json({ success: false, error: 'Plan demo non configure' });
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Creer le trial
    const { error: trialError } = await supabase
      .from('veille_demo_trials')
      .insert({
        whatsapp_number: cleanNumber,
        user_id: userId,
        email: email.trim().toLowerCase(),
        name: name || null,
        trial_start: now.toISOString(),
        trial_end: trialEnd.toISOString()
      });

    if (trialError) {
      console.error('Erreur creation trial:', trialError);
      return res.status(500).json({ success: false, error: 'Erreur lors de la creation de la demo' });
    }

    // Creer l'abonnement trial si on a un userId
    if (userId) {
      // Expirer les anciens abos veille
      await supabase
        .from('veille_subscriptions')
        .update({ status: 'expired', updated_at: now.toISOString() })
        .eq('user_id', userId)
        .in('status', ['active', 'trial']);

      await supabase
        .from('veille_subscriptions')
        .insert({
          user_id: userId,
          plan_id: demoPlan.id,
          status: 'trial',
          whatsapp_number: cleanNumber,
          payment_method: 'trial',
          current_period_start: now.toISOString(),
          current_period_end: trialEnd.toISOString(),
          trial_end: trialEnd.toISOString(),
          metadata: { demo: true, email, name }
        });

      // Creer une alerte demo
      await supabase
        .from('user_alerts')
        .insert({
          user_id: userId,
          name: 'Actualites Gabon (Demo)',
          keywords: ['gabon', 'gouvernement', 'economie'],
          is_active: true,
          whatsapp_enabled: true,
          whatsapp_numbers: [cleanNumber]
        });
    }

    // Envoyer message WhatsApp de bienvenue
    try {
      const whapiService = require('../services/whapiService');
      const welcomeMessage = `Bienvenue sur Gabon Insight - Veille & Alertes !\n\nVotre demo gratuite de 24h est activee.\n\nVous recevrez des alertes carrousel WhatsApp chaque heure (7h-22h) sur les actualites gabonaises.\n\nPour configurer vos propres alertes, rendez-vous sur :\nhttps://gaboninsight.com/veille\n\nBonne decouverte !`;
      console.log(`[DEMO] Envoi WhatsApp bienvenue vers ${cleanNumber}...`);
      const whatsappResult = await whapiService.sendWhatsAppMessage(cleanNumber, welcomeMessage);
      console.log(`[DEMO] WhatsApp bienvenue resultat:`, JSON.stringify(whatsappResult));
    } catch (whatsappErr) {
      console.error('[DEMO] WhatsApp bienvenue echoue:', whatsappErr.message);
      if (whatsappErr.response?.data) {
        console.error('[DEMO] Whapi error details:', JSON.stringify(whatsappErr.response.data));
      }
    }

    res.json({
      success: true,
      message: 'Demo activee avec succes',
      trialEnd: trialEnd.toISOString(),
      whatsappNumber: cleanNumber,
      hasAccount: userId !== null
    });

  } catch (err) {
    console.error('Erreur POST /api/veille/demo:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// GET /api/veille/demo/status - Statut demo par numero
// =====================================================
router.get('/demo/status', async (req, res) => {
  try {
    const { whatsapp } = req.query;

    if (!whatsapp) {
      return res.status(400).json({ success: false, error: 'Parametre whatsapp requis' });
    }

    const cleanNumber = whatsapp.replace(/[\s\-()]/g, '');

    const { data: trial, error } = await supabase
      .from('veille_demo_trials')
      .select('*')
      .eq('whatsapp_number', cleanNumber)
      .single();

    if (error || !trial) {
      return res.json({ success: true, found: false });
    }

    const now = new Date();
    const isExpired = trial.is_expired || now > new Date(trial.trial_end);

    res.json({
      success: true,
      found: true,
      trial: {
        whatsappNumber: trial.whatsapp_number,
        trialStart: trial.trial_start,
        trialEnd: trial.trial_end,
        isExpired: isExpired,
        convertedToSubscription: trial.converted_to_subscription
      }
    });

  } catch (err) {
    console.error('Erreur GET /api/veille/demo/status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
