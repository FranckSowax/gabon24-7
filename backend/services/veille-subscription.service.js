/**
 * SERVICE VEILLE & ALERTES - Gestion des abonnements
 *
 * Gere les abonnements Veille (Particulier/Entreprise),
 * les demos 24h, et l'application des limites par tier.
 */

const supabaseService = require('../supabase-config');

const supabase = supabaseService.supabase;

/**
 * Verifier le statut d'abonnement veille d'un utilisateur
 * @param {string} userId
 * @returns {object|null} subscription avec plan details, ou null
 */
async function checkSubscriptionStatus(userId) {
  const { data, error } = await supabase
    .from('veille_subscriptions')
    .select('*, veille_plans(*)')
    .eq('user_id', userId)
    .in('status', ['active', 'trial'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  // Verifier si l'abonnement n'est pas expire
  const now = new Date();
  const periodEnd = new Date(data.current_period_end);

  if (data.status === 'trial' && data.trial_end) {
    const trialEnd = new Date(data.trial_end);
    if (now > trialEnd) {
      // Trial expire, mettre a jour le statut
      await supabase
        .from('veille_subscriptions')
        .update({ status: 'expired', updated_at: now.toISOString() })
        .eq('id', data.id);
      return null;
    }
  }

  if (now > periodEnd) {
    await supabase
      .from('veille_subscriptions')
      .update({ status: 'expired', updated_at: now.toISOString() })
      .eq('id', data.id);
    return null;
  }

  return data;
}

/**
 * Verifier si un utilisateur a un abonnement veille actif
 * @param {string} userId
 * @returns {boolean}
 */
async function isUserSubscribed(userId) {
  const sub = await checkSubscriptionStatus(userId);
  return sub !== null;
}

/**
 * Obtenir les limites du plan de l'utilisateur
 * @param {string} userId
 * @returns {object} { allowed, maxAlerts, maxKeywordsPerAlert, maxWhatsappNumbers, planSlug, status, expiresAt }
 */
async function getUserLimits(userId) {
  const sub = await checkSubscriptionStatus(userId);

  if (!sub) {
    return {
      subscribed: false,
      maxAlerts: 0,
      maxKeywordsPerAlert: 0,
      maxWhatsappNumbers: 0,
      planSlug: null,
      status: null,
      expiresAt: null
    };
  }

  const plan = sub.veille_plans;
  return {
    subscribed: true,
    maxAlerts: plan.max_alerts,
    maxKeywordsPerAlert: plan.max_keywords_per_alert,
    maxWhatsappNumbers: plan.max_whatsapp_numbers,
    planSlug: plan.slug,
    planName: plan.name,
    status: sub.status,
    expiresAt: sub.current_period_end,
    trialEnd: sub.trial_end
  };
}

/**
 * Verifier si la creation d'une alerte est autorisee
 * @param {string} userId
 * @param {number} keywordCount - nombre de keywords dans la nouvelle alerte
 * @returns {{ allowed: boolean, message?: string }}
 */
async function enforceAlertLimits(userId, keywordCount) {
  const limits = await getUserLimits(userId);

  if (!limits.subscribed) {
    return { allowed: false, message: 'Abonnement Veille requis', requiresSubscription: true };
  }

  // Compter les alertes existantes
  const { count, error } = await supabase
    .from('user_alerts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    return { allowed: false, message: 'Erreur de verification' };
  }

  // Verifier limite d'alertes (-1 = illimite)
  if (limits.maxAlerts !== -1 && count >= limits.maxAlerts) {
    return {
      allowed: false,
      message: `Limite atteinte: ${limits.maxAlerts} alertes max (plan ${limits.planName}). Passez a Entreprise pour des alertes illimitees.`
    };
  }

  // Verifier limite de keywords (-1 = illimite)
  if (limits.maxKeywordsPerAlert !== -1 && keywordCount > limits.maxKeywordsPerAlert) {
    return {
      allowed: false,
      message: `Limite: ${limits.maxKeywordsPerAlert} mots-cles max par alerte (plan ${limits.planName}). Passez a Entreprise pour des mots-cles illimites.`
    };
  }

  return { allowed: true };
}

/**
 * Expirer les demos 24h terminees
 * Appele par cron toutes les heures
 */
async function expireTrials() {
  const now = new Date().toISOString();

  // Trouver les demos expirees
  const { data: expiredTrials, error } = await supabase
    .from('veille_demo_trials')
    .select('*')
    .eq('is_expired', false)
    .lt('trial_end', now);

  if (error || !expiredTrials || expiredTrials.length === 0) {
    return { expired: 0 };
  }

  let expiredCount = 0;

  for (const trial of expiredTrials) {
    try {
      // Marquer le trial comme expire
      await supabase
        .from('veille_demo_trials')
        .update({ is_expired: true })
        .eq('id', trial.id);

      // Expirer l'abonnement trial
      await supabase
        .from('veille_subscriptions')
        .update({ status: 'expired', updated_at: now })
        .eq('user_id', trial.user_id)
        .eq('status', 'trial');

      // Desactiver les alertes de l'utilisateur trial
      if (trial.user_id) {
        await supabase
          .from('user_alerts')
          .update({ is_active: false })
          .eq('user_id', trial.user_id);
      }

      // Envoyer WhatsApp de fin de demo
      try {
        const whapiService = require('./whapiService');
        const message = `Votre demo Veille & Alertes Gabon Insight est terminee.\n\nAbonnez-vous pour continuer a recevoir vos alertes :\nhttps://gaboninsight.com/veille-alertes\n\nA partir de 2 000 FCFA/mois.`;
        await whapiService.sendWhatsAppMessage(trial.whatsapp_number, message);
      } catch (whatsappErr) {
        console.warn('WhatsApp fin demo echoue:', whatsappErr.message);
      }

      expiredCount++;
    } catch (err) {
      console.error(`Erreur expiration trial ${trial.id}:`, err.message);
    }
  }

  console.log(`⏰ ${expiredCount} demo(s) veille expiree(s)`);
  return { expired: expiredCount };
}

/**
 * Creer un abonnement veille apres paiement
 * @param {string} userId
 * @param {string} planSlug
 * @param {string} whatsappNumber
 * @param {number} durationMonths
 * @param {object} metadata
 */
async function createSubscription(userId, planSlug, whatsappNumber, durationMonths = 1, metadata = {}) {
  // Recuperer le plan
  const { data: plan, error: planError } = await supabase
    .from('veille_plans')
    .select('*')
    .eq('slug', planSlug)
    .eq('is_active', true)
    .single();

  if (planError || !plan) {
    throw new Error(`Plan veille non trouve: ${planSlug}`);
  }

  // Expirer les abonnements actifs precedents
  await supabase
    .from('veille_subscriptions')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('status', ['active', 'trial']);

  // Creer le nouvel abonnement
  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + durationMonths);

  const { data: subscription, error: subError } = await supabase
    .from('veille_subscriptions')
    .insert({
      user_id: userId,
      plan_id: plan.id,
      status: 'active',
      whatsapp_number: whatsappNumber,
      payment_method: 'ebilling',
      current_period_start: now.toISOString(),
      current_period_end: endDate.toISOString(),
      metadata: {
        ...metadata,
        plan_slug: planSlug,
        duration_months: durationMonths
      }
    })
    .select('*, veille_plans(*)')
    .single();

  if (subError) {
    throw new Error(`Erreur creation abonnement veille: ${subError.message}`);
  }

  // Marquer la demo comme convertie si existe
  await supabase
    .from('veille_demo_trials')
    .update({ converted_to_subscription: true })
    .eq('user_id', userId);

  return subscription;
}

module.exports = {
  checkSubscriptionStatus,
  isUserSubscribed,
  getUserLimits,
  enforceAlertLimits,
  expireTrials,
  createSubscription
};
